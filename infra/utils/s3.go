package utils

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/logging"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/vars"
)

type s3Logger struct{}

func (s3Logger) Logf(classification logging.Classification, format string, v ...interface{}) {
	switch classification {
	case logging.Warn:
		logrus.Warnf(format, v...)
	case logging.Debug:
		logrus.Debugf(format, v...)
	}
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
	// 设置日志
	opts = append(opts, config.WithLogger(new(s3Logger)))
	opts = append(opts, config.WithClientLogMode(aws.LogRequest|aws.LogResponse))
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
			o.UsePathStyle = true                                                     // 对于自定义端点通常使用路径样式
			o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired // 停用checksum防止其他S3兼容实现失败
		})
	}

	// 创建S3客户端
	s3Client := s3.NewFromConfig(cfg, s3Opts...)

	return s3Client, nil
}
