package server

import (
	"net/http"
	"time"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/golang-jwt/jwt/v5"
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
	apiGroup.Post("/login", limiter.New(limiter.Config{
		Max:        15, // 每个 IP 每分钟最多 15 次请求
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			if ip := c.Get("X-Real-IP"); ip != "" {
				return ip
			}
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "请求过于频繁，请稍后再试。",
			})
		},
	}), api.LoginHandler)

	adminAPI := app.Group("/admin-api", jwtware.New(jwtware.Config{
		SigningKey:  jwtware.SigningKey{JWTAlg: jwt.SigningMethodHS256.Alg(), Key: []byte(vars.Secret)},
		TokenLookup: "header:Authorization,query:token,cookie:momoka_token",
		AuthScheme:  "Bearer",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "密钥不可用或已过期",
			})
		},
	}))
	adminAPI.Post("/folder", adminapi.CreateFolderHandler)
	adminAPI.Get("/folder", adminapi.GetFolderHandler)
	adminAPI.Patch("/folder", adminapi.UpdateFolderHandler)
	adminAPI.Delete("/folder", adminapi.DeleteFolderHandler)
	adminAPI.Post("/image", adminapi.CreateImageHandler)
	adminAPI.Get("/image", adminapi.GetImageHandler)
	adminAPI.Delete("/image", adminapi.DeleteImageHandler)
	adminAPI.Patch("/image", adminapi.UpdateImageHandler)
	adminAPI.Get("/setting", adminapi.ListSettingHandler)
	adminAPI.Patch("/setting", adminapi.UpdateSettingHandler)

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
