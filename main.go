package main

import (
	"fmt"
	"log"

	"whatsapp-api/app/services"
	"whatsapp-api/bootstrap"
	"whatsapp-api/config"
	"whatsapp-api/routes"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	// 1. Initialize Config
	bootstrap.InitializeConfig()

	// 1.1 Initialize Logger (Zap)
	bootstrap.InitializeLogger()

	// 1.2 Initialize Cache (Redis)
	bootstrap.InitializeCache()

	// 2. Initialize Database & AutoMigrate
	bootstrap.InitializeDatabase()

	// 2.1 Initialize WhatsApp Multi-Session Engine
	services.InitializeWhatsappManager()

	// 3. Initialize Fiber
	app := fiber.New(fiber.Config{
		AppName:   config.Global.App.Name + " - almoq3 Framework",
		BodyLimit: 30 * 1024 * 1024, // 30MB for media uploads
	})

	app.Use(cors.New())

	// Serve uploaded media files
	app.Static("/uploads", "./storage/uploads")
	// Missing media must return a real 404 (not the SPA index.html, which breaks <audio>/<img> players)
	app.All("/uploads/*", func(c *fiber.Ctx) error {
		return c.Status(404).JSON(fiber.Map{"error": "Media file not found"})
	})

	// 4. Register Routes
	routes.Register(app)

	port := config.Global.App.Port
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 %s Started on port %s\n", config.Global.App.Name, port)
	log.Fatal(app.Listen(":" + port))
}
