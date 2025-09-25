package adminapi

import (
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/utils"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

func ImageUploadHandler(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "file parameter is required",
		})
	}

	// Validate file type
	if !strings.HasPrefix(file.Header.Get("Content-Type"), "image/") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "only image files are allowed",
		})
	}

	// Validate file size (10MB limit)
	if file.Size > common.MAX_IMAGE_SIZE {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "file size exceeds limit",
		})
	}

	// Calculate file hash
	hash, err := utils.MultipartFileHeaderHash(file)
	if err != nil {
		logrus.Errorln("Failed to calculate file hash:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to calculate file hash",
		})
	}

	// Check if image with same hash already exists
	existingImage, err := service.ImageService.GetByHash(vars.Database, hash)
	if err != nil {
		logrus.Errorln("Failed to check existing image by hash:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to check existing image",
		})
	}

	// Get file extension and filename
	filename := file.Filename
	extName := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, extName)
	remark := c.FormValue("remark")

	// Parse tags
	var tags []string
	tagsStr := c.FormValue("tags")
	if tagsStr != "" {
		tags = strings.Split(tagsStr, ",")
		for i, tag := range tags {
			tags[i] = strings.TrimSpace(tag)
		}
	}

	var image *common.Image

	if existingImage != nil {
		// Hash already exists, update existing record like ImageUpdateHandler
		image = existingImage

		// Update fields if provided
		if name != "" {
			image.Name = name
		}
		if remark != "" {
			image.Remark = remark
		}
		if len(tags) > 0 {
			image.Tags = tags
		}

		// Update image record
		if err := service.ImageService.Update(vars.Database, image); err != nil {
			logrus.Errorln("Failed to update existing image:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to update existing image",
			})
		}
	} else {
		// Hash doesn't exist, create new record
		image = &common.Image{
			Name:        name,
			ExtName:     extName,
			ContentType: file.Header.Get("Content-Type"),
			Hash:        hash,
			FileSize:    file.Size,
			Remark:      remark,
			Tags:        tags,
		}

		// FillModel to set paths
		service.ImageService.FillModel(image)

		// Save file to local path
		if err := utils.SaveMultipartFile(file, image.LocalPath); err != nil {
			logrus.Errorln("Failed to save file:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to save file",
			})
		}

		// Add to database
		if err := service.ImageService.Add(vars.Database, image); err != nil {
			logrus.Errorln("Failed to save image record:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to save image record",
			})
		}
	}

	// Build response URL
	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}
	if image.URL != "" {
		image.URL = baseUrl + image.URL
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"image": image,
	})
}

func ImageDeleteHandler(c *fiber.Ctx) error {
	idsStr := c.Query("ids")
	if idsStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "ids parameter is required",
		})
	}

	// Parse comma-separated IDs
	idStrs := strings.Split(idsStr, ",")
	ids := make([]int64, 0, len(idStrs))
	for _, idStr := range idStrs {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid id format: " + idStr,
			})
		}
		ids = append(ids, id)
	}

	if len(ids) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "no valid ids provided",
		})
	}

	// Delete images
	if err := service.ImageService.Delete(vars.Database, ids); err != nil {
		logrus.Errorln("Failed to delete images:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete images",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "images deleted successfully",
		"count":   len(ids),
	})
}

func ImageListHandler(c *fiber.Ctx) error {
	// Get query parameters
	keyword := c.Query("keyword")
	imageTag := c.Query("tag")
	pageStr := c.Query("page", "1")
	pageSizeStr := c.Query("pageSize", "20")

	// Parse page
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	// Parse pageSize
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// Search images
	images, total, err := service.ImageService.Search(vars.Database, keyword, page, pageSize, imageTag)
	if err != nil {
		logrus.Errorln("Failed to search images:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to search images",
		})
	}

	// Build response URLs
	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}

	for _, image := range images {
		if image.URL != "" {
			image.URL = baseUrl + image.URL
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"images":   images,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func ImageDetailHandler(c *fiber.Ctx) error {
	idStr := c.Params("id")
	if idStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "id parameter is required",
		})
	}

	// Parse ID
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid id format",
		})
	}

	// Get image
	image, err := service.ImageService.Get(vars.Database, id)
	if err != nil {
		logrus.Errorln("Failed to get image:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get image",
		})
	}

	if image == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "image not found",
		})
	}

	// Build response URL
	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}

	if image.URL != "" {
		image.URL = baseUrl + image.URL
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"image": image,
	})
}

func ImageUpdateHandler(c *fiber.Ctx) error {
	idStr := c.Params("id")
	if idStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "id parameter is required",
		})
	}

	// Parse ID
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid id format",
		})
	}

	// Get existing image
	image, err := service.ImageService.Get(vars.Database, id)
	if err != nil {
		logrus.Errorln("Failed to get image for update:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get image",
		})
	}

	if image == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "image not found",
		})
	}

	// Parse request body
	var updateData struct {
		Name   *string  `json:"name"`
		Remark *string  `json:"remark"`
		Tags   []string `json:"tags"`
	}

	if err := c.BodyParser(&updateData); err != nil {
		logrus.Errorln("Failed to parse request body:", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	// Update only allowed fields
	if updateData.Name != nil {
		image.Name = *updateData.Name
	}
	if updateData.Remark != nil {
		image.Remark = *updateData.Remark
	}
	if updateData.Tags != nil {
		// Clean up tags
		for i, tag := range updateData.Tags {
			updateData.Tags[i] = strings.TrimSpace(tag)
		}
		image.Tags = updateData.Tags
	}

	// Update image
	if err := service.ImageService.Update(vars.Database, image); err != nil {
		logrus.Errorln("Failed to update image:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update image",
		})
	}

	// Build response URL
	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}

	if image.URL != "" {
		image.URL = baseUrl + image.URL
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"image": image,
	})
}

func ImageTagListHandler(c *fiber.Ctx) error {
	// Get all tags with counts
	tags, err := service.ImageService.GetTags(vars.Database)
	if err != nil {
		logrus.Errorln("Failed to get tags:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get tags",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"tags": tags,
	})
}
