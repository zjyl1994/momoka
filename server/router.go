package server

import (
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
)

func Run(listenAddr string) error {
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})
	logrus.Infof("Momoka running at %s", listenAddr)
	app.Post("/upload", UploadImageHandler)
	app.Get("/i/:filename", GetImageHandler)
	return app.Listen(listenAddr)
}
