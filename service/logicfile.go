package service

import (
	"context"
	"errors"
	"mime/multipart"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type logicFileService struct {
}

var LogicFileService = &logicFileService{}

func (s *logicFileService) Get(id int64) (*common.LogicFile, error) {
	var logicFile common.LogicFile
	err := vars.Database.Where("id = ?", id).First(&logicFile).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("logic file not found")
		}
		return nil, err
	}
	err = s.fillModel(&logicFile)
	if err != nil {
		return nil, err
	}
	return &logicFile, nil
}

func (s *logicFileService) fillModel(m *common.LogicFile) error {
	m.RemotePath = m.Hash + m.ExtName
	m.LocalPath = utils.DataPath("cache", m.Hash[0:2], m.Hash[2:4], m.Hash+m.ExtName)
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.ENTITY_TYPE_FILE, m.ID})
	if err != nil {
		return err
	}
	m.URL = "/i/" + imageHashId + m.ExtName
	return nil
}

func (s *logicFileService) Save(file *multipart.FileHeader, logicPath string) (*common.LogicFile, error) {
	fileHash, err := utils.MultipartFileHeaderHash(file)
	if err != nil {
		return nil, err
	}

	m := common.LogicFile{
		Hash:        fileHash,
		ContentType: file.Header.Get("Content-Type"),
		FileSize:    file.Size,
		ExtName:     filepath.Ext(file.Filename),
	}
	err = s.fillModel(&m)
	if err != nil {
		return nil, err
	}
	// save file to localpath
	err = utils.SaveMultipartFile(file, m.LocalPath)
	if err != nil {
		logrus.Errorln("save file to localpath failed", err)
		return nil, err
	}

	err = vars.Database.Transaction(func(tx *gorm.DB) (err error) {
		err = S3TaskService.Add(tx, []*common.S3Task{
			{
				Action:     common.S3TASK_ACTION_UPLOAD,
				LocalPath:  m.LocalPath,
				RemotePath: m.RemotePath,
			},
		})
		if err != nil {
			return err
		}

		err = tx.Create(&m).Error
		if err != nil {
			return err
		}

		logrus.Debugln("create logic file success", m.ID)

		baseDir := filepath.Dir(logicPath)
		err = LogicPathService.Mkdir(tx, baseDir)
		if err != nil {
			return err
		}

		err = LogicPathService.Create(tx, logicPath, common.ENTITY_TYPE_FILE, m.ID)
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		logrus.Errorln("save file metadata failed", err)
		return nil, err
	}
	err = s.fillModel(&m)
	if err != nil {
		return nil, err
	}
	go S3TaskService.RunTask()
	return &m, nil
}

func (s *logicFileService) Download(file *common.LogicFile) error {
	err := s.fillModel(file)
	if err != nil {
		return err
	}
	return StorageService.Download(context.Background(), file.RemotePath, file.LocalPath)
}

func (s *logicFileService) Delete(file *common.LogicFile) error {
	err := s.fillModel(file)
	if err != nil {
		return err
	}
	err = vars.Database.Transaction(func(tx *gorm.DB) (err error) {
		err = tx.Delete(file).Error
		if err != nil {
			return err
		}
		err = LogicPathService.DeleteByEntity(tx, common.ENTITY_TYPE_FILE, file.ID)
		if err != nil {
			return err
		}
		err = S3TaskService.Add(tx, []*common.S3Task{
			{
				Action:     common.S3TASK_ACTION_DELETE,
				RemotePath: file.RemotePath,
			},
		})
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	os.Remove(file.LocalPath)
	go S3TaskService.RunTask()
	return nil
}
