package service

import (
	"context"
	"errors"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type virtualFATService struct {
	// pathCache 缓存路径信息，key为路径字符串，value为*common.VirtualFAT
	pathCache sync.Map
}

var VirtualFATService = &virtualFATService{}

func (s *virtualFATService) Get(id int64) (*common.VirtualFAT, error) {
	var logicFile common.VirtualFAT
	err := vars.Database.Where("id = ?", id).First(&logicFile).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("file not found")
		}
		return nil, err
	}
	err = s.fillModel(&logicFile)
	if err != nil {
		return nil, err
	}
	return &logicFile, nil
}

func (s *virtualFATService) fillModel(m *common.VirtualFAT) error {
	if !m.IsFolder {
		m.RemotePath = m.Hash + m.ExtName
		m.LocalPath = utils.DataPath("cache", m.Hash[0:2], m.Hash[2:4], m.Hash+m.ExtName)
		imageHashId, err := vars.HashID.EncodeInt64([]int64{common.ENTITY_TYPE_FILE, m.ID})
		if err != nil {
			return err
		}
		m.URL = "/i/" + imageHashId + m.ExtName
	}
	if m.Children == nil {
		m.Children = []*common.VirtualFAT{}
	}
	return nil
}

func (s *virtualFATService) Save(file *multipart.FileHeader, logicPath string) (*common.VirtualFAT, error) {
	fileHash, err := utils.MultipartFileHeaderHash(file)
	if err != nil {
		return nil, err
	}
	extName := filepath.Ext(file.Filename)
	bareName := strings.TrimSuffix(file.Filename, extName)
	m := common.VirtualFAT{
		Hash:        fileHash,
		ContentType: file.Header.Get("Content-Type"),
		FileSize:    file.Size,
		ExtName:     extName,
		Name:        bareName,
	}
	err = s.fillModel(&m)
	if err != nil {
		return nil, err
	}
	// save file to localpath
	err = utils.SaveMultipartFile(file, m.LocalPath)
	if err != nil {
		logrus.Errorln("save file to localpath failed", err)
		return nil, err
	}

	err = vars.Database.Transaction(func(tx *gorm.DB) (err error) {
		err = S3TaskService.Add(tx, []*common.S3Task{
			{
				Action:     common.S3TASK_ACTION_UPLOAD,
				LocalPath:  m.LocalPath,
				RemotePath: m.RemotePath,
			},
		})
		if err != nil {
			return err
		}

		baseDir := filepath.Dir(logicPath)
		parentID, err := s.Mkdir(tx, baseDir)
		if err != nil {
			return err
		}
		m.ParentID = parentID

		err = tx.Create(&m).Error
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		logrus.Errorln("save file metadata failed", err)
		return nil, err
	}
	err = s.fillModel(&m)
	if err != nil {
		return nil, err
	}
	go S3TaskService.RunTask()
	return &m, nil
}

// Delete 删除文件或目录
func (s *virtualFATService) Delete(pathStr []string) error {
	// 批量处理每个路径
	for _, p := range pathStr {
		fileObj, err := s.GetPath(vars.Database, p)
		if err != nil {
			return err
		}
		if fileObj == nil {
			return errors.New("path not found: " + p)
		}

		// 如果是目录，递归删除所有子项
		if fileObj.IsFolder {
			err = s.deleteDirectory(fileObj, p)
		} else {
			// 如果是文件，使用原有逻辑删除
			err = s.deleteFile(fileObj, p)
		}

		if err != nil {
			return err
		}
	}
	go S3TaskService.RunTask()
	return nil
}

// deleteDirectory 递归删除目录及其所有子项
func (s *virtualFATService) deleteDirectory(dirObj *common.VirtualFAT, pathStr string) error {
	// 查找所有子项
	var children []common.VirtualFAT
	err := vars.Database.Where("parent_id = ?", dirObj.ID).Find(&children).Error
	if err != nil {
		return err
	}

	// 递归删除所有子项
	for _, child := range children {
		childPath := pathStr
		if pathStr == "/" {
			childPath = "/" + child.Name
		} else {
			childPath = pathStr + "/" + child.Name
		}

		if child.IsFolder {
			// 递归删除子目录
			err = s.deleteDirectory(&child, childPath)
			if err != nil {
				return err
			}
		} else {
			// 删除子文件
			err = s.deleteFile(&child, childPath)
			if err != nil {
				return err
			}
		}
	}

	// 删除目录本身
	err = vars.Database.Delete(dirObj).Error
	if err != nil {
		return err
	}

	// 从缓存中删除
	s.pathCache.Delete(pathStr)
	return nil
}

// deleteFile 删除单个文件
func (s *virtualFATService) deleteFile(fileObj *common.VirtualFAT, pathStr string) error {
	err := s.fillModel(fileObj)
	if err != nil {
		return err
	}
	err = vars.Database.Transaction(func(tx *gorm.DB) (err error) {
		err = tx.Delete(fileObj).Error
		if err != nil {
			return err
		}
		err = S3TaskService.Add(tx, []*common.S3Task{
			{
				Action:     common.S3TASK_ACTION_DELETE,
				RemotePath: fileObj.RemotePath,
			},
		})
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	os.Remove(fileObj.LocalPath)
	s.pathCache.Delete(pathStr)
	return nil
}

// Get 根据路径字符串获取路径信息
func (s *virtualFATService) GetPath(db *gorm.DB, pathStr string) (*common.VirtualFAT, error) {
	if pathStr == "/" {
		// 根路径特殊处理
		return &common.VirtualFAT{
			ID:       0,
			ParentID: 0,
			Name:     "/",
			IsFolder: true,
		}, nil
	}

	// 先从缓存中查找
	if cached, ok := s.pathCache.Load(pathStr); ok {
		if fsPath, ok := cached.(*common.VirtualFAT); ok {
			return fsPath, nil
		}
	}

	// 解析路径
	pathParts := s.parsePath(pathStr)
	if len(pathParts) == 0 {
		return nil, errors.New("invalid path")
	}

	// 从根开始逐级查找
	currentParentID := int64(0)
	var currentPath *common.VirtualFAT

	for _, part := range pathParts {
		var fsPath common.VirtualFAT
		if err := db.Where("parent_id = ? AND name = ?", currentParentID, part).First(&fsPath).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil
			}
			return nil, err
		}
		currentPath = &fsPath
		currentParentID = fsPath.ID
	}

	// 将结果缓存
	if currentPath != nil {
		s.pathCache.Store(pathStr, currentPath)
	}

	return currentPath, nil
}

// parsePath 解析路径字符串为路径组件数组
func (s *virtualFATService) parsePath(pathStr string) []string {
	if pathStr == "/" {
		return []string{}
	}

	// 移除开头和结尾的斜杠
	pathStr = strings.Trim(pathStr, "/")
	if pathStr == "" {
		return []string{}
	}

	return strings.Split(pathStr, "/")
}

// Mkdir 递归创建目录路径，类似 mkdir -p 行为
// Mkdir 创建目录，返回最后一级目录的ID
func (s *virtualFATService) Mkdir(db *gorm.DB, pathStr string) (int64, error) {
	if pathStr == "/" {
		// 根路径已存在，无需创建
		return 0, nil
	}

	// 解析路径
	pathParts := s.parsePath(pathStr)
	if len(pathParts) == 0 {
		return 0, errors.New("invalid path")
	}

	// 从根开始逐级创建目录
	currentParentID := int64(0)
	currentPath := "/"

	for _, part := range pathParts {
		// 检查当前层级的目录是否已存在
		var existingDir common.VirtualFAT
		err := db.Where("parent_id = ? AND name = ? AND is_folder = ?", currentParentID, part, true).First(&existingDir).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// 目录不存在，创建新目录
				newDir := common.VirtualFAT{
					ParentID: currentParentID,
					Name:     part,
					IsFolder: true,
				}
				err = db.Create(&newDir).Error
				if err != nil {
					return 0, err
				}
				currentParentID = newDir.ID
			} else {
				// 数据库查询错误
				return 0, err
			}
		} else {
			// 目录已存在，使用现有目录
			currentParentID = existingDir.ID
		}

		// 更新当前路径
		if currentPath == "/" {
			currentPath = "/" + part
		} else {
			currentPath = currentPath + "/" + part
		}

		// 将创建的路径加入缓存
		if currentParentID > 0 {
			// 获取当前目录的完整信息用于缓存
			var currentDir common.VirtualFAT
			err := db.Where("id = ?", currentParentID).First(&currentDir).Error
			if err == nil {
				s.pathCache.Store(currentPath, &currentDir)
			}
		}
	}

	return currentParentID, nil
}

