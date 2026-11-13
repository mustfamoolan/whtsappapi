package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"whatsapp-api/app/models"
	"whatsapp-api/bootstrap"
)

type WebhookPayload struct {
	Event       string                 `json:"event"`
	ProjectID   uint                   `json:"project_id"`
	ProjectName string                 `json:"project_name"`
	Timestamp   string                 `json:"timestamp"`
	Data        map[string]interface{} `json:"data"`
}

var webhookHTTPClient = &http.Client{
	Timeout: 12 * time.Second,
}

// ComputeHMACSignature computes HMAC-SHA256 hex digest for the payload
func ComputeHMACSignature(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// DispatchInboundWebhook sends a webhook with automatic exponential backoff retries
func DispatchInboundWebhook(project models.Project, msgLog *models.MessageLog, payload WebhookPayload) {
	if project.WebhookURL == "" {
		return
	}

	go func() {
		backoffSchedule := []time.Duration{
			0,
			5 * time.Second,
			30 * time.Second,
			2 * time.Minute,
			5 * time.Minute,
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return
		}

		for attempt, waitDur := range backoffSchedule {
			if waitDur > 0 {
				time.Sleep(waitDur)
			}

			// Reload project in case webhook_url was updated during retry wait
			var freshProj models.Project
			if err := bootstrap.DB.First(&freshProj, project.ID).Error; err == nil && freshProj.WebhookURL != "" {
				project = freshProj
			}

			req, err := http.NewRequest("POST", project.WebhookURL, bytes.NewReader(bodyBytes))
			if err != nil {
				updateWebhookLog(msgLog.ID, "failed", attempt+1, err.Error())
				continue
			}

			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("User-Agent", "Almoq3-WhatsApp-Gateway/1.0")
			req.Header.Set("X-Webhook-Event", payload.Event)
			if project.WebhookSecret != "" {
				req.Header.Set("X-Webhook-Signature", ComputeHMACSignature(bodyBytes, project.WebhookSecret))
			}

			resp, err := webhookHTTPClient.Do(req)
			if err != nil {
				status := "retrying"
				if attempt == len(backoffSchedule)-1 {
					status = "failed"
				}
				updateWebhookLog(msgLog.ID, status, attempt+1, err.Error())
				continue
			}

			respCode := resp.StatusCode
			_ = resp.Body.Close()

			if respCode >= 200 && respCode < 300 {
				updateWebhookLog(msgLog.ID, "delivered", attempt+1, "")
				return
			}

			status := "retrying"
			if attempt == len(backoffSchedule)-1 {
				status = "failed"
			}
			updateWebhookLog(msgLog.ID, status, attempt+1, fmt.Sprintf("HTTP %d from webhook endpoint", respCode))
		}
	}()
}

// RetryWebhookByLogID manually triggers a webhook delivery for an inbound MessageLog
func RetryWebhookByLogID(logID uint, userID uint) (*models.MessageLog, error) {
	var msgLog models.MessageLog
	if err := bootstrap.DB.First(&msgLog, logID).Error; err != nil {
		return nil, fmt.Errorf("message log not found")
	}

	var project models.Project
	if err := bootstrap.DB.Where("id = ? AND user_id = ?", msgLog.ProjectID, userID).First(&project).Error; err != nil {
		return nil, fmt.Errorf("project not found or unauthorized")
	}

	if project.WebhookURL == "" {
		return nil, fmt.Errorf("webhook_url is not configured for this project")
	}

	payload := WebhookPayload{
		Event:       "message.received",
		ProjectID:   project.ID,
		ProjectName: project.Name,
		Timestamp:   msgLog.CreatedAt.UTC().Format(time.RFC3339),
		Data: map[string]interface{}{
			"message_id": msgLog.MessageID,
			"from":       msgLog.RemoteJID,
			"from_name":  msgLog.SenderName,
			"is_group":   msgLog.IsGroup,
			"type":       msgLog.MessageType,
			"text":       msgLog.Content,
			"media": map[string]interface{}{
				"url":       msgLog.MediaURL,
				"mime_type": msgLog.MimeType,
				"file_name": msgLog.FileName,
			},
			"manual_retry": true,
		},
	}

	updateWebhookLog(msgLog.ID, "retrying", msgLog.WebhookAttempts, "")
	DispatchInboundWebhook(project, &msgLog, payload)
	bootstrap.DB.First(&msgLog, logID)
	return &msgLog, nil
}

func updateWebhookLog(logID uint, webhookStatus string, attempts int, lastErr string) {
	if logID == 0 {
		return
	}
	bootstrap.DB.Model(&models.MessageLog{}).Where("id = ?", logID).Updates(map[string]interface{}{
		"webhook_status":   webhookStatus,
		"webhook_attempts": attempts,
		"last_error":       lastErr,
	})
}
