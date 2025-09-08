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

	// 按操作类型分组任务
	uploadTasks := make([]*common.S3Task, 0)
	deleteTasks := make([]*common.S3Task, 0)

	for _, task := range tasks {
		switch task.Action {
		case common.S3TASK_ACTION_UPLOAD:
			uploadTasks = append(uploadTasks, task)
		case common.S3TASK_ACTION_DELETE:
			deleteTasks = append(deleteTasks, task)
		}
	}

	// 处理上传任务（单个处理）
	for _, task := range uploadTasks {
		logrus.Infof("run upload task %d", task.ID)
		s.processUploadTask(task)
	}

	// 批量处理删除任务
	if len(deleteTasks) > 0 {
		logrus.Infof("run batch delete tasks, count: %d", len(deleteTasks))
		s.processBatchDeleteTasks(deleteTasks)
	}
}

// processUploadTask 处理单个上传任务
func (s *s3TaskService) processUploadTask(task *common.S3Task) {
	ctx := context.Background()
	var taskStatus int32

	contentType, err := utils.GetFileContentType(task.LocalPath)
	if err != nil {
		logrus.Errorln("get file content type failed", err)
		taskStatus = common.S3TASK_STATUS_FAILED
	} else {
		if err := StorageService.Upload(ctx, task.LocalPath, task.RemotePath, contentType); err != nil {
			logrus.Errorln("upload task failed", err)
			taskStatus = common.S3TASK_STATUS_FAILED
		} else {
			taskStatus = common.S3TASK_STATUS_SUCCESS
		}
	}

	if err := vars.Database.Model(&common.S3Task{}).Where("id = ?", task.ID).Update("status", taskStatus).Error; err != nil {
		logrus.Errorln("update upload task status failed", err)
	}
}

// processBatchDeleteTasks 批量处理删除任务
func (s *s3TaskService) processBatchDeleteTasks(tasks []*common.S3Task) {
	ctx := context.Background()

	// 提取所有远程路径
	remotePaths := make([]string, len(tasks))
	taskMap := make(map[string]*common.S3Task)
	for i, task := range tasks {
		remotePaths[i] = task.RemotePath
		taskMap[task.RemotePath] = task
	}

	// 批量删除
	failedPaths, err := StorageService.DeleteObjs(ctx, remotePaths)
	if err != nil {
		logrus.Errorln("batch delete failed", err)
		// 如果整个批量删除失败，将所有任务标记为失败
		for _, task := range tasks {
			if updateErr := vars.Database.Model(&common.S3Task{}).Where("id = ?", task.ID).Update("status", common.S3TASK_STATUS_FAILED).Error; updateErr != nil {
				logrus.Errorln("update delete task status failed", updateErr)
			}
		}
		return
	}

	// 创建失败路径的集合，用于快速查找
	failedPathSet := make(map[string]bool)
	for _, path := range failedPaths {
		failedPathSet[path] = true
	}

	// 更新任务状态
	for _, task := range tasks {
		var taskStatus int32
		if failedPathSet[task.RemotePath] {
			taskStatus = common.S3TASK_STATUS_FAILED
			logrus.Errorf("delete task %d failed for path: %s", task.ID, task.RemotePath)
		} else {
			taskStatus = common.S3TASK_STATUS_SUCCESS
		}

		if err := vars.Database.Model(&common.S3Task{}).Where("id = ?", task.ID).Update("status", taskStatus).Error; err != nil {
			logrus.Errorln("update delete task status failed", err)
		}
	}

	logrus.Infof("batch delete completed, success: %d, failed: %d", len(tasks)-len(failedPaths), len(failedPaths))
}
