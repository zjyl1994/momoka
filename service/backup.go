package service

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/samber/lo"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type backupService struct{}

var BackupService = &backupService{}

func (s *backupService) GenerateMetadata() ([]byte, error) {
	var images []common.Image
	if err := vars.Database.Find(&images).Error; err != nil {
		return nil, err
	}
	var imageTags []common.ImageTags
	if err := vars.Database.Find(&imageTags).Error; err != nil {
		return nil, err
	}
	var settings []common.Setting
	if err := vars.Database.Find(&settings).Error; err != nil {
		return nil, err
	}
	result := common.BackupFormat{
		Version:   common.BACKUP_FILE_VERSION,
		Images:    images,
		ImageTags: imageTags,
		Settings:  settings,
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
	if result.Version > common.BACKUP_FILE_VERSION {
		return errors.New("backup file version is not supported")
	}
	return vars.Database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.Image{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&result.Images, 100).Error; err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&common.ImageTags{}).Error; err != nil {
			return err
		}
		if err := tx.CreateInBatches(&result.ImageTags, 100).Error; err != nil {
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
	list, err := StorageService.List(context.Background(), "backup")
	if err != nil {
		return nil, err
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].ModTime.After(list[j].ModTime)
	})
	return list, nil
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

func (s *backupService) DeleteBackup(name string) error {
	return StorageService.Delete(context.Background(), filepath.Join("backup", name))
}

func BackgroundBackupTask(ctx context.Context) {
	today := time.Now().Format("2006-01-02")
	// 加载备份状态
	backupDay, err := SettingService.Get(common.SETTING_KEY_AUTO_BACKUP_DAY)
	if err != nil {
		logrus.Errorf("GetSetting failed: %v", err)
		return
	}

	if backupDay == today { // 今天已备份，跳过
		return
	}
	// 列出已有备份，只保留5个自动备份
	backups, err := BackupService.ListBackups()
	if err != nil {
		logrus.Errorf("ListBackups failed: %v", err)
		return
	}
	autoBackups := lo.Filter(backups, func(item common.FileInfo, index int) bool {
		return strings.HasSuffix(item.Name, ".auto")
	})
	if len(autoBackups) > 5 {
		// 排序，保留最新的5个
		sort.Slice(autoBackups, func(i, j int) bool {
			return autoBackups[i].ModTime.After(autoBackups[j].ModTime)
		})
		// 删除旧的备份
		for i := 5; i < len(autoBackups); i++ {
			if err := StorageService.Delete(context.Background(), filepath.Join("backup", autoBackups[i].Name)); err != nil {
				logrus.Errorf("Delete backup %s failed: %v", autoBackups[i].Name, err)
			}
		}
	}
	// 生成新的自动备份
	if err := BackupService.MakeBackup(today + ".auto"); err != nil {
		logrus.Errorf("MakeBackup failed: %v", err)
	}
	// 更新备份信息
	if err := SettingService.Set(common.SETTING_KEY_AUTO_BACKUP_DAY, today); err != nil {
		logrus.Errorf("SetSetting failed: %v", err)
	}
}