// checkDuplicateName 检查同级路径名称是否重复
func (s *virtualFATService) checkDuplicateName(db *gorm.DB, parentID int64, name string, excludeID int64) error {
	var count int64
	query := db.Model(&common.VirtualFAT{}).Where("parent_id = ? AND name = ?", parentID, name)
	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("path name already exists in the same parent")
	}
	return nil
}

// checkCircularReference 检查是否存在循环引用
func (s *virtualFATService) checkCircularReference(db *gorm.DB, pathID int64, targetParentID int64) error {
	current := targetParentID
	for current != 0 {
		if current == pathID {
			return errors.New("circular reference detected")
		}
		var path common.VirtualFAT
		if err := db.Where("id = ?", current).First(&path).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				break
			}
			return err
		}
		current = path.ParentID
	}
	return nil
}

// invalidateCacheRecursively 递归清除指定路径及其所有子路径的缓存
func (s *virtualFATService) invalidateCacheRecursively(pathStr string) {
	// 清除当前路径缓存
	s.pathCache.Delete(pathStr)

	// 遍历缓存中的所有路径，清除以当前路径为前缀的子路径
	s.pathCache.Range(func(key, value interface{}) bool {
		if cachedPath, ok := key.(string); ok {
			// 检查是否为子路径
			if strings.HasPrefix(cachedPath, pathStr+"/") {
				s.pathCache.Delete(cachedPath)
			}
		}
		return true
	})
}

