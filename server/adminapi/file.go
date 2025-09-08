package adminapi

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/service"
)

func VFATUploadHandler(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "file parameter is required",
		})
	}
	path := c.FormValue("path")
	if !strings.HasSuffix(path, "/") {
		path += "/"
	}
	path += file.Filename

	logicFile, err := service.VirtualFATService.Save(file, path)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "save file failed",
		})
	}

	var baseUrl string
	if vars.BaseURL != "" {
		baseUrl = vars.BaseURL
	} else {
		baseUrl = c.BaseURL()
	}
	logicFile.URL = baseUrl + logicFile.URL

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"file": logicFile,
	})
}

func VFATActionHandler(c *fiber.Ctx) error {
	var req struct {
		Action string   `json:"action"`
		Path   string   `json:"path"`
		Paths  []string `json:"paths"`
		Dst    string   `json:"dst"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}
	switch strings.ToLower(req.Action) {
	case "delete":
		removeList := make([]string, 0)
		if len(req.Paths) > 0 {
			removeList = req.Paths
		} else {
			removeList = []string{req.Path}
		}
		err := service.VirtualFATService.Delete(removeList)
		if err != nil {
			logrus.Errorln("Delete failed, err:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "delete file failed",
			})
		}
	case "rename":
		err := service.VirtualFATService.Rename(vars.Database, req.Path, req.Dst)
		if err != nil {
			logrus.Errorln("Rename failed, err:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "rename file failed",
			})
		}
	case "move":
		moveList := make([]string, 0)
		if len(req.Paths) > 0 {
			moveList = req.Paths
		} else {
			moveList = []string{req.Path}
		}
		err := service.VirtualFATService.Move(vars.Database, moveList, req.Dst)
		if err != nil {
			logrus.Errorln("Move failed, err:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "move file failed",
			})
		}
	case "mkdir":
		_, err := service.VirtualFATService.Mkdir(vars.Database, req.Dst)
		if err != nil {
			logrus.Errorln("Mkdir failed, err:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "mkdir file failed",
			})
		}
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid action",
		})
	}
	return c.SendStatus(fiber.StatusOK)
}

func VFATListHandler(c *fiber.Ctx) error {
	path := c.Query("path", "/")
	files, err := service.VirtualFATService.GetChildren(vars.Database, path)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "list file failed",
		})
	}
	return c.JSON(files)
}

func VFATGetTreeHandler(c *fiber.Ctx) error {
	tree, err := service.VirtualFATService.GetTree(vars.Database)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "get tree failed",
		})
	}
	return c.JSON(tree)
}

func VFATGetAllHandler(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	size := c.QueryInt("size", 10)
	files, total, err := service.VirtualFATService.GetAllFiles(vars.Database, page, size)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "get all files failed",
		})
	}
	return c.JSON(fiber.Map{
		"files": files,
		"total": total,
	})
}
