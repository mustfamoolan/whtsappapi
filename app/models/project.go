package models

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"gorm.io/gorm"
)

type Project struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	UserID         uint           `gorm:"index;not null" json:"user_id"`
	Name           string         `gorm:"size:255;not null" json:"name"`
	Description    string         `gorm:"size:500" json:"description"`
	APIKey         string         `gorm:"column:api_key;uniqueIndex;size:128;not null" json:"api_key"`
	WebhookURL     string         `gorm:"column:webhook_url;size:512" json:"webhook_url"`
	WebhookSecret  string         `gorm:"column:webhook_secret;size:128" json:"webhook_secret"`
	AllowGroups    bool           `gorm:"column:allow_groups;default:false" json:"allow_groups"`
	SimulateTyping bool           `gorm:"column:simulate_typing;default:true" json:"simulate_typing"`
	MinDelayMs     int            `gorm:"column:min_delay_ms;default:1000" json:"min_delay_ms"`
	MaxDelayMs     int            `gorm:"column:max_delay_ms;default:2500" json:"max_delay_ms"`
	PhoneNumber    string         `gorm:"column:phone_number;size:64" json:"phone_number"`
	JID            string         `gorm:"column:jid;size:128" json:"jid"`
	Status         string         `gorm:"size:32;default:'disconnected'" json:"status"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func GenerateRandomToken(prefix string, byteLen int) string {
	b := make([]byte, byteLen)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func GenerateAPIKey() string {
	return GenerateRandomToken("wapi_live_", 20)
}

func GenerateWebhookSecret() string {
	return GenerateRandomToken("whsec_", 16)
}

