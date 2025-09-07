package adminapi

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

func UploadFileHandler(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "file parameter is required",
		})
	}
	path := c.FormValue("path")
	if !strings.HasSuffix(path, "/") {
		path += "/"
	}
	path += file.Filename

	logicFile, err := service.LogicFileService.Save(file, path)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "save file failed",
		})
	}

	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}
	logicFile.URL = baseUrl + logicFile.URL

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"file": logicFile,
	})
}
