package server

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/server/adminapi"
)

func Run(listenAddr string) error {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})
	logrus.Infof("Momoka running at %s", listenAddr)
	app.Get("/i/:filename", GetImageHandler)

	adminAPI := app.Group("/admin-api")
	adminAPI.Post("/folder", adminapi.CreateFolderHandler)
	adminAPI.Get("/folder", adminapi.GetFolderHandler)
	adminAPI.Patch("/folder", adminapi.UpdateFolderHandler)
	adminAPI.Delete("/folder", adminapi.DeleteFolderHandler)
	adminAPI.Post("/image", adminapi.CreateImageHandler)
	adminAPI.Get("/image", adminapi.GetImageHandler)
	adminAPI.Delete("/image", adminapi.DeleteImageHandler)
	adminAPI.Patch("/image", adminapi.UpdateImageHandler)
	return app.Listen(listenAddr)
}
