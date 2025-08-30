package service

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"

	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
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
	var settings []common.Setting
	if err := vars.Database.Find(&settings).Error; err != nil {
		return nil, err
	}
	result := make(map[string]any)
	result["version"] = 1
	result["folders"] = folders
	result["images"] = images
	result["settings"] = settings
	data, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	return utils.CompressBrotli(data)
}

func (s *backupService) RestoreMetadata(data []byte) error {
	extracted, err := utils.DecompressBrotli(data)
	if err != nil {
		return err
	}
	var result map[string]any
	if err := json.Unmarshal(extracted, &result); err != nil {
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
	settings, ok := result["settings"].([]common.Setting)
	if !ok {
		return errors.New("invalid metadata")
	}
	return vars.Database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.ImageFolder{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&folders, 100).Error; err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.Image{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&images, 100).Error; err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.Setting{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&settings, 100).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *backupService) MakeBackup(name string) error {
	data, err := s.GenerateMetadata()
	if err != nil {
		return err
	}

	return StorageService.UploadFromMem(context.Background(), data, filepath.Join("backup", name), "application/octet-stream")
}

func (s *backupService) ListBackups() ([]common.FileInfo, error) {
	return StorageService.List(context.Background(), "backup")
}

func (s *backupService) ApplyBackup(name string) error {
	data, err := StorageService.DownloadToMem(context.Background(), filepath.Join("backup", name))
	if err != nil {
		return err
	}
	return s.RestoreMetadata(data)
}
