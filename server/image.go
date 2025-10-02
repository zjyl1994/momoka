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

var getImageSf utils.SingleFlight[*common.Image]

func GetImageHandler(c *fiber.Ctx) error {
	fileName := c.Params("filename")
	// load image metadata from database
	imgObject, err := getImageSf.Do(fileName, func() (*common.Image, error) {
		extName := filepath.Ext(fileName)
		imageHashId := strings.TrimSuffix(filepath.Base(fileName), extName)

		imageId, err := vars.HashID.DecodeInt64WithError(imageHashId)
		if err != nil {
			return nil, err
		}
		if len(imageId) != 2 || imageId[0] != common.ENTITY_TYPE_FILE {
			return nil, errors.New("invalid image id")
		}

		// 检查库里有没有，防止穿透到S3上产生404请求费用
		imgObj, err := service.ImageService.PureGet(vars.Database, imageId[1])
		if err != nil {
			return nil, err
		}
		if imgObj == nil {
			return nil, nil
		}

		// 加载图片实际路径
		if !utils.FileExists(imgObj.LocalPath) {
			// 从S3下载
			err = service.ImageService.Download(imgObj)
			if err != nil {
				return nil, err
			}
		}
		return imgObj, nil
	})

	if err != nil {
		return err
	}
	if imgObject == nil || len(imgObject.LocalPath) == 0 {
		return fiber.ErrNotFound
	}
	// 处理自动图片转换
	localDiskPath := imgObject.LocalPath
	if accept := c.Accepts(vars.AutoConvFormat...); accept != "" && imgObject.ContentType != accept {
		targetPath := utils.ChangeExtName(localDiskPath, strings.TrimPrefix(accept, "image/"))

		if utils.FileExists(targetPath) {
			localDiskPath = targetPath
		} else {
			// 异步触发转换，本次请求仍然使用原始图片进行响应
			vars.ImageConverter.Convert(localDiskPath, targetPath)
		}
	}
	// 刷新文件访问时间,方便后续清理使用
	err = utils.TouchFile(localDiskPath)
	if err != nil {
		return err
	}
	// 记录点击次数和带宽消耗
	service.ImageCounterService.Incr(localDiskPath)
	// 设置客户端缓存控制
	c.Set("Cache-Control", "public, max-age=2592000") // 公开缓存30天
	return c.SendFile(localDiskPath)
}
