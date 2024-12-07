package main

import (
	"ok/config"
	"ok/router"
)

func main() {
	cfg := config.GetConfig()
	r := router.SetupRouter()
	r.Run(cfg.ServerPort)
}
