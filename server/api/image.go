package api

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/service"
)

var bingImageSf utils.SingleFlight[string]

func GetBingTodayImageHandler(c *fiber.Ctx) error {
	todayStr := time.Now().Format("20060102")
	todayImageCachePath := utils.DataPath("cache", "bing-"+todayStr+".jpg")
	if utils.FileExists(todayImageCachePath) {
		return c.SendFile(todayImageCachePath)
	}

	_, err := bingImageSf.Do(todayStr, func() (string, error) {
		url, err := utils.GetBingTodayImage()
		if err != nil {
			return "", err
		}
		logrus.Debugln("Today bing image", url)
		err = utils.HttpDownload(url, todayImageCachePath)
		if err != nil {
			return "", err
		}
		logrus.Debugln("Today bing image cached.")
		return todayImageCachePath, nil
	})
	if err != nil {
		return err
	}
	return c.SendFile(todayImageCachePath)
}

func GetMasonryImageHandler(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	size := c.QueryInt("size", 10)
	images, total, err := service.ImageService.GetAllPublic(page, size)
	if err != nil {
		return err
	}
	result := make(map[int64]string)
	for _, image := range images {
		imageURL, err := utils.GetImageURL(c, &image)
		if err != nil {
			return err
		}
		result[image.ID] = imageURL
	}
	return c.JSON(fiber.Map{
		"total": total,
		"list":  result,
	})
}
