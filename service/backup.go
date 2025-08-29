package service

import (
	"encoding/json"
	"errors"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type backupService struct{}

var BackupService = &backupService{}

func (s *backupService) GenerateMetadata() ([]byte, error) {
	var folders []common.ImageFolder
	if err := vars.Database.Find(&folders).Error; err != nil {
		return nil, err
	}
	var images []common.Image
	if err := vars.Database.Find(&images).Error; err != nil {
		return nil, err
	}
	result := make(map[string]any)
	result["folders"] = folders
	result["images"] = images
	return json.Marshal(result)
}

func (s *backupService) RestoreMetadata(data []byte) error {
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return err
	}
	folders, ok := result["folders"].([]common.ImageFolder)
	if !ok {
		return errors.New("invalid metadata")
	}
	images, ok := result["images"].([]common.Image)
	if !ok {
		return errors.New("invalid metadata")
	}
	return vars.Database.Transaction(func(tx *gorm.DB) error {
		if err := tx.CreateInBatches(&folders, 100).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&images, 100).Error; err != nil {
			return err
		}
		return nil
	})
}
