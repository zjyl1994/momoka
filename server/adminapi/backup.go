package adminapi

import (
	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/service"
)

func GenerateBackupHandler(c *fiber.Ctx) error {
	data, err := service.BackupService.GenerateMetadata()
	if err != nil {
		return err
	}
	data, err = utils.CompressBrotli(data)
	if err != nil {
		return err
	}
	c.Set("Content-Type", "application/octet-stream")
	c.Set("Content-Disposition", "attachment; filename=momoka.bin")
	return c.Send(data)
}

func RestoreBackupHandler(c *fiber.Ctx) error {
	body := c.Body()
	data, err := utils.DecompressBrotli(body)
	if err != nil {
		return err
	}
	err = service.BackupService.RestoreMetadata(data)
	if err != nil {
		return err
	}
	return c.SendString("ok")
}
