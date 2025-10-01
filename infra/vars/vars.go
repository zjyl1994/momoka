package vars

import (
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/speps/go-hashids"
	"github.com/zjyl1994/cap-go"
	"gorm.io/gorm"
)

var (
	DebugMode             bool
	ListenAddr            string
	DataPath              string
	Secret                string
	Database              *gorm.DB
	S3Config              S3Conf
	S3Client              *s3.Client
	S3Debug               bool
	HashID                *hashids.HashID
	AutoCleanDays         int
	AutoCleanItems        int
	BootTime              time.Time
	BaseURL               string
	SiteName              string
	CapInstance           cap.ICap
	SkipAuth              bool
	ImageConverter        ImageConverterIFace
	AutoConvFormat        []string
	TotalImageClick       atomic.Int64
	TotalImageBandwidth   atomic.Int64
	GlobalYearMonth       atomic.Int64
	MonthlyImageClick     atomic.Int64
	MonthlyImageBandwidth atomic.Int64
)

type S3Conf struct {
	Endpoint  string
	Region    string
	AccessID  string
	SecretKey string
	Bucket    string
	Prefix    string
}

type ImageConverterIFace interface {
	Convert(inputFile, outFile string)
}
