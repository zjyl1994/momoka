package adminapi

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/service"
)

type backupReq struct {
	Name string `json:"name"`
}

func GenerateBackupHandler(c *fiber.Ctx) error {
	var req backupReq
	err := c.BodyParser(&req)
	if err != nil {
		return err
	}
	if req.Name == "" {
		req.Name = time.Now().Format("20060102-150405")
	}
	if !strings.HasSuffix(req.Name, ".bin") {
		req.Name += ".bin"
	}
	err = service.BackupService.MakeBackup(req.Name)
	if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func RestoreBackupHandler(c *fiber.Ctx) error {
	var req backupReq
	err := c.BodyParser(&req)
	if err != nil {
		return err
	}
	err = service.BackupService.ApplyBackup(req.Name)
	if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func ListBackupHandler(c *fiber.Ctx) error {
	backups, err := service.BackupService.ListBackups()
	if err != nil {
		return err
	}
	return c.JSON(backups)
}

func DeleteBackupHandler(c *fiber.Ctx) error {
	name := c.Query("name")
	if err := service.BackupService.DeleteBackup(name); err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}
