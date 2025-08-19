package service

import (
	"errors"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ImageService = &imageService{}

type imageService struct{}

func (imageService) Add(img *common.Image) (int64, error) {
	err := vars.Database.Clauses(clause.OnConflict{
		UpdateAll: true,
	}).Create(img).Error
	return img.ID, err
}

func (imageService) ImageHashExists(hash string) (bool, error) {
	var count int64
	err := vars.Database.Model(&common.Image{}).Where("hash = ?", hash).Count(&count).Error
	return count > 0, err
}

func (imageService) GetByID(id int64) (*common.Image, error) {
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

func (imageService) GetByHash(hash string) (*common.Image, error) {
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
