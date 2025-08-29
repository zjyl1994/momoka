package adminapi

import (
	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/service"
)

func DashboardDataHandler(c *fiber.Ctx) error {
	fileCount, totalSize, err := utils.GetFolderForDashboard(utils.DataPath("cache"))
	if err != nil {
		return err
	}
	imageCount, imageSize, err := service.ImageService.GetCountForDashboard()
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"count": fiber.Map{
			"image_count": imageCount,
			"image_size":  imageSize,
			"cache_count": fileCount,
			"cache_size":  totalSize,
		},
	})
}