// Rename 重命名路径
func (s *virtualFATService) Rename(db *gorm.DB, pathStr string, newName string) error {
	if pathStr == "/" {
		return errors.New("root path cannot be renamed")
	}

	fsPath, err := s.GetPath(db, pathStr)
	if err != nil {
		return err
	}
	if fsPath == nil {
		return errors.New("path not found")
	}

	// 检查同级是否已有同名路径
	if err := s.checkDuplicateName(db, fsPath.ParentID, newName, fsPath.ID); err != nil {
		return err
	}

	// 更新名称
	if err := db.Model(&common.VirtualFAT{}).Where("id = ?", fsPath.ID).Update("name", newName).Error; err != nil {
		return err
	}

	// 清除旧路径缓存，重命名会影响路径结构
	s.invalidateCacheRecursively(pathStr)

	return nil
}

// Move 移动路径
func (s *virtualFATService) Move(db *gorm.DB, pathStrs []string, newParentPathStr string) error {
	if len(pathStrs) == 0 {
		return nil
	}

	return db.Transaction(func(tx *gorm.DB) error {
		// 获取目标父路径信息
		var newParentID int64 = 0
		if newParentPathStr != "/" {
			newParent, err := s.GetPath(tx, newParentPathStr)
			if err != nil {
				return err
			}
			if newParent == nil {
				return errors.New("target parent path not found")
			}
			// 检查目标父路径类型
			if !newParent.IsFolder {
				return errors.New("can only move paths under folder type parent")
			}
			newParentID = newParent.ID
		}

		// 批量处理每个路径
		for _, pathStr := range pathStrs {
			if pathStr == "/" {
				return errors.New("root path cannot be moved")
			}

			// 获取源路径
			sourcePath, err := s.GetPath(tx, pathStr)
			if err != nil {
				return err
			}
			if sourcePath == nil {
				return errors.New("source path not found: " + pathStr)
			}

			// 检查循环引用
			if newParentID != 0 {
				if err := s.checkCircularReference(tx, sourcePath.ID, newParentID); err != nil {
					return err
				}
			}

			// 检查目标位置是否已有同名路径
			if err := s.checkDuplicateName(tx, newParentID, sourcePath.Name, sourcePath.ID); err != nil {
				return errors.New("path name already exists in the target parent: " + sourcePath.Name)
			}

			// 更新父路径ID
			if err := tx.Model(&common.VirtualFAT{}).Where("id = ?", sourcePath.ID).Update("parent_id", newParentID).Error; err != nil {
				return err
			}

			// 清除旧路径缓存，移动操作会影响路径结构
			s.invalidateCacheRecursively(pathStr)
		}

		return nil
	})
}

