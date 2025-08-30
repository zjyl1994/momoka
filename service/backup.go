package service

import (
	"context"
	"encoding/json"
	"path/filepath"

	"github.com/sirupsen/logrus"
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
	result := common.BackupFormat{
		Version:     1,
		ImageFolder: folders,
		Images:      images,
		Settings:    settings,
	}
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
	var result common.BackupFormat
	if err := json.Unmarshal(extracted, &result); err != nil {
		return err
	}
	return vars.Database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.ImageFolder{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&result.ImageFolder, 100).Error; err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.Image{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&result.Images, 100).Error; err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.Setting{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&result.Settings, 100).Error; err != nil {
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
	logrus.Debugln("ApplyBackup", name, len(data))
	if err := s.RestoreMetadata(data); err != nil {
		return err
	}
	return nil
}
