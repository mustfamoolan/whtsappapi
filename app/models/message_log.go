package models

import (
	"time"
)

type MessageLog struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ProjectID       uint      `gorm:"index;not null" json:"project_id"`
	MessageID       string    `gorm:"size:128;index" json:"message_id"`
	IdempotencyKey  string    `gorm:"size:128;index" json:"idempotency_key,omitempty"`
	Direction       string    `gorm:"size:16;index;not null" json:"direction"` // outbound | inbound
	RemoteJID       string    `gorm:"size:128;index;not null" json:"remote_jid"`
	SenderName      string    `gorm:"size:255" json:"sender_name,omitempty"`
	IsGroup         bool      `gorm:"default:false" json:"is_group"`
	MessageType     string    `gorm:"size:32;not null" json:"message_type"` // text | image | document | audio
	Content         string    `gorm:"type:text" json:"content"`
	MediaURL        string    `gorm:"size:512" json:"media_url,omitempty"`
	MimeType        string    `gorm:"size:128" json:"mime_type,omitempty"`
	FileName        string    `gorm:"size:255" json:"file_name,omitempty"`
	Status          string    `gorm:"size:32;default:'queued'" json:"status"`           // queued | sent | delivered | failed
	WebhookStatus   string    `gorm:"size:32;default:'none'" json:"webhook_status"`     // none | pending | delivered | retrying | failed
	WebhookAttempts int       `gorm:"default:0" json:"webhook_attempts"`
	LastError       string    `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

