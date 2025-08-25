package adminapi

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/common"
	"github.com/zjyl1994/momoka/service"
)

func CreateFolderHandler(c *fiber.Ctx) error {
	var req common.FolderReq
	if err := c.BodyParser(&req); err != nil {
		logrus.Errorf("BodyParser failed, err: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}
	if req.Name == nil && *req.Name == "" {
		logrus.Errorf("Name is empty")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Name is empty",
		})
	}
	m := new(common.ImageFolder)
	m.Name = *req.Name
	m.Public = *req.Public
	m.ParentID = *req.ParentID
	err := service.ImageFolderService.Create(m)
	if err != nil {
		logrus.Errorf("Create failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "create folder failed",
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func GetFolderHandler(c *fiber.Ctx) error {
	folderID := int64(c.QueryInt("id"))
	metaOnly := c.QueryBool("meta_only")

	result := make(fiber.Map)
	if folderID > 0 {
		meta, e := service.ImageFolderService.Get(folderID)
		if e != nil {
			logrus.Errorf("Get failed, err: %v", e)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "get folder failed",
			})
		}
		result["meta"] = meta
	}

	if !metaOnly {
		folders, images, err := service.ImageFolderService.GetFolderContents(folderID)
		if err != nil {
			logrus.Errorf("GetFolderContents failed, err: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "get folder contents failed",
			})
		}

		for i, item := range images {
			imageURL, err := getImageURL(c, item)
			if err != nil {
				logrus.Errorf("getImageURL failed, err: %v", err)
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "get image url failed",
				})
			}
			images[i].URL = imageURL
		}

		result["folders"] = folders
		result["images"] = images
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

func DeleteFolderHandler(c *fiber.Ctx) error {
	folderID := int64(c.QueryInt("id"))
	if folderID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "root folder can not be deleted",
		})
	}
	err := service.ImageFolderService.Delete(folderID)
	if err != nil {
		logrus.Errorf("Delete failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "delete folder failed",
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func UpdateFolderHandler(c *fiber.Ctx) error {
	folderID := int64(c.QueryInt("id"))
	if folderID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "root folder can not be changed",
		})
	}

	var req common.FolderReq
	if err := c.BodyParser(&req); err != nil {
		logrus.Errorf("BodyParser failed, err: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}
	if req.Name == nil && req.Public == nil && req.ParentID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.Name != nil {
		err := service.ImageFolderService.Rename(folderID, *req.Name)
		if err != nil {
			logrus.Errorf("Rename failed, err: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "rename folder failed",
			})
		}
	}
	if req.Public != nil {
		err := service.ImageFolderService.SetPublic(folderID, *req.Public)
		if err != nil {
			logrus.Errorf("SetPublic failed, err: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "set folder public failed",
			})
		}
	}
	if req.ParentID != nil {
		err := service.ImageFolderService.Move(folderID, *req.ParentID)
		if err != nil {
			logrus.Errorf("Move failed, err: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "move folder failed",
			})
		}
	}
	folder, err := service.ImageFolderService.Get(folderID)
	if err != nil {
		logrus.Errorf("Get failed, err: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "get folder failed",
		})
	}
	return c.JSON(folder)
}
