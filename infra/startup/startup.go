package startup

import (
	"context"
	"os"
	"os/exec"
	"strconv"
	"time"

	_ "github.com/joho/godotenv/autoload"
	gorm_logrus "github.com/onrik/gorm-logrus"
	"github.com/sirupsen/logrus"
	"github.com/speps/go-hashids"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/server"
	"github.com/zjyl1994/momoka/service"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Startup() (err error) {
	vars.BootTime = time.Now()
	vars.DebugMode, _ = strconv.ParseBool(os.Getenv("MOMOKA_DEBUG"))
	if vars.DebugMode {
		logrus.SetLevel(logrus.DebugLevel)
		logrus.Debugln("Momoka in DEBUG mode.")
	}

	if val, e := exec.LookPath("cwebp"); e == nil {
		vars.CwebpBin = val
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

	vars.AutoCleanDays, err = strconv.Atoi(utils.COALESCE(os.Getenv("MOMOKA_AUTO_CLEAN_DAYS"), "7"))
	if err != nil {
		return err
	}
	vars.AutoCleanItems, err = strconv.Atoi(utils.COALESCE(os.Getenv("MOMOKA_AUTO_CLEAN_ITEMS"), "300"))
	if err != nil {
		return err
	}

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

	err = vars.Database.AutoMigrate(&common.Image{}, &common.ImageFolder{}, &common.Setting{})
	if err != nil {
		return err
	}
	err = service.SettingService.SetIfNotExists(common.SETTING_KEY_ADMIN_USER, common.DEFAULT_ADMIN_USER)
	if err != nil {
		return err
	}
	defaultPass, err := bcrypt.GenerateFromPassword([]byte(common.DEFAULT_ADMIN_PASSWORD), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	err = service.SettingService.SetIfNotExists(common.SETTING_KEY_ADMIN_PASSWORD, string(defaultPass))
	if err != nil {
		return err
	}

	if vars.AutoCleanDays > 0 || vars.AutoCleanItems > 0 {
		// 后台线程自动清理本地缓存
		go utils.RunTickerTask(context.Background(), time.Hour, true, func(context.Context) {
			logrus.Infoln("Auto cache cleanup start...")
			cleanCount, err := utils.CleanCacheByModTime(utils.DataPath("cache"), vars.AutoCleanDays, vars.AutoCleanItems)
			if err != nil {
				logrus.Errorf("Auto cache cleanup failed: %v", err)
			} else {
				logrus.Infof("Auto cleanup %d cache file(s)", cleanCount)
			}
		})
	}
	// 启动后台自动备份服务
	go utils.RunTickerTask(context.Background(), time.Hour, true, service.BackgroundBackupTask)

	return server.Run(vars.ListenAddr)
}
