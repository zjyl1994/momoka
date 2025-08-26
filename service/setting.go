package service

import (
	"errors"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

var SettingService = &settingService{}

type settingService struct{}

func (s *settingService) Get(name string) (string, error) {
	var setting common.Setting
	err := vars.Database.Where("name = ?", name).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	return setting.Data, nil
}

func (s *settingService) Set(name, data string) error {
	setting := common.Setting{
		Name: name,
		Data: data,
	}
	return vars.Database.Save(&setting).Error
}

func (s *settingService) Delete(name string) error {
	return vars.Database.Delete(&common.Setting{}, "name = ?", name).Error
}

func (s *settingService) List() (map[string]string, error) {
	var settings []common.Setting
	err := vars.Database.Find(&settings).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, setting := range settings {
		result[setting.Name] = setting.Data
	}
	return result, nil
}

func (s *settingService) SetIfNotExists(name, data string) error {
	var setting common.Setting
	err := vars.Database.Where("name = ?", name).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 如果记录不存在则创建新记录
			setting = common.Setting{
				Name: name,
				Data: data,
			}
			return vars.Database.Create(&setting).Error
		}
		return err
	}
	return nil
}

func (s *settingService) BulkSet(settings map[string]string) error {
	return vars.Database.Transaction(func(tx *gorm.DB) error {
		for k, v := range settings {
			setting := common.Setting{
				Name: k,
				Data: v,
			}
			if err := tx.Save(&setting).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