// GetChildren 获取指定路径下的所有子文件和文件夹
func (s *virtualFATService) GetChildren(db *gorm.DB, pathStr string) ([]*common.VirtualFAT, error) {
	var parentID int64 = 0
	if pathStr != "/" {
		parentPath, err := s.GetPath(db, pathStr)
		if err != nil {
			return nil, err
		}
		if parentPath == nil {
			return nil, errors.New("parent path not found")
		}
		// 检查父路径是否为文件夹
		if !parentPath.IsFolder {
			return nil, errors.New("path is not a folder")
		}
		parentID = parentPath.ID
	}

	children := []*common.VirtualFAT{}
	if err := db.Where("parent_id = ?", parentID).Find(&children).Error; err != nil {
		return nil, err
	}

	// 为文件类型的子项填充模型信息
	for _, child := range children {
		if err := s.fillModel(child); err != nil {
			return nil, err
		}
	}

	return children, nil
}

type VirtualFATStatistics struct {
	FileCount   int64
	FileSize    int64
	FolderCount int64
}

func (s *virtualFATService) Statistics() (*VirtualFATStatistics, error) {
	var fileCount int64
	if err := vars.Database.Model(&common.VirtualFAT{}).Where("is_folder = ?", false).Count(&fileCount).Error; err != nil {
		return nil, err
	}
	var folderCount int64
	if err := vars.Database.Model(&common.VirtualFAT{}).Where("is_folder = ?", true).Count(&folderCount).Error; err != nil {
		return nil, err
	}
	var fileSize int64
	if err := vars.Database.Model(&common.VirtualFAT{}).Where("is_folder = ?", false).Select("COALESCE(SUM(file_size),0)").Scan(&fileSize).Error; err != nil {
		return nil, err
	}
	return &VirtualFATStatistics{
		FileCount:   fileCount,
		FileSize:    fileSize,
		FolderCount: folderCount,
	}, nil
}

func (s *virtualFATService) Download(file *common.VirtualFAT) error {
	err := s.fillModel(file)
	if err != nil {
		return err
	}
	return StorageService.Download(context.Background(), file.RemotePath, file.LocalPath)
}

func (s *virtualFATService) GetTree(db *gorm.DB) (*common.VirtualFAT, error) {
	// 获取所有文件夹并构建树形结构
	var folders []*common.VirtualFAT
	if err := db.Where("is_folder = ?", true).Find(&folders).Error; err != nil {
		return nil, err
	}

	// 创建根节点
	root := &common.VirtualFAT{
		ID:       0,
		ParentID: 0,
		Name:     "/",
		IsFolder: true,
		Children: make([]*common.VirtualFAT, 0),
	}

	// 创建ID到节点的映射
	folderMap := make(map[int64]*common.VirtualFAT)
	folderMap[0] = root

	// 初始化所有文件夹节点的Children切片
	for _, folder := range folders {
		folder.Children = make([]*common.VirtualFAT, 0)
		folderMap[folder.ID] = folder
	}

	// 使用多轮构建来处理多层嵌套，确保父节点先于子节点处理
	remaining := make([]*common.VirtualFAT, len(folders))
	copy(remaining, folders)

	// 最多尝试构建的轮数，防止无限循环
	maxRounds := len(folders) + 1
	for round := 0; round < maxRounds && len(remaining) > 0; round++ {
		processed := make([]*common.VirtualFAT, 0)
		unprocessed := make([]*common.VirtualFAT, 0)

		// 尝试处理剩余的文件夹
		for _, folder := range remaining {
			if parent, exists := folderMap[folder.ParentID]; exists {
				// 父节点存在，可以添加到树中
				parent.Children = append(parent.Children, folder)
				processed = append(processed, folder)
			} else {
				// 父节点不存在，留到下一轮处理
				unprocessed = append(unprocessed, folder)
			}
		}

		// 如果这一轮没有处理任何节点，说明存在孤立节点或循环引用
		if len(processed) == 0 && len(unprocessed) > 0 {
			// 记录警告但不中断，将孤立节点直接添加到根节点下
			for _, orphan := range unprocessed {
				root.Children = append(root.Children, orphan)
			}
			break
		}

		remaining = unprocessed
	}

	return root, nil
}

func (s *virtualFATService) GetAllFiles(db *gorm.DB, page, pageSize int) ([]*common.VirtualFAT, int64, error) {
	var total int64
	if err := db.Model(&common.VirtualFAT{}).Where("is_folder = ?", false).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var files []*common.VirtualFAT
	if err := db.Where("is_folder = ?", false).Offset((page - 1) * pageSize).Limit(pageSize).Find(&files).Error; err != nil {
		return nil, 0, err
	}
	// 为每个文件填充模型信息（包括URL等字段）
	for _, file := range files {
		if err := s.fillModel(file); err != nil {
			return nil, 0, err
		}
	}
	return files, total, nil
}
