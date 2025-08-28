package adminapi

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

	imageURL, err := utils.GetImageURL(c, img)
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
	ctx := c.Context()
	// Check if file exists in request
	fileHeader, err := c.FormFile("file")
	if err != nil {
		logrus.Errorf("Failed to get file from form: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No file provided or invalid file field",
		})
	}

	// Validate file size (max 50MB)
	if fileHeader.Size > common.MAX_IMAGE_SIZE {
		logrus.Errorf("File too large: %d bytes", fileHeader.Size)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File size exceeds 50MB limit",
		})
	}

	// Validate file type
	contentType := fileHeader.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		logrus.Errorf("Invalid file type: %s", contentType)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Only image files are allowed",
		})
	}

	var folderID int64
	folderIDStr := c.FormValue("folder_id")
	logrus.Debugf("Received folder_id: %s", folderIDStr)
	folderID, err = parseFolderID(folderIDStr)
	if err != nil {
		logrus.Errorf("Parse folder id failed: %v, input: %s", err, folderIDStr)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid folder_id format",
		})
	}
	if folderID != 0 {
		folder, e := service.ImageFolderService.Get(folderID)
		if e != nil {
			logrus.Errorf("Get folder failed: %v", e)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to validate folder",
			})
		}
		if folder == nil {
			logrus.Errorf("Folder not found: %d", folderID)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Folder not found",
			})
		}
	}

	// Calculate file hash
	imageHash, err := utils.MultipartFileHeaderHash(fileHeader)
	if err != nil {
		logrus.Errorf("Failed to calculate file hash: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to process file",
		})
	}
	extName := filepath.Ext(fileHeader.Filename)
	logrus.Debugf("Processing file: %s, hash: %s, ext: %s", fileHeader.Filename, imageHash, extName)

	// Save to disk cache
	cachePath := utils.GetImageCachePath(imageHash, extName)
	err = os.MkdirAll(filepath.Dir(cachePath), 0755)
	if err != nil {
		logrus.Errorf("Failed to create cache directory: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create cache directory",
		})
	}
	err = c.SaveFile(fileHeader, cachePath)
	if err != nil {
		logrus.Errorf("Failed to save file to cache: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save file",
		})
	}

	// Upload to S3
	logrus.Debugf("Uploading to S3: %s -> %s", cachePath, imageHash+extName)
	err = service.StorageService.Upload(ctx, cachePath, imageHash+extName, contentType)
	if err != nil {
		logrus.Errorf("Failed to upload to S3: %v", err)
		// Clean up cache file on S3 upload failure
		os.Remove(cachePath)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to upload to storage",
		})
	}
	// Save to database
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
		logrus.Errorf("Failed to save image to database: %v", err)
		// Clean up S3 and cache on database failure
		service.StorageService.Delete(ctx, imageHash+extName)
		os.Remove(cachePath)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save image record",
		})
	}
	logrus.Debugf("Image saved successfully: id=%d, hash=%s", imgID, imageHash)

	// Generate image URL
	imageURL, err := utils.GetImageURL(c, imgObj)
	if err != nil {
		logrus.Errorf("Failed to generate image URL: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate image URL",
		})
	}
	imgObj.URL = imageURL
	logrus.Debugf("Upload completed successfully: %s", imageURL)
	return c.JSON(imgObj)
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

func GetAllImageHandler(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	size := c.QueryInt("size", 10)
	keyword := c.Query("keyword")
	images, total, err := service.ImageService.GetAll(keyword, page, size)
	if err != nil {
		return err
	}
	for i, v := range images {
		imageURL, err := utils.GetImageURL(c, &v)
		if err != nil {
			return err
		}
		images[i].URL = imageURL
	}
	return c.JSON(fiber.Map{
		"images": images,
		"total":  total,
	})
}
