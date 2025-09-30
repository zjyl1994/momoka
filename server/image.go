package server

import (
	"errors"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

var getImageSf utils.SingleFlight[string]

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
		imgObj, err := service.ImageService.PureGet(vars.Database, imageId[1])
		if err != nil {
			return "", err
		}
		if imgObj == nil {
			return "", nil
		}

		// 加载图片实际路径
		if !utils.FileExists(imgObj.LocalPath) {
			// 从S3下载
			err = service.ImageService.Download(imgObj)
			if err != nil {
				return "", err
			}
		}
		// 检查是否支持 webp 和 avif，统一处理
		if accept := c.Accepts(vars.AutoConvFormat...); accept != "" && imgObj.ContentType != accept {
			targetPath := utils.ChangeExtName(imgObj.LocalPath, strings.TrimPrefix(accept, "image/"))

			if utils.FileExists(targetPath) {
				imgObj.LocalPath = targetPath
			} else {
				// 异步触发转换，本次请求仍然使用原始图片进行响应
				vars.ImageConverter.Convert(imgObj.LocalPath, targetPath)
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
	// 刷新文件访问时间,方便后续清理使用
	err = utils.TouchFile(localPath)
	if err != nil {
		return err
	}
	// 记录点击次数和带宽
	fileSize, err := utils.GetFileSize(localPath)
	if err != nil {
		return err
	}
	vars.TotalImageClick.Add(1)
	vars.TotalImageBandwidth.Add(fileSize)
	// 设置客户端缓存控制
	c.Set("Cache-Control", "public, max-age=2592000") // 公开缓存30天
	return c.SendFile(localPath)
}
