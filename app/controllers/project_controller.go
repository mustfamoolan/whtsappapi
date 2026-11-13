package controllers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"whatsapp-api/app/models"
	"whatsapp-api/bootstrap"
	"github.com/gofiber/fiber/v2"
)

type ProjectController struct{}

func (pc *ProjectController) Index(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	var projects []models.Project
	if err := bootstrap.DB.Where("user_id = ?", userID).Order("id desc").Find(&projects).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch projects"})
	}

	return c.JSON(fiber.Map{"data": projects})
}

func (pc *ProjectController) Store(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	var input struct {
		Name           string `json:"name"`
		Description    string `json:"description"`
		WebhookURL     string `json:"webhook_url"`
		AllowGroups    *bool  `json:"allow_groups"`
		SimulateTyping *bool  `json:"simulate_typing"`
		MinDelayMs     *int   `json:"min_delay_ms"`
		MaxDelayMs     *int   `json:"max_delay_ms"`
	}

	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid payload"})
	}

	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return c.Status(422).JSON(fiber.Map{"error": "Project name is required"})
	}

	project := models.Project{
		UserID:         userID,
		Name:           input.Name,
		Description:    strings.TrimSpace(input.Description),
		APIKey:         models.GenerateAPIKey(),
		WebhookURL:     strings.TrimSpace(input.WebhookURL),
		WebhookSecret:  models.GenerateWebhookSecret(),
		AllowGroups:    false,
		SimulateTyping: true,
		MinDelayMs:     1000,
		MaxDelayMs:     2500,
		Status:         "disconnected",
	}

	if input.AllowGroups != nil {
		project.AllowGroups = *input.AllowGroups
	}
	if input.SimulateTyping != nil {
		project.SimulateTyping = *input.SimulateTyping
	}
	if input.MinDelayMs != nil && *input.MinDelayMs >= 0 {
		project.MinDelayMs = *input.MinDelayMs
	}
	if input.MaxDelayMs != nil && *input.MaxDelayMs >= project.MinDelayMs {
		project.MaxDelayMs = *input.MaxDelayMs
	}

	if err := bootstrap.DB.Create(&project).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create project"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Project created successfully",
		"data":    project,
	})
}

func (pc *ProjectController) Show(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	return c.JSON(fiber.Map{"data": project})
}

func (pc *ProjectController) Update(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	var input struct {
		Name           *string `json:"name"`
		Description    *string `json:"description"`
		WebhookURL     *string `json:"webhook_url"`
		AllowGroups    *bool   `json:"allow_groups"`
		SimulateTyping *bool   `json:"simulate_typing"`
		MinDelayMs     *int    `json:"min_delay_ms"`
		MaxDelayMs     *int    `json:"max_delay_ms"`
	}

	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid payload"})
	}

	if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
		project.Name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		project.Description = strings.TrimSpace(*input.Description)
	}
	if input.WebhookURL != nil {
		project.WebhookURL = strings.TrimSpace(*input.WebhookURL)
	}
	if input.AllowGroups != nil {
		project.AllowGroups = *input.AllowGroups
	}
	if input.SimulateTyping != nil {
		project.SimulateTyping = *input.SimulateTyping
	}
	if input.MinDelayMs != nil && *input.MinDelayMs >= 0 {
		project.MinDelayMs = *input.MinDelayMs
	}
	if input.MaxDelayMs != nil && *input.MaxDelayMs >= project.MinDelayMs {
		project.MaxDelayMs = *input.MaxDelayMs
	}

	if err := bootstrap.DB.Save(&project).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update project"})
	}

	return c.JSON(fiber.Map{
		"message": "Project updated successfully",
		"data":    project,
	})
}

func (pc *ProjectController) Destroy(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	if err := bootstrap.DB.Delete(&project).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete project"})
	}

	return c.JSON(fiber.Map{"message": "Project deleted successfully"})
}

func (pc *ProjectController) RegenerateKey(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	project.APIKey = models.GenerateAPIKey()
	project.WebhookSecret = models.GenerateWebhookSecret()

	if err := bootstrap.DB.Save(&project).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to regenerate keys"})
	}

	return c.JSON(fiber.Map{
		"message": "API Key and Webhook Secret regenerated successfully",
		"data":    project,
	})
}

