package startup

import (
	"context"
	"os"
	"strconv"

	_ "github.com/joho/godotenv/autoload"
	gorm_logrus "github.com/onrik/gorm-logrus"
	"github.com/sirupsen/logrus"
	"github.com/speps/go-hashids"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/server"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Startup() (err error) {
	vars.DebugMode, _ = strconv.ParseBool(os.Getenv("MOMOKA_DEBUG"))
	if vars.DebugMode {
		logrus.SetLevel(logrus.DebugLevel)
		logrus.Debugln("Momoka in DEBUG mode.")
	}

	vars.S3Config = vars.S3Conf{
		Endpoint:  os.Getenv("MOMOKA_S3_ENDPOINT"),
		Region:    os.Getenv("MOMOKA_S3_REGION"),
		AccessID:  os.Getenv("MOMOKA_S3_ACCESS_ID"),
		SecretKey: os.Getenv("MOMOKA_S3_SECRET_KEY"),
		Bucket:    os.Getenv("MOMOKA_S3_BUCKET"),
		Prefix:    utils.COALESCE(os.Getenv("MOMOKA_S3_PREFIX"), "momoka"),
	}
	vars.S3Client, err = utils.InitS3Client(context.Background(), vars.S3Config)
	if err != nil {
		return err
	}

	vars.ListenAddr = utils.COALESCE(os.Getenv("MOMOKA_LISTEN_ADDR"), ":8080")
	vars.Secret = utils.COALESCE(os.Getenv("MOMOKA_SECRET"), "momoka")

	hd := hashids.NewData()
	hd.Salt = vars.Secret
	hd.MinLength = 6
	vars.HashID, err = hashids.NewWithData(hd)
	if err != nil {
		return err
	}

	vars.DataPath = os.Getenv("MOMOKA_DATA_PATH")
	err = os.MkdirAll(vars.DataPath, 0755)
	if err != nil {
		return err
	}

	databasePath := utils.DataPath("momoka.db")
	vars.Database, err = gorm.Open(sqlite.Open(databasePath), &gorm.Config{
		Logger: gorm_logrus.New(),
	})
	if err != nil {
		return err
	}
	err = vars.Database.Exec("PRAGMA journal_mode=WAL;").Error
	if err != nil {
		return err
	}

	err = vars.Database.AutoMigrate(&common.Image{})
	if err != nil {
		return err
	}

	return server.Run(vars.ListenAddr)
}
