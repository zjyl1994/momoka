package startup

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/joho/godotenv/autoload"
	gorm_logrus "github.com/onrik/gorm-logrus"
	"github.com/sirupsen/logrus"
	"github.com/speps/go-hashids"
	"github.com/zjyl1994/cap-go"
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
	var initialized bool

	vars.BootTime = time.Now()
	vars.DebugMode, _ = strconv.ParseBool(os.Getenv("MOMOKA_DEBUG"))
	if vars.DebugMode {
		logrus.SetLevel(logrus.DebugLevel)
		logrus.Debugln("Momoka in DEBUG mode.")
	}

	vars.SkipAuth, _ = strconv.ParseBool(os.Getenv("MOMOKA_SKIP_AUTH"))

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

	vars.AutoCleanDays, err = strconv.Atoi(utils.COALESCE(os.Getenv("MOMOKA_AUTO_CLEAN_DAYS"), "7"))
	if err != nil {
		return err
	}
	vars.AutoCleanItems, err = strconv.Atoi(utils.COALESCE(os.Getenv("MOMOKA_AUTO_CLEAN_ITEMS"), "300"))
	if err != nil {
		return err
	}

	vars.CapInstance = cap.NewCap(utils.NewFreeCacheStorage(100 * 1024))

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

	err = vars.Database.AutoMigrate(&common.Setting{}, &common.S3Task{}, &common.Image{}, &common.ImageTags{})
	if err != nil {
		return err
	}
	adminName, firstCreate, err := service.SettingService.SetIfNotExists(common.SETTING_KEY_ADMIN_USER, service.StringForNotExisting(common.DEFAULT_ADMIN_USER))
	if err != nil {
		return err
	}
	if firstCreate {
		logrus.Infoln("Create Admin User::", adminName)
	}
	adminPass, firstCreate, err := service.SettingService.SetIfNotExists(common.SETTING_KEY_ADMIN_PASSWORD, func() (showData, writeData string, err error) {
		randPass := utils.RandStr(8)
		hashedPass, err := bcrypt.GenerateFromPassword([]byte(randPass), bcrypt.DefaultCost)
		if err != nil {
			return "", "", err
		}
		return randPass, string(hashedPass), nil
	})
	if err != nil {
		return err
	}
	if firstCreate {
		logrus.Infoln("Create Admin Password::", adminPass)
	}
	// init secret if not exists
	secret, firstCreate, err := service.SettingService.SetIfNotExists(common.SETTING_KEY_SYSTEM_RAND_SECRET, service.StringForNotExisting(utils.RandStr(32)))
	if err != nil {
		return err
	}
	if firstCreate {
		logrus.Debugln("Create System Rand Secret::", secret)
	} else {
		initialized = true
		vars.Secret = secret
	}

	hd := hashids.NewData()
	hd.Salt = vars.Secret
	hd.MinLength = 6
	vars.HashID, err = hashids.NewWithData(hd)
	if err != nil {
		return err
	}
	// load base_url
	baseURL, err := service.SettingService.Get(common.SETTING_KEY_BASE_URL)
	if err != nil {
		return err
	}
	vars.BaseURL = strings.TrimSuffix(baseURL, "/")

	// load site_name
	siteName, err := service.SettingService.Get(common.SETTING_KEY_SITE_NAME)
	if err != nil {
		return err
	}
	if siteName == "" {
		siteName = "Momoka 图床"
	}
	vars.SiteName = siteName

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
	go utils.RunTickerTask(context.Background(), time.Hour, initialized, service.BackgroundBackupTask)

	return server.Run(vars.ListenAddr)
}
