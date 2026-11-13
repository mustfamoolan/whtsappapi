package controllers

import (
	"encoding/base64"
	"io"
	"strconv"
	"strings"

	"whatsapp-api/app/models"
	"whatsapp-api/app/services"
	"whatsapp-api/bootstrap"
	"github.com/gofiber/fiber/v2"
)

type MessageController struct{}

func (mc *MessageController) SendText(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)
	idemKey, _ := c.Locals("idempotency_key").(string)

	var input struct {
		To      string `json:"to"`
		Message string `json:"message"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	input.Message = strings.TrimSpace(input.Message)
	if input.To == "" || input.Message == "" {
		return c.Status(422).JSON(fiber.Map{"error": "Both 'to' and 'message' fields are required"})
	}

	msgLog, err := services.WA.EnqueueOutboundMessage(project, input.To, "text", input.Message, nil, "", "", idemKey)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(202).JSON(fiber.Map{
		"status":  "queued",
		"message": "Text message queued for delivery",
		"data":    msgLog,
	})
}

func (mc *MessageController) SendImage(c *fiber.Ctx) error {
	return mc.handleMediaSend(c, "image")
}

func (mc *MessageController) SendDocument(c *fiber.Ctx) error {
	return mc.handleMediaSend(c, "document")
}

func (mc *MessageController) SendAudio(c *fiber.Ctx) error {
	return mc.handleMediaSend(c, "audio")
}

func (mc *MessageController) handleMediaSend(c *fiber.Ctx, mediaType string) error {
	project := c.Locals("project").(*models.Project)
	idemKey, _ := c.Locals("idempotency_key").(string)

	var to, caption, fileName, mimeType string
	var mediaBytes []byte

	// Support multipart/form-data file upload
	if strings.HasPrefix(c.Get("Content-Type"), "multipart/form-data") {
		to = c.FormValue("to")
		caption = c.FormValue("caption")
		fileName = c.FormValue("filename")

		fileHeader, err := c.FormFile("file")
		if err != nil {
			return c.Status(422).JSON(fiber.Map{"error": "Multipart field 'file' is required"})
		}
		if fileName == "" {
			fileName = fileHeader.Filename
		}
		mimeType = fileHeader.Header.Get("Content-Type")

		f, err := fileHeader.Open()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to read uploaded file"})
		}
		defer f.Close()
		mediaBytes, err = io.ReadAll(f)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to read file bytes"})
		}
	} else {
		// Support JSON body (URL or Base64)
		var input struct {
			To         string `json:"to"`
			Caption    string `json:"caption"`
			FileName   string `json:"filename"`
			MimeType   string `json:"mime_type"`
			MediaURL   string `json:"media_url"`
			ImageURL   string `json:"image_url"`
			FileURL    string `json:"file_url"`
			AudioURL   string `json:"audio_url"`
			Base64Data string `json:"base64"`
		}
		if err := c.BodyParser(&input); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid payload"})
		}

		to = input.To
		caption = input.Caption
		fileName = input.FileName
		mimeType = input.MimeType

		targetURL := input.MediaURL
		if targetURL == "" {
			if input.ImageURL != "" {
				targetURL = input.ImageURL
			} else if input.FileURL != "" {
				targetURL = input.FileURL
			} else if input.AudioURL != "" {
				targetURL = input.AudioURL
			}
		}

		if input.Base64Data != "" {
			b64Clean := input.Base64Data
			if idx := strings.Index(b64Clean, ","); idx != -1 {
				b64Clean = b64Clean[idx+1:]
			}
			decoded, err := base64.StdEncoding.DecodeString(b64Clean)
			if err != nil {
				return c.Status(422).JSON(fiber.Map{"error": "Invalid base64 media data"})
			}
			mediaBytes = decoded
		} else if targetURL != "" {
			downloaded, detectedMime, detectedName, err := services.FetchMediaFromURL(targetURL)
			if err != nil {
				return c.Status(422).JSON(fiber.Map{"error": err.Error()})
			}
			mediaBytes = downloaded
			if mimeType == "" {
				mimeType = detectedMime
			}
			if fileName == "" {
				fileName = detectedName
			}
		} else {
			return c.Status(422).JSON(fiber.Map{"error": "Provide either media URL (media_url / image_url / file_url / audio_url), 'base64', or multipart 'file'"})
		}
	}

	if strings.TrimSpace(to) == "" || len(mediaBytes) == 0 {
		return c.Status(422).JSON(fiber.Map{"error": "Recipient 'to' and media content are required"})
	}

	msgLog, err := services.WA.EnqueueOutboundMessage(project, to, mediaType, caption, mediaBytes, mimeType, fileName, idemKey)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(202).JSON(fiber.Map{
		"status":  "queued",
		"message": mediaType + " queued for delivery",
		"data":    msgLog,
	})
}

func (mc *MessageController) RetryWebhook(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	idUint, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid message log ID"})
	}

	msgLog, err := services.RetryWebhookByLogID(uint(idUint), userID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "Webhook retry triggered",
		"data":    msgLog,
	})
}

// ListMessages allows external projects (Mobile, Web, Laravel on Shared Hosting) to pull messages via X-API-Key without needing a Webhook server.
func (mc *MessageController) ListMessages(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)

	query := bootstrap.DB.Where("project_id = ?", project.ID)

	if dir := strings.TrimSpace(c.Query("direction")); dir == "inbound" || dir == "outbound" {
		query = query.Where("direction = ?", dir)
	}

	// Filter a single conversation: ?chat=07742209251 | 9647742209251 | 9647742209251@s.whatsapp.net
	if chat := strings.TrimSpace(c.Query("chat")); chat != "" {
		if jid := services.NormalizeRecipient(chat); jid != "" {
			query = query.Where("remote_j_id = ?", jid)
		}
	}

	limit := c.QueryInt("limit", 50)
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var logs []models.MessageLog
	if sinceID := c.QueryInt("since_id", 0); sinceID > 0 {
		query.Where("id > ?", sinceID).Order("id asc").Limit(limit).Find(&logs)
	} else {
		query.Order("id desc").Limit(limit).Find(&logs)
	}

	return c.JSON(fiber.Map{
		"project_id": project.ID,
		"data":       logs,
	})
}

// GetMessage returns a single message (status lookup) for the project via X-API-Key.
func (mc *MessageController) GetMessage(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid message id"})
	}
	var msgLog models.MessageLog
	if err := bootstrap.DB.Where("id = ? AND project_id = ?", id, project.ID).First(&msgLog).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}
	return c.JSON(fiber.Map{"data": msgLog})
}

// ExternalStatus allows external projects to check their WhatsApp connection status via X-API-Key.
func (mc *MessageController) ExternalStatus(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)

	status := project.Status
	phone := project.PhoneNumber
	if sess := services.WA.GetSession(project.ID); sess != nil && sess.Client != nil && sess.Client.IsLoggedIn() && sess.Client.Store.ID != nil {
		status = "connected"
		phone = sess.Client.Store.ID.User
	}

	return c.JSON(fiber.Map{
		"project_id":   project.ID,
		"project_name": project.Name,
		"status":       status,
		"phone_number": phone,
	})
}

// ExternalQR starts/fetches the live WhatsApp QR code for an external project via X-API-Key.
func (mc *MessageController) ExternalQR(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)

	status, qrBase64, phone, err := services.WA.StartOrGetQR(project)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"project_id":   project.ID,
		"project_name": project.Name,
		"status":       status,
		"qr_base64":    qrBase64,
		"phone_number": phone,
	})
}

// ExternalLogout disconnects the WhatsApp session for an external project via X-API-Key.
func (mc *MessageController) ExternalLogout(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)

	if err := services.WA.LogoutSession(project); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "WhatsApp session logged out and disconnected",
		"status":  "disconnected",
	})
}

// ListContacts returns deduplicated synced WhatsApp contacts for the project via X-API-Key.
func (mc *MessageController) ListContacts(c *fiber.Ctx) error {
	project := c.Locals("project").(*models.Project)
	if project.JID == "" {
		return c.JSON(fiber.Map{"project_id": project.ID, "data": []interface{}{}})
	}

	type ContactRow struct {
		JID      string `json:"jid" gorm:"column:jid"`
		Name     string `json:"name" gorm:"column:name"`
		PushName string `json:"push_name" gorm:"column:push_name"`
		FullName string `json:"full_name" gorm:"column:full_name"`
	}

	var rows []ContactRow
	query := `
		SELECT DISTINCT ON (canonical_jid)
			canonical_jid AS jid,
			COALESCE(NULLIF(full_name, ''), NULLIF(first_name, ''), NULLIF(push_name, ''), NULLIF(business_name, ''), split_part(canonical_jid, '@', 1)) AS name,
			COALESCE(push_name, '') AS push_name,
			COALESCE(full_name, '') AS full_name
		FROM (
			SELECT
				CASE
					WHEN c.their_jid LIKE '%@lid' AND lm.pn IS NOT NULL AND lm.pn != ''
						THEN lm.pn || '@s.whatsapp.net'
					ELSE c.their_jid
				END AS canonical_jid,
				c.full_name,
				c.first_name,
				c.push_name,
				c.business_name
			FROM whatsmeow_contacts c
			LEFT JOIN whatsmeow_lid_map lm ON split_part(c.their_jid, '@', 1) = lm.lid
			WHERE c.our_jid = ?
				AND (c.their_jid LIKE '%@s.whatsapp.net' OR c.their_jid LIKE '%@lid' OR c.their_jid LIKE '%@g.us')
				AND c.their_jid NOT LIKE '%@bot'
		) sub
		WHERE canonical_jid LIKE '%@s.whatsapp.net' OR canonical_jid LIKE '%@g.us'
		ORDER BY canonical_jid, (NULLIF(full_name, '') IS NULL), (NULLIF(first_name, '') IS NULL)
	`
	if err := bootstrap.DB.Raw(query, project.JID).Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch WhatsApp contacts"})
	}

	return c.JSON(fiber.Map{
		"project_id": project.ID,
		"data":       rows,
	})
}