func (pc *ProjectController) Messages(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	var logs []models.MessageLog
	bootstrap.DB.Where("project_id = ?", project.ID).Order("id desc").Limit(100).Find(&logs)

	return c.JSON(fiber.Map{"data": logs})
}

func (pc *ProjectController) Stats(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	var projectIDs []uint
	bootstrap.DB.Model(&models.Project{}).Where("user_id = ?", userID).Pluck("id", &projectIDs)

	var outboundCount, inboundCount, deliveredCount, failedCount int64
	if len(projectIDs) > 0 {
		bootstrap.DB.Model(&models.MessageLog{}).Where("project_id IN ? AND direction = ?", projectIDs, "outbound").Count(&outboundCount)
		bootstrap.DB.Model(&models.MessageLog{}).Where("project_id IN ? AND direction = ?", projectIDs, "inbound").Count(&inboundCount)
		bootstrap.DB.Model(&models.MessageLog{}).Where("project_id IN ? AND status IN ?", projectIDs, []string{"sent", "delivered"}).Count(&deliveredCount)
		bootstrap.DB.Model(&models.MessageLog{}).Where("project_id IN ? AND (status = ? OR webhook_status = ?)", projectIDs, "failed", "failed").Count(&failedCount)
	}

	type DayStat struct {
		Date     string `json:"date"`
		DayLabel string `json:"day_label"`
		Outbound int64  `json:"outbound"`
		Inbound  int64  `json:"inbound"`
	}

	arabicDays := map[time.Weekday]string{
		time.Saturday:  "السبت",
		time.Sunday:    "الأحد",
		time.Monday:    "الاثنين",
		time.Tuesday:   "الثلاثاء",
		time.Wednesday: "الأربعاء",
		time.Thursday:  "الخميس",
		time.Friday:    "الجمعة",
	}

	daily := make([]DayStat, 0, 7)
	now := time.Now()
	for i := 6; i >= 0; i-- {
		day := now.AddDate(0, 0, -i)
		start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
		end := start.Add(24 * time.Hour)
		var outDay, inDay int64
		if len(projectIDs) > 0 {
			bootstrap.DB.Model(&models.MessageLog{}).
				Where("project_id IN ? AND direction = ? AND created_at >= ? AND created_at < ?", projectIDs, "outbound", start, end).
				Count(&outDay)
			bootstrap.DB.Model(&models.MessageLog{}).
				Where("project_id IN ? AND direction = ? AND created_at >= ? AND created_at < ?", projectIDs, "inbound", start, end).
				Count(&inDay)
		}
		daily = append(daily, DayStat{
			Date:     start.Format("2006-01-02"),
			DayLabel: arabicDays[start.Weekday()],
			Outbound: outDay,
			Inbound:  inDay,
		})
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"outbound_count":  outboundCount,
			"inbound_count":   inboundCount,
			"delivered_count": deliveredCount,
			"failed_count":    failedCount,
			"daily_traffic":   daily,
		},
	})
}

func (pc *ProjectController) TestWebhook(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	id := c.Params("id")

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", id, userID).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}
	if strings.TrimSpace(project.WebhookURL) == "" {
		return c.Status(422).JSON(fiber.Map{"error": "Webhook URL is empty"})
	}

	payload := fiber.Map{
		"event":        "webhook.test",
		"project_id":   project.ID,
		"project_name": project.Name,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
		"data": fiber.Map{
			"message": "Test event from Wasla Gateway",
		},
	}
	bodyBytes, _ := json.Marshal(payload)

	mac := hmac.New(sha256.New, []byte(project.WebhookSecret))
	mac.Write(bodyBytes)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	req, err := http.NewRequest("POST", project.WebhookURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Signature", sig)

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	defer resp.Body.Close()

	return c.JSON(fiber.Map{
		"status_code": resp.StatusCode,
		"ok":          resp.StatusCode >= 200 && resp.StatusCode < 300,
	})
}
