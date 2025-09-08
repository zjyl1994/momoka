package service

import (
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
	m.RemotePath = m.Hash + m.ExtName
	m.LocalPath = utils.DataPath("cache", m.Hash[0:2], m.Hash[2:4], m.Hash+m.ExtName)
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.ENTITY_TYPE_FILE, m.ID})
	if err != nil {
		return err
	}
	m.URL = "/i/" + imageHashId + m.ExtName
	return nil
}

func (s *virtualFATService) Save(file *multipart.FileHeader, logicPath string) (*common.VirtualFAT, error) {
	fileHash, err := utils.MultipartFileHeaderHash(file)
	if err != nil {
		return nil, err
	}

	m := common.VirtualFAT{
		Hash:        fileHash,
		ContentType: file.Header.Get("Content-Type"),
		FileSize:    file.Size,
		ExtName:     filepath.Ext(file.Filename),
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

// Delete 删除文件
func (s *virtualFATService) Delete(pathStr string) error {
	fileObj, err := s.GetPath(vars.Database, pathStr)
	if err != nil {
		return err
	}
	err = s.fillModel(fileObj)
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
	go S3TaskService.RunTask()
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
