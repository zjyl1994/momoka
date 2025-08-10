package main

import (
	"log"

	"github.com/zjyl1994/momoka/infra/startup"
)

func main() {
	if err := startup.Startup(); err != nil {
		log.Fatalln("startup failed:", err)
	}
}
