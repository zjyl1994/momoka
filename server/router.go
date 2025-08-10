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
	return app.Listen(listenAddr)
}
