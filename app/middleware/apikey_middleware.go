package middleware

import (
	"strings"

	"whatsapp-api/app/models"
	"whatsapp-api/bootstrap"
	"github.com/gofiber/fiber/v2"
)

func ApiKeyMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := strings.TrimSpace(c.Get("X-API-Key"))
		if apiKey == "" {
			authHeader := c.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer wapi_") {
				apiKey = strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer"))
			}
		}

		if apiKey == "" {
			return c.Status(401).JSON(fiber.Map{
				"error":   "Unauthorized",
				"message": "Missing X-API-Key header",
			})
		}

		var project models.Project
		if err := bootstrap.DB.Where("api_key = ?", apiKey).First(&project).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error":   "Unauthorized",
				"message": "Invalid API Key",
			})
		}

		c.Locals("project", &project)
		c.Locals("project_id", project.ID)
		return c.Next()
	}
}
