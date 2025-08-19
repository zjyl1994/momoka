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

var getImageSf utils.SingleFlight[string]

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

	localPath, err := getImageSf.Do(fileName, func() (string, error) {
		extName := filepath.Ext(fileName)
		imageHash := strings.TrimSuffix(filepath.Base(fileName), extName)
		// 检查库里有没有，防止穿透到S3上产生404请求费用
		exists, err := service.ImageService.ImageHashExists(imageHash)
		if err != nil {
			return "", err
		}
		if !exists {
			return "", nil
		}

		// 加载图片实际路径
		cachePath := utils.GetImageCachePath(imageHash, extName)
		if _, err := os.Stat(cachePath); os.IsNotExist(err) {
			// 从S3下载
			err = service.StorageService.Download(imageHash+extName, cachePath)
			if err != nil {
				return "", err
			}
		}
		return cachePath, nil
	})

	if err != nil {
		return err
	}
	if len(localPath) == 0 {
		return fiber.ErrNotFound
	} else {
		return c.SendFile(localPath)
	}
}
