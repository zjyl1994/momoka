package server

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
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

func UploadImageHandler(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return err
	}

	var folderID int64
	folderID, err = parseFolderID(c.FormValue("folder_id"))
	if err != nil {
		logrus.Errorln("parse folder id failed: ", err)
	}
	if folderID != 0 {
		folder, e := service.ImageFolderService.Get(folderID)
		if e != nil {
			return e
		}
		if folder == nil {
			return errors.New("folder not found")
		}
	}

	imageHash, err := utils.MultipartFileHeaderHash(fileHeader)
	if err != nil {
		return err
	}
	extName := filepath.Ext(fileHeader.Filename)
	// 写磁盘缓存
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
	// 写入DB
	now := time.Now().Unix()
	imgObj := &common.Image{
		Hash:        imageHash,
		ExtName:     extName,
		ContentType: fileHeader.Header.Get("Content-Type"),
		FileSize:    fileHeader.Size,
		FileName:    filepath.Base(fileHeader.Filename),
		CreateTime:  now,
		UpdateTime:  now,
		FolderID:    folderID,
	}
	imgID, err := service.ImageService.Add(imgObj)
	if err != nil {
		return err
	}
	logrus.Debugf("image_id: %d\n", imgID)
	// 生成链接
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.HID_TYPE_IMAGE, imgID})
	if err != nil {
		return err
	}

	outputUrl := c.BaseURL() + "/i/" + imageHashId + extName
	return c.SendString(outputUrl)
}

func GetImageHandler(c *fiber.Ctx) error {
	fileName := c.Params("filename")

	localPath, err := getImageSf.Do(fileName, func() (string, error) {
		extName := filepath.Ext(fileName)
		imageHashId := strings.TrimSuffix(filepath.Base(fileName), extName)

		imageId, err := vars.HashID.DecodeInt64WithError(imageHashId)
		if err != nil {
			return "", err
		}
		if len(imageId) != 2 || imageId[0] != common.HID_TYPE_IMAGE {
			return "", errors.New("invalid image id")
		}

		// 检查库里有没有，防止穿透到S3上产生404请求费用
		imgObj, err := service.ImageService.GetByID(imageId[1])
		if err != nil {
			return "", err
		}
		if imgObj == nil {
			return "", nil
		}

		// 加载图片实际路径
		cachePath := utils.GetImageCachePath(imgObj.Hash, extName)
		if !utils.FileExists(cachePath) {
			// 从S3下载
			err = service.StorageService.Download(imgObj.Hash+extName, cachePath)
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

func parseFolderID(val string) (int64, error) {
	if len(val) == 0 {
		return 0, nil
	}
	if val, err := strconv.ParseInt(val, 10, 64); err == nil {
		return val, nil
	}
	folderId, err := vars.HashID.DecodeInt64WithError(val)
	if err != nil {
		return 0, err
	}
	if len(folderId) != 2 || folderId[0] != common.HID_TYPE_FOLDER {
		return 0, errors.New("invalid folder id")
	}
	return folderId[1], nil
}
