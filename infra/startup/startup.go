package startup

import (
	"os"
	"strconv"

	_ "github.com/joho/godotenv/autoload"
	gorm_logrus "github.com/onrik/gorm-logrus"
	"github.com/sirupsen/logrus"
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
	vars.ListenAddr = utils.COALESCE(os.Getenv("MOMOKA_LISTEN_ADDR"), ":8080")
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

	return server.Run(vars.ListenAddr)
}
