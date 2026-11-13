package middleware

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"whatsapp-api/app/models"
	"whatsapp-api/bootstrap"
	"github.com/gofiber/fiber/v2"
)

func IdempotencyMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		idemKey := strings.TrimSpace(c.Get("Idempotency-Key"))
		if idemKey == "" {
			return c.Next()
		}

		projectID, _ := c.Locals("project_id").(uint)
		redisKey := fmt.Sprintf("idem:proj:%d:%s", projectID, idemKey)

		// 1. Check Redis first if available
		if bootstrap.Redis != nil {
			cached, err := bootstrap.CacheGet(redisKey)
			if err == nil && cached != "" {
				var cachedResp map[string]interface{}
				if jsonErr := json.Unmarshal([]byte(cached), &cachedResp); jsonErr == nil {
					cachedResp["idempotent_replay"] = true
					return c.Status(200).JSON(cachedResp)
				}
			}
		}

		// 2. Fallback check in PostgreSQL message_logs
		var existing models.MessageLog
		if err := bootstrap.DB.Where("project_id = ? AND idempotency_key = ?", projectID, idemKey).First(&existing).Error; err == nil && existing.ID > 0 {
			return c.Status(200).JSON(fiber.Map{
				"status":            "duplicate_ignored",
				"idempotent_replay": true,
				"message":           "Message with this Idempotency-Key was already processed",
				"data":              existing,
			})
		}

		c.Locals("idempotency_key", idemKey)
		err := c.Next()

		// Cache successful 2xx response in Redis for 24 hours
		if err == nil && c.Response().StatusCode() >= 200 && c.Response().StatusCode() < 300 && bootstrap.Redis != nil {
			_ = bootstrap.CacheSet(redisKey, string(c.Response().Body()), 24*time.Hour)
		}

		return err
	}
}
