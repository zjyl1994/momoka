package adminapi

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

// GetFSPathHandler 根据路径字符串获取路径信息
func GetFSPathHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	if pathStr == "" {
		pathStr = "/" // 默认为根路径
	} else {
		pathStr = "/" + pathStr // 添加前导斜杠
	}

	fsPath, err := service.FSPathService.Get(vars.Database, pathStr)
	if err != nil {
		logrus.Errorf("Get FSPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "get path failed",
		})
	}

	if fsPath == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "path not found",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fsPath)
}

// CreateFSPathHandler 创建新路径
func CreateFSPathHandler(c *fiber.Ctx) error {
	type CreateFSPathReq struct {
		EntityType int32 `json:"entity_type"`
	}

	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	var req CreateFSPathReq
	if err := c.BodyParser(&req); err != nil {
		logrus.Errorf("BodyParser failed, err: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.EntityType != common.ENTITY_TYPE_IMAGE && req.EntityType != common.ENTITY_TYPE_FOLDER {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid entity type",
		})
	}

	err := service.FSPathService.Create(vars.Database, pathStr, req.EntityType)
	if err != nil {
		logrus.Errorf("Create FSPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "create path failed",
		})
	}

	return c.SendStatus(fiber.StatusCreated)
}

// DeleteFSPathHandler 删除路径
func DeleteFSPathHandler(c *fiber.Ctx) error {
	recursive := c.QueryBool("recursive")

	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	err := service.FSPathService.Delete(vars.Database, []string{pathStr}, recursive)
	if err != nil {
		logrus.Errorf("Delete FSPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "delete paths failed",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// MoveFSPathHandler 移动路径
func MoveFSPathHandler(c *fiber.Ctx) error {
	newPath := c.Query("new_path")
	if newPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "new_path is required",
		})
	}

	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	err := service.FSPathService.Move(vars.Database, []string{pathStr}, newPath)
	if err != nil {
		logrus.Errorf("Move FSPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "move paths failed",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// RenameFSPathHandler 重命名路径
func RenameFSPathHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	newName := c.Query("new_name")
	if newName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "new_name query parameter is required",
		})
	}

	err := service.FSPathService.Rename(vars.Database, pathStr, newName)
	if err != nil {
		logrus.Errorf("Rename FSPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "rename path failed",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// GetFSPathChildrenHandler 获取指定路径的子路径
func GetFSPathChildrenHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	pathStr = "/" + pathStr // 添加前导斜杠

	children, err := service.FSPathService.GetChildren(vars.Database, pathStr)
	if err != nil {
		logrus.Errorf("GetChildren failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "get children failed",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"children": children,
	})
}

// MkdirFSPathHandler 递归创建目录路径
func MkdirFSPathHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	err := service.FSPathService.Mkdir(vars.Database, pathStr)
	if err != nil {
		logrus.Errorf("Mkdir failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "mkdir failed",
		})
	}

	return c.SendStatus(fiber.StatusCreated)
}
