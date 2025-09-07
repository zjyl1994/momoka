package adminapi

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

// GetLogicPathHandler 根据路径字符串获取路径信息
func GetLogicPathHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	if pathStr == "" {
		pathStr = "/" // 默认为根路径
	} else {
		pathStr = "/" + pathStr // 添加前导斜杠
	}

	fsPath, err := service.LogicPathService.Get(vars.Database, pathStr)
	if err != nil {
		logrus.Errorf("Get LogicPath failed, err: %v", err)
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

// CreateLogicPathHandler 创建新路径
func CreateLogicPathHandler(c *fiber.Ctx) error {
	type CreateLogicPathReq struct {
		EntityType int32 `json:"entity_type"`
	}

	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	var req CreateLogicPathReq
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

	err := service.LogicPathService.Create(vars.Database, pathStr, req.EntityType, 0)
	if err != nil {
		logrus.Errorf("Create LogicPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "create path failed",
		})
	}

	return c.SendStatus(fiber.StatusCreated)
}

// DeleteLogicPathHandler 删除路径
func DeleteLogicPathHandler(c *fiber.Ctx) error {
	recursive := c.QueryBool("recursive")

	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	err := service.LogicPathService.Delete(vars.Database, []string{pathStr}, recursive)
	if err != nil {
		logrus.Errorf("Delete LogicPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "delete paths failed",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// MoveLogicPathHandler 移动路径
func MoveLogicPathHandler(c *fiber.Ctx) error {
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

	err := service.LogicPathService.Move(vars.Database, []string{pathStr}, newPath)
	if err != nil {
		logrus.Errorf("Move LogicPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "move paths failed",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// RenameLogicPathHandler 重命名路径
func RenameLogicPathHandler(c *fiber.Ctx) error {
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

	err := service.LogicPathService.Rename(vars.Database, pathStr, newName)
	if err != nil {
		logrus.Errorf("Rename LogicPath failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "rename path failed",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// GetLogicPathChildrenHandler 获取指定路径的子路径
func GetLogicPathChildrenHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	pathStr = "/" + pathStr // 添加前导斜杠

	children, err := service.LogicPathService.GetChildren(vars.Database, pathStr)
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

// MkdirLogicPathHandler 递归创建目录路径
func MkdirLogicPathHandler(c *fiber.Ctx) error {
	pathStr := c.Params("path")
	if pathStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "path parameter is required",
		})
	}
	pathStr = "/" + pathStr // 添加前导斜杠

	err := service.LogicPathService.Mkdir(vars.Database, pathStr)
	if err != nil {
		logrus.Errorf("Mkdir failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "mkdir failed",
		})
	}

	return c.SendStatus(fiber.StatusCreated)
}
