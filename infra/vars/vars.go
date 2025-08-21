package vars

import (
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/speps/go-hashids"
	"gorm.io/gorm"
)

var (
	DebugMode  bool
	ListenAddr string
	DataPath   string
	Secret     string
	Database   *gorm.DB
	S3Config   S3Conf
	S3Client   *s3.Client
	HashID     *hashids.HashID
)

type S3Conf struct {
	Endpoint  string
	Region    string
	AccessID  string
	SecretKey string
	Bucket    string
	Prefix    string
}
