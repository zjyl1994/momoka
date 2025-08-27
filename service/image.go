package service

import (
	"errors"
	"os"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ImageService = &imageService{}

type imageService struct{}

func (s *imageService) Add(img *common.Image) (int64, error) {
	err := vars.Database.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "hash"}},
		UpdateAll: true,
	}).Create(img).Error
	return img.ID, err
}

func (s *imageService) ImageHashExists(hash string) (bool, error) {
	var count int64
	err := vars.Database.Model(&common.Image{}).Where("hash = ?", hash).Count(&count).Error
	return count > 0, err
}

func (s *imageService) GetByID(id int64) (*common.Image, error) {
	var img common.Image
	err := vars.Database.Where("id = ?", id).First(&img).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &img, nil
}

func (s *imageService) GetByHash(hash string) (*common.Image, error) {
	var img common.Image
	err := vars.Database.Where("hash = ?", hash).First(&img).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &img, nil
}

func (s *imageService) DeleteByID(id int64) error {
	img, err := ImageService.GetByID(id)
	if err != nil {
		return err
	}
	if img == nil {
		return errors.New("image not found")
	}
	return ImageService.Delete(img)
}

func (s *imageService) Delete(img *common.Image) (err error) {
	// 删除S3对象
	err = StorageService.Delete(img.Hash + img.ExtName)
	if err != nil {
		return err
	}
	// 删除本地对象
	err = os.Remove(utils.GetImageCachePath(img.Hash, img.ExtName))
	if err != nil {
		return err
	}
	// 删除数据库记录
	err = vars.Database.Delete(&common.Image{}, img.ID).Error
	if err != nil {
		return err
	}
	return nil
}

func (s *imageService) Move(id int64, folderID int64) error {
	result := vars.Database.Model(&common.Image{}).Where("id = ?", id).Update("folder_id", folderID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("image not found")
	}
	return nil
}

func (s *imageService) Rename(id int64, name string) error {
	result := vars.Database.Model(&common.Image{}).Where("id = ?", id).Update("file_name", name)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("image not found")
	}
	return nil
}

func (s *imageService) GetAllPublic(page, pageSize int) ([]common.Image, int64, error) {
	folders, err := ImageFolderService.GetAllPublicFolder()
	if err != nil {
		return nil, 0, err
	}

	publicFolderID := make([]int64, 0, len(folders))
	for _, folder := range folders {
		publicFolderID = append(publicFolderID, folder.ID)
	}

	if len(publicFolderID) == 0 {
		return []common.Image{}, 0, nil
	}

	var total int64
	if err := vars.Database.Model(&common.Image{}).Where("folder_id IN ?", publicFolderID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var images []common.Image
	if err := vars.Database.Where("folder_id IN ?", publicFolderID).Offset((page - 1) * pageSize).Limit(pageSize).Find(&images).Error; err != nil {
		return nil, 0, err
	}
	return images, total, nil
}
