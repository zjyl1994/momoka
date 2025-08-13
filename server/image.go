package server

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/utils"
)

func UploadImageHandler(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return err
	}
	imageHash, err := utils.MultipartFileHeaderHash(fileHeader)
	if err != nil {
		return err
	}
	extName := filepath.Ext(fileHeader.Filename)
	cachePath := utils.GetImageCachePath(imageHash, extName)
	err = os.MkdirAll(filepath.Dir(cachePath), 0755)
	if err != nil {
		return err
	}
	err = c.SaveFile(fileHeader, cachePath)
	if err != nil {
		return err
	}
	outputUrl := c.BaseURL() + "/i/" + imageHash + extName
	return c.SendString(outputUrl)
}

func GetImageHandler(c *fiber.Ctx) error {
	fileName := c.Params("filename")

	extName := filepath.Ext(fileName)
	imageHash := strings.TrimSuffix(filepath.Base(fileName), extName)

	cachePath := utils.GetImageCachePath(imageHash, extName)
	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		return fiber.ErrNotFound
	}
	return c.SendFile(cachePath)
}
