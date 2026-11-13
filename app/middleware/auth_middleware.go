package middleware

import (
	"fmt"
	"strings"

	"whatsapp-api/config"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Missing Authorization header"})
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer"))
		secret := config.Global.App.Key
		if secret == "" {
			secret = "secret"
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid or expired token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid token claims"})
		}

		userIDFloat, ok := claims["user_id"].(float64)
		if !ok {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid user ID in token"})
		}

		c.Locals("user", token)
		c.Locals("user_id", uint(userIDFloat))
		return c.Next()
	}
}
