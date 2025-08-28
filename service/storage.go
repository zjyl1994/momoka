package service

import (
	"context"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/vars"
)

var StorageService = &storageService{}

type storageService struct{}

// Upload 上传文件到S3
func (s *storageService) Upload(ctx context.Context, diskPath, remotePath, contentType string) error {
	// 打开本地文件
	file, err := os.Open(diskPath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 构建完整的远程路径
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)

	// 使用uploader进行上传，自动处理分片上传
	uploader := manager.NewUploader(vars.S3Client)
	output, err := uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(vars.S3Config.Bucket),
		ContentType: aws.String(contentType),
		Key:         aws.String(fullRemotePath),
		Body:        file,
	})

	logrus.Debugln("Upload S3", output, err)

	return err
}

// Download 从S3下载文件
func (s *storageService) Download(ctx context.Context, remotePath, diskPath string) error {
	// 构建完整的远程路径
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)

	// 从S3获取对象
	resp, err := vars.S3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(vars.S3Config.Bucket),
		Key:    aws.String(fullRemotePath),
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 确保目标目录存在
	dir := filepath.Dir(diskPath)
	if e := os.MkdirAll(dir, 0755); e != nil {
		return e
	}

	// 创建本地文件
	file, err := os.Create(diskPath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 将S3对象内容写入本地文件
	_, err = io.Copy(file, resp.Body)
	return err
}

func (s *storageService) Delete(ctx context.Context, remotePath string) error {
	// 构建完整的远程路径
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)
	// 删除S3对象
	_, err := vars.S3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(vars.S3Config.Bucket),
		Key:    aws.String(fullRemotePath),
	})
	if err != nil {
		return err
	}
	return nil
}
