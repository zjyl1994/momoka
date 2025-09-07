package service

import (
	"context"
	"sync"
	"time"

	"github.com/samber/lo"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"gorm.io/gorm"
)

type s3TaskService struct {
	runnerLock          sync.Mutex
	getTaskSingleFlight utils.SingleFlight[[]*common.S3Task]
}

var S3TaskService = &s3TaskService{}

func (s *s3TaskService) Add(db *gorm.DB, task []*common.S3Task) error {
	return db.CreateInBatches(task, 100).Error
}

func (s *s3TaskService) getTasks() ([]*common.S3Task, error) {
	return s.getTaskSingleFlight.Do("waiting_tasks", func() ([]*common.S3Task, error) {
		var tasks []*common.S3Task
		err := vars.Database.Transaction(func(tx *gorm.DB) error {
			lockExpire := time.Now().Add(-10 * time.Minute).Unix()
			err := tx.Where("status = ?", common.S3TASK_STATUS_WAITING).
				Or("status = ?", common.S3TASK_STATUS_FAILED).
				Or(
					tx.Where("status = ?", common.S3TASK_STATUS_RUNNING).
						Where("locked_at < ?", lockExpire),
				).Find(&tasks).Error
			if err != nil {
				return err
			}

			if len(tasks) == 0 {
				return nil
			}

			taskIds := lo.Map(tasks, func(t *common.S3Task, _ int) int64 {
				return t.ID
			})
			return tx.Model(&common.S3Task{}).Where("id IN ?", taskIds).Updates(map[string]interface{}{
				"status":    common.S3TASK_STATUS_RUNNING,
				"locked_at": time.Now(),
			}).Error
		})

		return tasks, err
	})
}

func (s *s3TaskService) RunTask() {
	s.runnerLock.Lock()
	defer s.runnerLock.Unlock()

	tasks, err := s.getTasks()
	if err != nil {
		logrus.Errorln("get tasks failed", err)
		return
	}

	if len(tasks) == 0 {
		return
	}

	for _, task := range tasks {
		logrus.Infof("run task %d", task.ID)

		var taskStatus int32
		if err := s.runTask(task); err != nil {
			logrus.Errorln("run task failed", err)
			taskStatus = common.S3TASK_STATUS_FAILED
		} else {
			taskStatus = common.S3TASK_STATUS_SUCCESS
		}

		if err := vars.Database.Model(&common.S3Task{}).Where("id = ?", task.ID).Update("status", taskStatus).Error; err != nil {
			logrus.Errorln("update task status failed", err)
		}
	}
}

func (s *s3TaskService) runTask(task *common.S3Task) error {
	ctx := context.Background()
	switch task.Action {
	case common.S3TASK_ACTION_UPLOAD:
		contentType, err := utils.GetFileContentType(task.LocalPath)
		if err != nil {
			return err
		}
		return StorageService.Upload(ctx, task.LocalPath, task.RemotePath, contentType)
	case common.S3TASK_ACTION_DELETE:
		return StorageService.Delete(ctx, task.RemotePath)
	default:
		return nil
	}
}
