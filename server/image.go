package server

import (
	"errors"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

var getImageSf utils.SingleFlight[string]
var webpSf utils.SingleFlight[string]

func GetImageHandler(c *fiber.Ctx) error {
	fileName := c.Params("filename")

	localPath, err := getImageSf.Do(fileName, func() (string, error) {
		extName := filepath.Ext(fileName)
		imageHashId := strings.TrimSuffix(filepath.Base(fileName), extName)

		imageId, err := vars.HashID.DecodeInt64WithError(imageHashId)
		if err != nil {
			return "", err
		}
		if len(imageId) != 2 || imageId[0] != common.ENTITY_TYPE_FILE {
			return "", errors.New("invalid image id")
		}

		// 检查库里有没有，防止穿透到S3上产生404请求费用
		imgObj, err := service.LogicFileService.Get(imageId[1])
		if err != nil {
			return "", err
		}
		if imgObj == nil {
			return "", nil
		}

		// 加载图片实际路径
		if !utils.FileExists(imgObj.LocalPath) {
			// 从S3下载
			err = service.LogicFileService.Download(imgObj)
			if err != nil {
				return "", err
			}
		}
		return imgObj.LocalPath, nil
	})

	if err != nil {
		return err
	}
	if len(localPath) == 0 {
		return fiber.ErrNotFound
	}
	// 检查是否支持webp
	if vars.CwebpBin != "" && c.Accepts("image/webp") == "image/webp" {
		webpPath := strings.TrimSuffix(localPath, filepath.Ext(localPath)) + ".webp"
		if !utils.FileExists(webpPath) { // 本地缓存中没有，尝试生成
			if _, err = webpSf.Do(localPath, func() (string, error) {
				startTime := time.Now()
				// 转换为webp
				e := utils.ConvWebp(localPath, webpPath)
				logrus.Debugln("conv webp cost:", time.Since(startTime))
				return webpPath, e
			}); err == nil {
				localPath = webpPath
			}
		} else { // 提供已有的webp
			localPath = webpPath
		}
	}
	// 刷新文件时间,方便后续清理使用
	err = utils.TouchFile(localPath)
	if err != nil {
		return err
	}
	return c.SendFile(localPath)

}
