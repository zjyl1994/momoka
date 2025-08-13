package service

import (
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
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

func (imageService) GetByHash(hash string) (*common.Image, error) {
	var img common.Image
	err := vars.Database.Where("hash = ?", hash).First(&img).Error
	return &img, err
}

func (imageService) GetByID(id int64) (*common.Image, error) {
	var img common.Image
	err := vars.Database.Where("id = ?", id).First(&img).Error
	return &img, err
}
