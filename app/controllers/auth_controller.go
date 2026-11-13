package controllers

import (
	"strings"
	"time"

	"whatsapp-api/app/models"
	"whatsapp-api/bootstrap"
	"whatsapp-api/config"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthController struct{}

func generateJWT(userID uint) (string, error) {
	secret := config.Global.App.Key
	if secret == "" {
		secret = "secret"
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 168).Unix(), // 7 days
	})
	return token.SignedString([]byte(secret))
}

func (a *AuthController) Register(c *fiber.Ctx) error {
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Name = strings.TrimSpace(input.Name)

	if input.Email == "" || len(input.Password) < 6 {
		return c.Status(422).JSON(fiber.Map{"error": "Email and password (min 6 chars) are required"})
	}
	if input.Name == "" {
		input.Name = "Admin"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	user := models.User{
		Name:     input.Name,
		Email:    input.Email,
		Password: string(hashedPassword),
	}

	if err := bootstrap.DB.Create(&user).Error; err != nil {
		return c.Status(409).JSON(fiber.Map{"error": "Email is already registered"})
	}

	token, err := generateJWT(user.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "User registered successfully",
		"token":   token,
		"user":    user,
	})
}

func (a *AuthController) Login(c *fiber.Ctx) error {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))

	var user models.User
	if err := bootstrap.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	token, err := generateJWT(user.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user":  user,
	})
}

func (a *AuthController) Me(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(uint)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var dbUser models.User
	if err := bootstrap.DB.First(&dbUser, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{"user": dbUser})
}
