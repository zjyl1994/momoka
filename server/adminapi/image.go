package adminapi

import (
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to calculate file hash",
		})
	}

	// Get file extension
	filename := file.Filename
	extName := filepath.Ext(filename)

	// Create image model
	image := &common.Image{
		Name:        strings.TrimSuffix(filename, extName),
		ExtName:     extName,
		ContentType: file.Header.Get("Content-Type"),
		Hash:        hash,
		FileSize:    file.Size,
		Remark:      c.FormValue("remark"),
	}

	// Parse tags
	tagsStr := c.FormValue("tags")
	if tagsStr != "" {
		image.Tags = strings.Split(tagsStr, ",")
		for i, tag := range image.Tags {
			image.Tags[i] = strings.TrimSpace(tag)
		}
	}

	// Save file to local path
	if err := utils.SaveMultipartFile(file, image.LocalPath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to save file",
		})
	}

	// Add to database
	if err := service.ImageService.Add(vars.Database, image); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to save image record",
		})
	}

	// Build response URL
	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}
	image.URL = baseUrl + image.URL

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
	keyword := c.Query("keyword", "")
	pageStr := c.Query("page", "1")
	pageSizeStr := c.Query("pageSize", "20")
	keywordIsTagStr := c.Query("keywordIsTag", "false")

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

	// Parse keywordIsTag
	keywordIsTag := keywordIsTagStr == "true"

	// Search images
	images, total, err := service.ImageService.Search(vars.Database, keyword, page, pageSize, keywordIsTag)
	if err != nil {
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get tags",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"tags": tags,
	})
}
