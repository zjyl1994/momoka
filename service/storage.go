package service

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
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
	uploader := manager.NewUploader(vars.S3Client, func(u *manager.Uploader) {
		u.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
	})
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

func (s *storageService) List(ctx context.Context, prefix string) ([]common.FileInfo, error) {
	// Construct full remote path with S3 prefix
	fullPrefix := filepath.Join(vars.S3Config.Prefix, prefix)

	// List objects from S3
	resp, err := vars.S3Client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(vars.S3Config.Bucket),
		Prefix: aws.String(fullPrefix),
	})
	if err != nil {
		return nil, err
	}

	// Convert S3 objects to FileInfo slice
	fileInfos := make([]common.FileInfo, 0)
	for _, obj := range resp.Contents {
		if obj.Key == nil || obj.Size == nil || obj.LastModified == nil {
			continue
		}

		// Remove S3 prefix from key to get relative path
		relativePath := *obj.Key
		if vars.S3Config.Prefix != "" {
			relativePath = filepath.Clean(relativePath[len(vars.S3Config.Prefix):])
			if relativePath == "." {
				relativePath = ""
			}
		}

		// Extract file name and extension
		fileName := filepath.Base(relativePath)
		ext := filepath.Ext(fileName)

		fileInfos = append(fileInfos, common.FileInfo{
			Name:    fileName,
			Ext:     ext,
			Path:    relativePath,
			Size:    *obj.Size,
			ModTime: *obj.LastModified,
		})
	}

	return fileInfos, nil
}

// UploadFromMem uploads data from memory to S3
func (s *storageService) UploadFromMem(ctx context.Context, data []byte, remotePath, contentType string) error {
	// Construct full remote path
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)

	// Use uploader for upload with automatic multipart handling
	uploader := manager.NewUploader(vars.S3Client, func(u *manager.Uploader) {
		u.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
	})
	output, err := uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(vars.S3Config.Bucket),
		ContentType: aws.String(contentType),
		Key:         aws.String(fullRemotePath),
		Body:        bytes.NewReader(data),
	})

	logrus.Debugln("UploadFromMem S3", output, err)

	return err
}

// DownloadToMem downloads data from S3 to memory
func (s *storageService) DownloadToMem(ctx context.Context, remotePath string) ([]byte, error) {
	// Construct full remote path
	fullRemotePath := filepath.Join(vars.S3Config.Prefix, remotePath)

	// Get object from S3
	resp, err := vars.S3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(vars.S3Config.Bucket),
		Key:    aws.String(fullRemotePath),
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Read all data into memory
	return io.ReadAll(resp.Body)
}
