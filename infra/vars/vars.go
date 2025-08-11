package vars

import "gorm.io/gorm"

var (
	DebugMode  bool
	ListenAddr string
	DataPath   string
	Database   *gorm.DB
	S3Config   S3Conf
)

type S3Conf struct {
	Endpoint  string
	Region    string
	AccessID  string
	SecretKey string
	Bucket    string
	Prefix    string
}
