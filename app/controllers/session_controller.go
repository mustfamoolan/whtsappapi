package controllers

import (
	"whatsapp-api/app/models"
	"whatsapp-api/app/services"
	"whatsapp-api/bootstrap"
	"github.com/gofiber/fiber/v2"
)

type SessionController struct{}

func (sc *SessionController) GetQR(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	status, qrBase64, phone, err := services.WA.StartOrGetQR(&project)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"project_id":   project.ID,
		"status":       status,
		"qr_base64":    qrBase64,
		"phone_number": phone,
	})
}

func (sc *SessionController) GetStatus(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	sess := services.WA.GetSession(project.ID)
	status := project.Status
	qrB64 := ""
	phone := project.PhoneNumber

	if sess != nil {
		st, b64, _ := sess.GetSnapshot()
		if sess.Client != nil && sess.Client.IsLoggedIn() && sess.Client.Store.ID != nil {
			status = "connected"
			phone = sess.Client.Store.ID.User
			if project.Status != "connected" || project.PhoneNumber != phone {
				bootstrap.DB.Model(&project).Updates(map[string]interface{}{
					"status":       "connected",
					"phone_number": phone,
					"jid":          sess.Client.Store.ID.String(),
				})
			}
		} else if st != "" {
			status = st
			qrB64 = b64
		}
	}

	return c.JSON(fiber.Map{
		"project_id":   project.ID,
		"status":       status,
		"phone_number": phone,
		"jid":          project.JID,
		"qr_base64":    qrB64,
	})
}

func (sc *SessionController) Logout(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	if err := services.WA.LogoutSession(&project); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "WhatsApp session logged out and disconnected",
		"status":  "disconnected",
	})
}
