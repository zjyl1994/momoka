package service

import (
	"errors"
	"strings"
	"sync"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type fsPathService struct{
	// pathCache 缓存路径信息，key为路径字符串，value为*common.FSPath
	pathCache sync.Map
}

var FSPathService = &fsPathService{}

// Get 根据路径字符串获取路径信息
func (s *fsPathService) Get(pathStr string) (*common.FSPath, error) {
	if pathStr == "/" {
		// 根路径特殊处理
		return &common.FSPath{
			ID:         0,
			ParentID:   0,
			Name:       "/",
			EntityType: common.ENTITY_TYPE_FOLDER,
		}, nil
	}

	// 先从缓存中查找
	if cached, ok := s.pathCache.Load(pathStr); ok {
		if fsPath, ok := cached.(*common.FSPath); ok {
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
	var currentPath *common.FSPath

	for _, part := range pathParts {
		var fsPath common.FSPath
		if err := vars.Database.Where("parent_id = ? AND name = ?", currentParentID, part).First(&fsPath).Error; err != nil {
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
func (s *fsPathService) parsePath(pathStr string) []string {
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

// Create 根据路径字符串创建新路径
func (s *fsPathService) Create(pathStr string, entityType int32) error {
	if pathStr == "/" {
		return errors.New("root path already exists")
	}

	// 解析路径
	pathParts := s.parsePath(pathStr)
	if len(pathParts) == 0 {
		return errors.New("invalid path")
	}

	// 获取父路径
	var parentID int64 = 0
	if len(pathParts) > 1 {
		parentPathStr := "/" + strings.Join(pathParts[:len(pathParts)-1], "/")
		parentPath, err := s.Get(parentPathStr)
		if err != nil {
			return err
		}
		if parentPath == nil {
			return errors.New("parent path not found")
		}
		// 检查父路径类型，只有文件夹类型才能下挂文件
		if parentPath.EntityType != common.ENTITY_TYPE_FOLDER {
			return errors.New("can only create paths under folder type parent")
		}
		parentID = parentPath.ID
	}

	// 检查同级路径名称是否重复
	if err := s.checkDuplicateName(vars.Database, parentID, pathParts[len(pathParts)-1], 0); err != nil {
		return err
	}

	// 创建路径
	fsPath := &common.FSPath{
		ParentID:   parentID,
		Name:       pathParts[len(pathParts)-1],
		EntityType: entityType,
	}

	if err := vars.Database.Create(fsPath).Error; err != nil {
		return err
	}

	// 更新缓存
	s.pathCache.Store(pathStr, fsPath)

	return nil
}

// checkDuplicateName 检查同级路径名称是否重复
func (s *fsPathService) checkDuplicateName(db *gorm.DB, parentID int64, name string, excludeID int64) error {
	var count int64
	query := db.Model(&common.FSPath{}).Where("parent_id = ? AND name = ?", parentID, name)
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

// Delete 批量删除路径
func (s *fsPathService) Delete(pathStrs []string, recursive bool) error {
	if len(pathStrs) == 0 {
		return nil
	}

	return vars.Database.Transaction(func(tx *gorm.DB) error {
		for _, pathStr := range pathStrs {
			if pathStr == "/" {
				return errors.New("root path cannot be deleted")
			}

			fsPath, err := s.Get(pathStr)
			if err != nil {
				return err
			}
			if fsPath == nil {
				return errors.New("path not found: " + pathStr)
			}

			if recursive {
				// 递归删除
				if err := s.deleteRecursivelyInTx(tx, pathStr); err != nil {
					return err
				}
				// 清除缓存（递归删除会在deleteRecursivelyInTx中处理）
				s.invalidateCacheRecursively(pathStr)
			} else {
				// 非递归删除，检查是否有子路径
				var count int64
				if err := tx.Model(&common.FSPath{}).Where("parent_id = ?", fsPath.ID).Count(&count).Error; err != nil {
					return err
				}
				if count > 0 {
					return errors.New("cannot delete path with children: " + pathStr)
				}
				if err := tx.Delete(&common.FSPath{}, fsPath.ID).Error; err != nil {
					return err
				}
				// 清除缓存
				s.pathCache.Delete(pathStr)
			}
		}
		return nil
	})
}

// deleteRecursivelyInTx 在事务中递归删除路径及其所有子路径的内部方法
func (s *fsPathService) deleteRecursivelyInTx(tx *gorm.DB, pathStr string) error {
	fsPath, err := s.Get(pathStr)
	if err != nil {
		return err
	}
	if fsPath == nil {
		return errors.New("path not found: " + pathStr)
	}

	// 获取所有子路径
	children, err := s.GetChildren(pathStr)
	if err != nil {
		return err
	}

	// 递归删除子路径
	for _, child := range children {
		// 构建子路径的完整路径字符串
		var childPathStr string
		if pathStr == "/" {
			childPathStr = "/" + child.Name
		} else {
			childPathStr = pathStr + "/" + child.Name
		}
		if err := s.deleteRecursivelyInTx(tx, childPathStr); err != nil {
			return err
		}
	}

	// 删除当前路径
	return tx.Delete(&common.FSPath{}, fsPath.ID).Error
}

// Move 批量移动路径到新的父路径下
func (s *fsPathService) Move(pathStrs []string, newParentPathStr string) error {
	if len(pathStrs) == 0 {
		return nil
	}

	return vars.Database.Transaction(func(tx *gorm.DB) error {
		// 获取目标父路径信息
		var newParentID int64 = 0
		if newParentPathStr != "/" {
			newParent, err := s.Get(newParentPathStr)
			if err != nil {
				return err
			}
			if newParent == nil {
				return errors.New("target parent path not found")
			}
			// 检查目标父路径类型
			if newParent.EntityType != common.ENTITY_TYPE_FOLDER {
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
			sourcePath, err := s.Get(pathStr)
			if err != nil {
				return err
			}
			if sourcePath == nil {
				return errors.New("source path not found: " + pathStr)
			}

			// 检查循环引用
			if newParentID != 0 {
				if err := s.checkCircularReference(sourcePath.ID, newParentID); err != nil {
					return err
				}
			}

			// 检查目标位置是否已有同名路径
			if err := s.checkDuplicateName(tx, newParentID, sourcePath.Name, sourcePath.ID); err != nil {
				return errors.New("path name already exists in the target parent: " + sourcePath.Name)
			}

			// 更新父路径ID
			if err := tx.Model(&common.FSPath{}).Where("id = ?", sourcePath.ID).Update("parent_id", newParentID).Error; err != nil {
				return err
			}

			// 清除旧路径缓存，移动操作会影响路径结构
			s.invalidateCacheRecursively(pathStr)
		}

		return nil
	})
}

// Rename 根据路径字符串重命名路径
func (s *fsPathService) Rename(pathStr string, newName string) error {
	if pathStr == "/" {
		return errors.New("root path cannot be renamed")
	}

	fsPath, err := s.Get(pathStr)
	if err != nil {
		return err
	}
	if fsPath == nil {
		return errors.New("path not found")
	}

	// 检查同级是否已有同名路径
	if err := s.checkDuplicateName(vars.Database, fsPath.ParentID, newName, fsPath.ID); err != nil {
		return err
	}

	// 更新名称
	if err := vars.Database.Model(&common.FSPath{}).Where("id = ?", fsPath.ID).Update("name", newName).Error; err != nil {
		return err
	}

	// 清除旧路径缓存，重命名会影响路径结构
	s.invalidateCacheRecursively(pathStr)

	return nil
}

// checkCircularReference 检查是否会形成循环引用
func (s *fsPathService) checkCircularReference(pathID int64, targetParentID int64) error {
	current := targetParentID
	for current != 0 {
		if current == pathID {
			return errors.New("circular reference detected")
		}
		var path common.FSPath
		if err := vars.Database.Where("id = ?", current).First(&path).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				break
			}
			return err
		}
		current = path.ParentID
	}
	return nil
}

// GetChildren 根据路径字符串获取指定路径的所有直接子路径
func (s *fsPathService) GetChildren(pathStr string) ([]*common.FSPath, error) {
	var parentID int64 = 0
	if pathStr != "/" {
		parentPath, err := s.Get(pathStr)
		if err != nil {
			return nil, err
		}
		if parentPath == nil {
			return nil, errors.New("parent path not found")
		}
		parentID = parentPath.ID
	}

	var children []*common.FSPath
	if err := vars.Database.Where("parent_id = ?", parentID).Find(&children).Error; err != nil {
		return nil, err
	}
	return children, nil
}

// invalidateCacheRecursively 递归清除指定路径及其所有子路径的缓存
func (s *fsPathService) invalidateCacheRecursively(pathStr string) {
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

// Mkdir 递归创建目录路径，类似 mkdir -p 行为
func (s *fsPathService) Mkdir(pathStr string) error {
	if pathStr == "/" {
		return nil // 根路径已存在
	}

	// 检查路径是否已存在
	existingPath, err := s.Get(pathStr)
	if err != nil {
		return err
	}
	if existingPath != nil {
		if existingPath.EntityType == common.ENTITY_TYPE_FOLDER {
			return nil // 目录已存在
		}
		return errors.New("path already exists but is not a folder")
	}

	// 解析路径
	pathParts := s.parsePath(pathStr)
	if len(pathParts) == 0 {
		return errors.New("invalid path")
	}

	// 递归创建每一级目录
	currentPath := "/"
	for _, part := range pathParts {
		if currentPath == "/" {
			currentPath = "/" + part
		} else {
			currentPath = currentPath + "/" + part
		}

		// 检查当前级别是否存在
		currentFSPath, err := s.Get(currentPath)
		if err != nil {
			return err
		}

		if currentFSPath == nil {
			// 当前级别不存在，创建它
			if err := s.Create(currentPath, common.ENTITY_TYPE_FOLDER); err != nil {
				return err
			}
		} else if currentFSPath.EntityType != common.ENTITY_TYPE_FOLDER {
			// 当前级别存在但不是文件夹
			return errors.New("path component exists but is not a folder: " + currentPath)
		}
	}

	return nil
}
