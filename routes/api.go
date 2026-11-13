package routes

import (
	"whatsapp-api/app/controllers"
	"whatsapp-api/app/middleware"
	"github.com/gofiber/fiber/v2"
)

func RegisterAPIRoutes(app *fiber.App) {
	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Health Check
	v1.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "version": "v1"})
	})

	// 1. Auth Routes
	authCtrl := &controllers.AuthController{}
	authGroup := v1.Group("/auth")
	authGroup.Post("/register", authCtrl.Register)
	authGroup.Post("/login", authCtrl.Login)
	authGroup.Get("/me", middleware.AuthMiddleware(), authCtrl.Me)

	// 2. Dashboard Project & Session Management Routes (Protected by JWT)
	projectCtrl := &controllers.ProjectController{}
	sessionCtrl := &controllers.SessionController{}
	messageCtrl := &controllers.MessageController{}

	projectsGroup := v1.Group("/projects", middleware.AuthMiddleware())
	projectsGroup.Get("/", projectCtrl.Index)
	projectsGroup.Post("/", projectCtrl.Store)
	projectsGroup.Get("/:id", projectCtrl.Show)
	projectsGroup.Put("/:id", projectCtrl.Update)
	projectsGroup.Delete("/:id", projectCtrl.Destroy)
	projectsGroup.Post("/:id/regenerate-key", projectCtrl.RegenerateKey)
	projectsGroup.Post("/:id/test-webhook", projectCtrl.TestWebhook)
	projectsGroup.Get("/:id/messages", projectCtrl.Messages)

	v1.Get("/stats", middleware.AuthMiddleware(), projectCtrl.Stats)

	// Session QR & Connection Routes
	projectsGroup.Get("/:id/qr", sessionCtrl.GetQR)
	projectsGroup.Get("/:id/status", sessionCtrl.GetStatus)
	projectsGroup.Post("/:id/logout", sessionCtrl.Logout)

	// Manual Webhook Retry Route (Protected by JWT)
	v1.Post("/messages/:id/retry-webhook", middleware.AuthMiddleware(), messageCtrl.RetryWebhook)

	// 3. External Project API Routes (Protected by X-API-Key)
	extGroup := v1.Group("/", middleware.ApiKeyMiddleware())
	extGroup.Get("/status", messageCtrl.ExternalStatus)
	extGroup.Get("/qr", messageCtrl.ExternalQR)
	extGroup.Post("/logout", messageCtrl.ExternalLogout)
	extGroup.Get("/contacts", messageCtrl.ListContacts)
	extGroup.Get("/messages/:id", messageCtrl.GetMessage)
	extGroup.Get("/messages", messageCtrl.ListMessages)

	sendGroup := v1.Group("/send", middleware.ApiKeyMiddleware(), middleware.IdempotencyMiddleware())
	sendGroup.Post("/text", messageCtrl.SendText)
	sendGroup.Post("/image", messageCtrl.SendImage)
	sendGroup.Post("/document", messageCtrl.SendDocument)
	sendGroup.Post("/audio", messageCtrl.SendAudio)
}
