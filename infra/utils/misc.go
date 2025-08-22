package utils

import (
	"context"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/HugoSmits86/nativewebp"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/zjyl1994/momoka/infra/vars"
)

func COALESCE[T comparable](elem ...T) T {
	var empty T
	for _, item := range elem {
		if item != empty {
			return item
		}
	}
	return empty
}

func DataPath(paths ...string) string {
	return filepath.Join(append([]string{vars.DataPath}, paths...)...)
}

func GetImageCachePath(imageHash, extName string) string {
	return DataPath("cache", imageHash[0:2], imageHash[2:4], imageHash+extName)
}

// InitS3Client 初始化S3客户端 (AWS SDK Go v2)
func InitS3Client(ctx context.Context, conf vars.S3Conf) (*s3.Client, error) {
	// 创建静态凭据
	creds := credentials.NewStaticCredentialsProvider(
		conf.AccessID,
		conf.SecretKey,
		"", // session token，通常为空
	)

	// 配置选项
	var opts []func(*config.LoadOptions) error

	// 设置区域
	if conf.Region != "" {
		opts = append(opts, config.WithRegion(conf.Region))
	}

	// 设置凭据
	opts = append(opts, config.WithCredentialsProvider(creds))

	// 加载AWS配置
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, err
	}

	// S3客户端选项
	var s3Opts []func(*s3.Options)

	// 如果提供了自定义端点，则设置端点
	if conf.Endpoint != "" {
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(conf.Endpoint)
			o.UsePathStyle = true // 对于自定义端点通常使用路径样式
		})
	}

	// 创建S3客户端
	s3Client := s3.NewFromConfig(cfg, s3Opts...)

	return s3Client, nil
}

func TouchFile(filepath string) error {
	now := time.Now()
	return os.Chtimes(filepath, now, now)
}

// ConvWebp 将图片转换为WebP格式
func ConvWebp(inputFile, outFile string) error {
	ext := filepath.Ext(inputFile)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
		return nil // 不支持的格式无需转换
	}

	// 读取原始图片文件
	img, err := os.Open(inputFile)
	if err != nil {
		return err
	}
	defer img.Close()

	srcImage, _, err := image.Decode(img)
	if err != nil {
		return err
	}

	// 生成WebP文件
	file, err := os.Create(outFile)
	if err != nil {
		return err
	}
	defer file.Close()

	err = nativewebp.Encode(file, srcImage, nil)
	if err != nil {
		return err
	}
	return nil
}

// FileExists 检查文件是否存在
func FileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}
