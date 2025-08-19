package server

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/service"
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

	imgObj := &common.Image{
		Hash:        imageHash,
		ExtName:     extName,
		ContentType: fileHeader.Header.Get("Content-Type"),
		FileSize:    fileHeader.Size,
		FileName:    filepath.Base(fileHeader.Filename),
		UploadTime:  time.Now().Unix(),
	}
	imgID, err := service.ImageService.Add(imgObj)
	if err != nil {
		return err
	}
	logrus.Debugf("image_id: %d\n", imgID)

	cachePath := utils.GetImageCachePath(imageHash, extName)
	err = os.MkdirAll(filepath.Dir(cachePath), 0755)
	if err != nil {
		return err
	}
	err = c.SaveFile(fileHeader, cachePath)
	if err != nil {
		return err
	}
	// 上传到S3
	err = service.StorageService.Upload(cachePath, imageHash+extName)
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
		// 从S3下载
		err = service.StorageService.Download(imageHash+extName, cachePath)
		if err != nil {
			return err
		}
	}
	return c.SendFile(cachePath)
}
