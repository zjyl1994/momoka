package adminapi

import (
	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/service"
	"golang.org/x/crypto/bcrypt"
)

func ListSettingHandler(c *fiber.Ctx) error {
	settingList, err := service.SettingService.List()
	if err != nil {
		return err
	}
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
	return c.SendStatus(fiber.StatusNoContent)
}
