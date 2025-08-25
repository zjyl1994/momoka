package adminapi

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

func GetImageHandler(c *fiber.Ctx) error {
	id := int64(c.QueryInt("id"))
	if id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "id is required",
		})
	}

	img, err := service.ImageService.GetByID(id)
	if err != nil {
		return err
	}
	if img == nil {
		return errors.New("image not found")
	}

	imageURL, err := getImageURL(c, img)
	if err != nil {
		return err
	}
	img.URL = imageURL
	return c.JSON(img)
}

func UpdateImageHandler(c *fiber.Ctx) error {
	id := int64(c.QueryInt("id"))
	if id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "id is required",
		})
	}

	var req common.ImageReq
	if err := c.BodyParser(&req); err != nil {
		logrus.Errorf("BodyParser failed, err: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}
	if req.FileName == nil && req.FolderID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.FileName != nil {
		err := service.ImageService.Rename(id, *req.FileName)
		if err != nil {
			logrus.Errorf("Rename failed, err: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "rename failed",
			})
		}
	}
	if req.FolderID != nil {
		err := service.ImageService.Move(id, *req.FolderID)
		if err != nil {
			logrus.Errorf("Move failed, err: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "move failed",
			})
		}
	}

	img, err := service.ImageService.GetByID(id)
	if err != nil {
		return err
	}
	if img == nil {
		return errors.New("image not found")
	}

	return c.JSON(img)
}

func DeleteImageHandler(c *fiber.Ctx) error {
	id := int64(c.QueryInt("id"))
	if id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "id is required",
		})
	}

	img, err := service.ImageService.GetByID(id)
	if err != nil {
		return err
	}
	if img == nil {
		return errors.New("image not found")
	}

	err = service.ImageService.Delete(img)
	if err != nil {
		return err
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func CreateImageHandler(c *fiber.Ctx) error {
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
	imageURL, err := getImageURL(c, imgObj)
	if err != nil {
		return err
	}
	return c.SendString(imageURL)
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

func getImageURL(c *fiber.Ctx, img *common.Image) (string, error) {
	imageHashId, err := vars.HashID.EncodeInt64([]int64{common.HID_TYPE_IMAGE, img.ID})
	if err != nil {
		return "", err
	}
	return c.BaseURL() + "/i/" + imageHashId + img.ExtName, nil
}
