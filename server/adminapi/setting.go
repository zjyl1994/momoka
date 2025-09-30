package adminapi

import (
	"path/filepath"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
	"golang.org/x/crypto/bcrypt"
)

func ListSettingHandler(c *fiber.Ctx) error {
	settingList, err := service.SettingService.List()
	if err != nil {
		return err
	}
	delete(settingList, common.SETTING_KEY_ADMIN_PASSWORD)
	delete(settingList, common.SETTING_KEY_SYSTEM_RAND_SECRET)
	return c.JSON(settingList)
}

func UpdateSettingHandler(c *fiber.Ctx) error {
	var req map[string]string
	if err := c.BodyParser(&req); err != nil {
		return err
	}
	for k, v := range req {
		switch k {
		case common.SETTING_KEY_ADMIN_PASSWORD:
			b, err := bcrypt.GenerateFromPassword([]byte(v), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			req[k] = string(b)
		}
	}
	if err := service.SettingService.BulkSet(req); err != nil {
		return err
	}
	if _, ok := req[common.SETTING_KEY_BASE_URL]; ok {
		vars.BaseURL = req[common.SETTING_KEY_BASE_URL]
	}
	if _, ok := req[common.SETTING_KEY_SITE_NAME]; ok {
		vars.SiteName = req[common.SETTING_KEY_SITE_NAME]
	}

	// 动态更新自动转换格式设置
	needUpdateAutoConv := false
	if _, hasWebp := req[common.SETTING_KEY_AUTO_CONV_WEBP]; hasWebp {
		needUpdateAutoConv = true
	}
	if _, hasAvif := req[common.SETTING_KEY_AUTO_CONV_AVIF]; hasAvif {
		needUpdateAutoConv = true
	}
	if needUpdateAutoConv {
		updateAutoConvFormat()
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func GetReadonlySettingHandler(c *fiber.Ctx) error {
	absPath, err := filepath.Abs(vars.DataPath)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"s3_endpoint":      vars.S3Config.Endpoint,
		"s3_bucket":        vars.S3Config.Bucket,
		"s3_region":        vars.S3Config.Region,
		"s3_access_id":     vars.S3Config.AccessID,
		"s3_prefix":        vars.S3Config.Prefix,
		"data_path":        absPath,
		"auto_clean_days":  vars.AutoCleanDays,
		"auto_clean_items": vars.AutoCleanItems,
		"boot_time":        vars.BootTime.Unix(),
		"boot_since":       int64(time.Since(vars.BootTime).Seconds()),
	})
}

// updateAutoConvFormat 动态更新自动转换格式配置
func updateAutoConvFormat() {
	// 清空当前配置
	vars.AutoConvFormat = vars.AutoConvFormat[:0]

	// 从数据库重新读取设置
	autoConvWebp, err := service.SettingService.Get(common.SETTING_KEY_AUTO_CONV_WEBP)
	if err != nil {
		logrus.Errorf("Failed to get webp setting: %v", err)
		return
	}

	autoConvAvif, err := service.SettingService.Get(common.SETTING_KEY_AUTO_CONV_AVIF)
	if err != nil {
		logrus.Errorf("Failed to get avif setting: %v", err)
		return
	}

	// 根据设置启用自动转换格式
	if val, _ := strconv.ParseBool(autoConvWebp); val {
		vars.AutoConvFormat = append(vars.AutoConvFormat, common.IMAGE_TYPE_WEBP)
	}
	if val, _ := strconv.ParseBool(autoConvAvif); val {
		vars.AutoConvFormat = append(vars.AutoConvFormat, common.IMAGE_TYPE_AVIF)
	}
	logrus.Debugln("Update auto convert format: ", vars.AutoConvFormat)
}
