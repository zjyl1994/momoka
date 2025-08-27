package service

import (
	"errors"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type imageFolderService struct{}

var ImageFolderService = &imageFolderService{}
var publicFolderSf utils.SingleFlight[[]common.ImageFolder]

func (s *imageFolderService) Get(id int64) (*common.ImageFolder, error) {
	var folder common.ImageFolder
	if err := vars.Database.Where("id = ?", id).First(&folder).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &folder, nil
}

func (s *imageFolderService) Create(folder *common.ImageFolder) error {
	return vars.Database.Create(folder).Error
}

// GetFolderContents 获取指定文件夹下的所有子文件夹和图片
func (s *imageFolderService) GetFolderContents(folderID int64) (folders []*common.ImageFolder, images []*common.Image, err error) {
	// 获取子文件夹
	if err = vars.Database.Where("parent_id = ?", folderID).Find(&folders).Error; err != nil {
		return nil, nil, err
	}

	// 获取该文件夹下的图片
	if err = vars.Database.Where("folder_id = ?", folderID).Find(&images).Error; err != nil {
		return nil, nil, err
	}

	return folders, images, nil
}

func (s *imageFolderService) Delete(id int64) error {
	if id == 0 {
		return errors.New("Root folder cannot be deleted")
	}
	folders, images, err := s.GetFolderContents(id)
	if err != nil {
		return err
	}
	if len(folders) > 0 || len(images) > 0 {
		return errors.New("Cannot delete folder containing subfolders or images")
	}
	return vars.Database.Delete(&common.ImageFolder{}, id).Error
}
func (s *imageFolderService) Rename(id int64, name string) error {
	result := vars.Database.Model(&common.ImageFolder{}).Where("id = ?", id).Update("name", name)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("folder not found")
	}
	return nil
}

func (s *imageFolderService) Move(id int64, parentID int64) error {
	result := vars.Database.Model(&common.ImageFolder{}).Where("id = ?", id).Update("parent_id", parentID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("folder not found")
	}
	return nil
}

func (s *imageFolderService) DeleteRecursively(id int64) error {
	folders, images, err := s.GetFolderContents(id)
	if err != nil {
		return err
	}
	for _, image := range images {
		err = ImageService.Delete(image)
		if err != nil {
			return err
		}
	}
	for _, folder := range folders {
		err = s.DeleteRecursively(folder.ID)
		if err != nil {
			return err
		}
	}
	return vars.Database.Delete(&common.ImageFolder{}, id).Error
}

func (s *imageFolderService) SetPublic(id int64, public bool) error {
	result := vars.Database.Model(&common.ImageFolder{}).Where("id = ?", id).Update("public", public)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("folder not found")
	}
	return nil
}

func (s *imageFolderService) GetAllPublicFolder() ([]common.ImageFolder, error) {
	return publicFolderSf.Do("", func() ([]common.ImageFolder, error) {
		var folders []common.ImageFolder
		if err := vars.Database.Where("public = ?", true).Find(&folders).Error; err != nil {
			return nil, err
		}
		// 生成map快速过滤
		publicFolderMap := make(map[int64]common.ImageFolder)
		for _, folder := range folders {
			publicFolderMap[folder.ID] = folder
		}

		// 过滤出整个链路都是public的文件夹
		var result []common.ImageFolder
		for _, folder := range folders {
			isAllPublic := true
			currentID := folder.ParentID

			// 递归向上检查每个父文件夹是否都是public
			for currentID != 0 { // 0 表示根目录
				parentFolder, ok := publicFolderMap[currentID]
				if !ok {
					isAllPublic = false
					break
				}

				// 如果父文件夹不是public，则整个链路不是public
				if !parentFolder.Public {
					isAllPublic = false
					break
				}

				currentID = parentFolder.ParentID
			}

			// 如果整个链路都是public，则加入结果集
			if isAllPublic {
				result = append(result, folder)
			}
		}

		return result, nil
	})
}

// GetFolderTree 获取所有文件夹的树形结构
func (s *imageFolderService) GetFolderTree() ([]*common.FolderTree, error) {
	var folders []common.ImageFolder
	if err := vars.Database.Find(&folders).Error; err != nil {
		return nil, err
	}

	// 创建文件夹映射
	folderMap := make(map[int64]*common.FolderTree)
	for _, folder := range folders {
		folderMap[folder.ID] = &common.FolderTree{
			ID:         folder.ID,
			Name:       folder.Name,
			ParentID:   folder.ParentID,
			Public:     folder.Public,
			CreateTime: folder.CreateTime,
			UpdateTime: folder.UpdateTime,
			Children:   []*common.FolderTree{},
		}
	}

	// 构建树形结构
	var rootFolders []*common.FolderTree
	for _, folder := range folders {
		if folder.ParentID == 0 {
			// 根文件夹
			rootFolders = append(rootFolders, folderMap[folder.ID])
		} else {
			// 子文件夹，添加到父文件夹的children中
			if parent, exists := folderMap[folder.ParentID]; exists {
				parent.Children = append(parent.Children, folderMap[folder.ID])
			}
		}
	}

	return rootFolders, nil
}
