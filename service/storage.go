package service

import (
	"context"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/zjyl1994/momoka/infra/vars"
)

var StorageService = &storageService{}

type storageService struct{}

// Upload 上传文件到S3
func (storageService) Upload(diskPath, remotePath string) error {
	// 打开本地文件
	file, err := os.Open(diskPath)
	if err != nil {
		return err
	}
	defer file.Close()

	// 构建完整的远程路径
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)

	// 上传文件到S3
	_, err = vars.S3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(vars.S3Config.Bucket),
		Key:    aws.String(fullRemotePath),
		Body:   file,
	})

	return err
}

// Download 从S3下载文件
func (storageService) Download(remotePath, diskPath string) error {
	// 构建完整的远程路径
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)

	// 从S3获取对象
	resp, err := vars.S3Client.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: aws.String(vars.S3Config.Bucket),
		Key:    aws.String(fullRemotePath),
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 确保目标目录存在
	dir := filepath.Dir(diskPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
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
