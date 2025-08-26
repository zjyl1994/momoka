package server

import (
	"net/http"
	"time"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/sirupsen/logrus"
	"github.com/zjyl1994/momoka/infra/vars"
	"github.com/zjyl1994/momoka/server/adminapi"
	"github.com/zjyl1994/momoka/server/api"
	"github.com/zjyl1994/momoka/webui"
)

func Run(listenAddr string) error {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		BodyLimit:             10 * 1024 * 1024,
	})

	app.Get("/i/:filename", GetImageHandler)
	app.Get("/healthz", healthCheckHandler)

	apiGroup := app.Group("/api")
	apiGroup.Get("/bing", api.GetBingTodayImageHandler)
	apiGroup.Get("/masonry", api.GetMasonryImageHandler)
	apiGroup.Post("/login", api.LoginHandler)

	adminAPI := app.Group("/admin-api", jwtware.New(jwtware.Config{
		SigningKey:  jwtware.SigningKey{Key: []byte(vars.Secret)},
		TokenLookup: "header:Authorization,query:token,cookie:momoka_token",
	}))
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

func healthCheckHandler(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"server": "momoka",
		"time":   time.Now().Format(time.RFC3339),
	})
}
