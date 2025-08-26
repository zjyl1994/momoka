package server

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/server/adminapi"
	"github.com/zjyl1994/momoka/webui"
)

func Run(listenAddr string) error {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		BodyLimit:             10 * 1024 * 1024,
	})

	app.Get("/i/:filename", GetImageHandler)

	apiGroup := app.Group("/api")
	apiGroup.Get("/bing", GetBingTodayImageHandler)
	apiGroup.Get("/masonry", GetMasonryImageHandler)

	adminAPI := app.Group("/admin-api")
	adminAPI.Post("/folder", adminapi.CreateFolderHandler)
	adminAPI.Get("/folder", adminapi.GetFolderHandler)
	adminAPI.Patch("/folder", adminapi.UpdateFolderHandler)
	adminAPI.Delete("/folder", adminapi.DeleteFolderHandler)
	adminAPI.Post("/image", adminapi.CreateImageHandler)
	adminAPI.Get("/image", adminapi.GetImageHandler)
	adminAPI.Delete("/image", adminapi.DeleteImageHandler)
	adminAPI.Patch("/image", adminapi.UpdateImageHandler)

	app.Use("/", filesystem.New(filesystem.Config{
		Root:         http.FS(webui.WebUI),
		PathPrefix:   "dist",
		NotFoundFile: "dist/index.html",
	}))

	logrus.Infoln("Momoka is running on", listenAddr)
	return app.Listen(listenAddr)
}
