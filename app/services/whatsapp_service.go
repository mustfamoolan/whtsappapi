package services

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"math/rand"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"whatsapp-api/app/models"
	"whatsapp-api/bootstrap"
	"whatsapp-api/config"

	"github.com/fatih/color"
	_ "github.com/lib/pq"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

type OutboundJob struct {
	LogID      uint
	ProjectID  uint
	ToJID      types.JID
	MsgType    string // text | image | document | audio
	Text       string
	MediaBytes []byte
	MimeType   string
	FileName   string
	Seconds    uint32 // audio duration (voice notes)
	Waveform   []byte // 64-byte waveform for WhatsApp voice note UI
}

type ProjectSession struct {
	ProjectID uint
	Client    *whatsmeow.Client
	Status    string
	QRBase64  string
	QRRaw     string
	SendQueue chan OutboundJob
	StopChan  chan struct{}
	mu        sync.RWMutex
}

type WhatsappManager struct {
	Container *sqlstore.Container
	Sessions  map[uint]*ProjectSession
	mu        sync.RWMutex
}

var WA *WhatsappManager

func InitializeWhatsappManager() {
	dbCfg := config.Global.Database
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		dbCfg.Username, dbCfg.Password, dbCfg.Host, dbCfg.Port, dbCfg.Database)

	container, err := sqlstore.New(context.Background(), "postgres", dsn, nil)
	if err != nil {
		fmt.Printf("%s Failed to initialize whatsmeow sqlstore: %v\n", color.RedString("⚠️"), err)
		return
	}

	WA = &WhatsappManager{
		Container: container,
		Sessions:  make(map[uint]*ProjectSession),
	}

	_ = os.MkdirAll("storage/uploads/inbound", 0755)
	_ = os.MkdirAll("storage/uploads/outbound", 0755)

	// Start TTL Media Cleanup background worker
	go startMediaCleanupWorker()

	// Auto-reconnect previously connected sessions
	go WA.RestoreSessions()

	fmt.Printf("%s WhatsApp Multi-Session Engine initialized\n", color.CyanString("⚙️"))
}

func (m *WhatsappManager) RestoreSessions() {
	var projects []models.Project
	if err := bootstrap.DB.Where("jid != '' AND jid IS NOT NULL").Find(&projects).Error; err != nil {
		return
	}

	for _, proj := range projects {
		p := proj
		go func() {
			jid, err := types.ParseJID(p.JID)
			if err != nil {
				return
			}
			deviceStore, err := m.Container.GetDevice(context.Background(), jid)
			if err != nil || deviceStore == nil {
				bootstrap.DB.Model(&models.Project{}).Where("id = ?", p.ID).Updates(map[string]interface{}{
					"status": "disconnected",
					"jid":    "",
				})
				return
			}

			client := whatsmeow.NewClient(deviceStore, nil)
			sess := m.registerSession(p.ID, client)
			if err := client.Connect(); err == nil {
				sess.setStatus("connected")
				bootstrap.DB.Model(&models.Project{}).Where("id = ?", p.ID).Update("status", "connected")
				fmt.Printf("%s Restored WhatsApp session for project [%s] (%s)\n", color.GreenString("✓"), p.Name, p.PhoneNumber)
			}
		}()
	}
}

func (m *WhatsappManager) registerSession(projectID uint, client *whatsmeow.Client) *ProjectSession {
	m.mu.Lock()
	defer m.mu.Unlock()

	if old, exists := m.Sessions[projectID]; exists {
		close(old.StopChan)
		if old.Client != nil && old.Client.IsConnected() {
			old.Client.Disconnect()
		}
	}

	sess := &ProjectSession{
		ProjectID: projectID,
		Client:    client,
		Status:    "disconnected",
		SendQueue: make(chan OutboundJob, 200),
		StopChan:  make(chan struct{}),
	}

	client.AddEventHandler(func(evt interface{}) {
		m.handleEvent(projectID, sess, evt)
	})

	go m.runOutboundWorker(sess)

	m.Sessions[projectID] = sess
	return sess
}

func (s *ProjectSession) setStatus(status string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Status = status
}

func (s *ProjectSession) setQR(raw, b64 string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.QRRaw = raw
	s.QRBase64 = b64
	if b64 != "" {
		s.Status = "qr_ready"
	}
}

func (s *ProjectSession) GetSnapshot() (status, qrB64, qrRaw string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status, s.QRBase64, s.QRRaw
}

func (m *WhatsappManager) GetSession(projectID uint) *ProjectSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.Sessions[projectID]
}

// StartOrGetQR initializes a WhatsApp session and returns QR code base64 image
func (m *WhatsappManager) StartOrGetQR(project *models.Project) (status string, qrBase64 string, phone string, err error) {
	if m == nil || m.Container == nil {
		return "", "", "", fmt.Errorf("WhatsApp manager is not initialized")
	}

	existing := m.GetSession(project.ID)
	if existing != nil && existing.Client != nil {
		if existing.Client.Store != nil && existing.Client.Store.ID != nil {
			phone = existing.Client.Store.ID.User
			if existing.Client.IsLoggedIn() {
				existing.setStatus("connected")
				return "connected", "", phone, nil
			}
			// Paired device exists and is reconnecting; do NOT overwrite with a new QR device
			if !existing.Client.IsConnected() {
				_ = existing.Client.Connect()
			}
			if existing.Client.IsLoggedIn() {
				existing.setStatus("connected")
				return "connected", "", phone, nil
			}
			return "connecting", "", phone, nil
		}
		st, b64, _ := existing.GetSnapshot()
		if st == "qr_ready" && b64 != "" && existing.Client.IsConnected() {
			return "qr_ready", b64, "", nil
		}
	}

	// If project already has a saved JID in DB, try restoring it from sqlstore instead of wiping with NewDevice()
	if project.JID != "" {
		if jid, parseErr := types.ParseJID(project.JID); parseErr == nil {
			if deviceStore, devErr := m.Container.GetDevice(context.Background(), jid); devErr == nil && deviceStore != nil && deviceStore.ID != nil {
				client := whatsmeow.NewClient(deviceStore, nil)
				sess := m.registerSession(project.ID, client)
				if connErr := client.Connect(); connErr == nil {
					if client.IsLoggedIn() {
						sess.setStatus("connected")
						bootstrap.DB.Model(&models.Project{}).Where("id = ?", project.ID).Update("status", "connected")
						return "connected", "", deviceStore.ID.User, nil
					}
					return "connecting", "", deviceStore.ID.User, nil
				}
			}
		}
	}

	deviceStore := m.Container.NewDevice()
	client := whatsmeow.NewClient(deviceStore, nil)
	sess := m.registerSession(project.ID, client)

	qrChan, err := client.GetQRChannel(context.Background())
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get QR channel: %w", err)
	}

	if err := client.Connect(); err != nil {
		return "", "", "", fmt.Errorf("failed to connect to WhatsApp: %w", err)
	}

	firstQRReady := make(chan string, 1)
	go func() {
		sentFirst := false
		for evt := range qrChan {
			if evt.Event == "code" {
				pngBytes, qrErr := qrcode.Encode(evt.Code, qrcode.Medium, 300)
				if qrErr == nil {
					b64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
					sess.setQR(evt.Code, b64)
					bootstrap.DB.Model(&models.Project{}).Where("id = ?", project.ID).Update("status", "qr_ready")
					if !sentFirst {
						sentFirst = true
						firstQRReady <- b64
					}
				}
			} else if evt.Event == "success" {
				sess.setQR("", "")
				sess.setStatus("connected")
				if !sentFirst {
					sentFirst = true
					firstQRReady <- ""
				}
			} else {
				sess.setQR("", "")
				sess.setStatus("disconnected")
				bootstrap.DB.Model(&models.Project{}).Where("id = ?", project.ID).Update("status", "disconnected")
				if !sentFirst {
					sentFirst = true
					firstQRReady <- ""
				}
			}
		}
	}()

	select {
	case b64 := <-firstQRReady:
		if b64 != "" {
			return "qr_ready", b64, "", nil
		}
		st, _, _ := sess.GetSnapshot()
		return st, "", project.PhoneNumber, nil
	case <-time.After(10 * time.Second):
		st, b64, _ := sess.GetSnapshot()
		return st, b64, "", nil
	}
}

func (m *WhatsappManager) LogoutSession(project *models.Project) error {
	sess := m.GetSession(project.ID)
	if sess != nil && sess.Client != nil {
		_ = sess.Client.Logout(context.Background())
		sess.Client.Disconnect()
		if sess.Client.Store != nil {
			_ = sess.Client.Store.Delete(context.Background())
		}
		sess.setQR("", "")
		sess.setStatus("disconnected")
	}

	m.mu.Lock()
	delete(m.Sessions, project.ID)
	m.mu.Unlock()

	bootstrap.DB.Model(&models.Project{}).Where("id = ?", project.ID).Updates(map[string]interface{}{
		"status":       "disconnected",
		"phone_number": "",
		"jid":          "",
	})
	return nil
}

func (m *WhatsappManager) handleEvent(projectID uint, sess *ProjectSession, rawEvt interface{}) {
	switch evt := rawEvt.(type) {
	case *events.PairSuccess:
		jidStr := evt.ID.String()
		phone := evt.ID.User
		sess.setQR("", "")
		sess.setStatus("connected")
		bootstrap.DB.Model(&models.Project{}).Where("id = ?", projectID).Updates(map[string]interface{}{
			"status":       "connected",
			"jid":          jidStr,
			"phone_number": phone,
		})

	case *events.Connected:
		sess.setQR("", "")
		sess.setStatus("connected")
		updates := map[string]interface{}{"status": "connected"}
		if sess.Client != nil && sess.Client.Store != nil && sess.Client.Store.ID != nil {
			updates["jid"] = sess.Client.Store.ID.String()
			updates["phone_number"] = sess.Client.Store.ID.User
		}
		bootstrap.DB.Model(&models.Project{}).Where("id = ?", projectID).Updates(updates)

	case *events.LoggedOut:
		sess.setQR("", "")
		sess.setStatus("disconnected")
		var proj models.Project
		if err := bootstrap.DB.First(&proj, projectID).Error; err == nil {
			bootstrap.DB.Model(&models.Project{}).Where("id = ?", projectID).Updates(map[string]interface{}{
				"status":       "disconnected",
				"jid":          "",
				"phone_number": "",
			})
			if proj.WebhookURL != "" {
				DispatchInboundWebhook(proj, &models.MessageLog{}, WebhookPayload{
					Event:       "session.disconnected",
					ProjectID:   proj.ID,
					ProjectName: proj.Name,
					Timestamp:   time.Now().UTC().Format(time.RFC3339),
					Data: map[string]interface{}{
						"reason": "logged_out",
					},
				})
			}
		}

	case *events.Receipt:
		// Delivery / read receipts for messages we sent -> update status + notify external project
		if evt.IsFromMe {
			return
		}
		newStatus := ""
		switch evt.Type {
		case types.ReceiptTypeDelivered:
			newStatus = "delivered"
		case types.ReceiptTypeRead, types.ReceiptTypeReadSelf, types.ReceiptTypePlayed:
			newStatus = "read"
		}
		if newStatus == "" || len(evt.MessageIDs) == 0 {
			return
		}
		var logs []models.MessageLog
		bootstrap.DB.Where("project_id = ? AND direction = ? AND message_id IN ?", projectID, "outbound", evt.MessageIDs).Find(&logs)
		if len(logs) == 0 {
			return
		}
		var proj models.Project
		_ = bootstrap.DB.First(&proj, projectID).Error
		for _, l := range logs {
			if l.Status == "read" || (l.Status == newStatus) {
				continue
			}
			bootstrap.DB.Model(&models.MessageLog{}).Where("id = ?", l.ID).Update("status", newStatus)
			dispatchOutboundStatusWebhook(proj, l.ID, "message.status", newStatus, l.MessageID, "")
		}

	case *events.Message:
		m.handleIncomingMessage(projectID, sess, evt)
	}
}

func (m *WhatsappManager) handleIncomingMessage(projectID uint, sess *ProjectSession, evt *events.Message) {
	// 1. Smart AI Filtering: Ignore self messages, status broadcasts, and old history sync messages
	if evt.Info.IsFromMe {
		return
	}
	if evt.Info.Chat.String() == "status@broadcast" || evt.Info.Chat.Server == "broadcast" {
		return
	}
	// Accept offline messages delivered after a reconnect/restart (up to 24h), skip very old history
	if time.Since(evt.Info.Timestamp) > 24*time.Hour {
		return
	}

	var project models.Project
	if err := bootstrap.DB.First(&project, projectID).Error; err != nil {
		return
	}

	// Deduplicate: WhatsApp may redeliver the same message after reconnects
	var dupCount int64
	bootstrap.DB.Model(&models.MessageLog{}).
		Where("project_id = ? AND direction = ? AND message_id = ?", projectID, "inbound", evt.Info.ID).
		Count(&dupCount)
	if dupCount > 0 {
		return
	}

	// Check group filter
	if evt.Info.IsGroup && !project.AllowGroups {
		return
	}

	msgType := "text"
	textContent := ""
	mediaURL := ""
	mimeType := ""
	fileName := ""

	msg := evt.Message
	if msg == nil {
		return
	}

	ctx := context.Background()

	if msg.GetConversation() != "" {
		msgType = "text"
		textContent = msg.GetConversation()
	} else if msg.GetExtendedTextMessage() != nil {
		msgType = "text"
		textContent = msg.GetExtendedTextMessage().GetText()
	} else if img := msg.GetImageMessage(); img != nil {
		msgType = "image"
		textContent = img.GetCaption()
		mimeType = img.GetMimetype()
		if data, err := sess.Client.Download(ctx, img); err == nil {
			mediaURL, fileName = saveInboundMedia(projectID, evt.Info.ID, mimeType, "jpg", data)
		}
	} else if doc := msg.GetDocumentMessage(); doc != nil {
		msgType = "document"
		textContent = doc.GetCaption()
		mimeType = doc.GetMimetype()
		origName := doc.GetFileName()
		if data, err := sess.Client.Download(ctx, doc); err == nil {
			mediaURL, fileName = saveInboundMediaWithName(projectID, evt.Info.ID, origName, mimeType, data)
		}
	} else if aud := msg.GetAudioMessage(); aud != nil {
		msgType = "audio"
		mimeType = aud.GetMimetype()
		if data, err := sess.Client.Download(ctx, aud); err == nil {
			mediaURL, fileName = saveInboundMedia(projectID, evt.Info.ID, "audio/ogg", "ogg", data)
		}
	} else if vid := msg.GetVideoMessage(); vid != nil {
		msgType = "video"
		textContent = vid.GetCaption()
		mimeType = vid.GetMimetype()
		if data, err := sess.Client.Download(ctx, vid); err == nil {
			mediaURL, fileName = saveInboundMedia(projectID, evt.Info.ID, mimeType, "mp4", data)
		}
	} else if stk := msg.GetStickerMessage(); stk != nil {
		msgType = "sticker"
		mimeType = stk.GetMimetype()
		if data, err := sess.Client.Download(ctx, stk); err == nil {
			mediaURL, fileName = saveInboundMedia(projectID, evt.Info.ID, mimeType, "webp", data)
		}
	} else {
		// Ignore unsupported protocol reactions/receipts
		return
	}

	webhookStatus := "none"
	if project.WebhookURL != "" {
		webhookStatus = "pending"
	}

	remoteJID := evt.Info.Sender
	if evt.Info.IsGroup {
		remoteJID = evt.Info.Chat
	} else {
		if remoteJID.Server == types.HiddenUserServer {
			if evt.Info.SenderAlt.Server == types.DefaultUserServer && evt.Info.SenderAlt.User != "" {
				remoteJID = evt.Info.SenderAlt
			} else if pn, err := sess.Client.Store.LIDs.GetPNForLID(ctx, remoteJID); err == nil && !pn.IsEmpty() {
				remoteJID = pn
			}
		}
		if remoteJID.Server == types.DefaultUserServer {
			remoteJID = types.NewJID(remoteJID.User, types.DefaultUserServer)
		}
	}
	senderPhone := remoteJID.String()

	msgLog := models.MessageLog{
		ProjectID:     project.ID,
		MessageID:     evt.Info.ID,
		Direction:     "inbound",
		RemoteJID:     senderPhone,
		SenderName:    evt.Info.PushName,
		IsGroup:       evt.Info.IsGroup,
		MessageType:   msgType,
		Content:       textContent,
		MediaURL:      mediaURL,
		MimeType:      mimeType,
		FileName:      fileName,
		Status:        "delivered",
		WebhookStatus: webhookStatus,
	}
	bootstrap.DB.Create(&msgLog)

	if project.WebhookURL != "" {
		payload := WebhookPayload{
			Event:       "message.received",
			ProjectID:   project.ID,
			ProjectName: project.Name,
			Timestamp:   evt.Info.Timestamp.UTC().Format(time.RFC3339),
			Data: map[string]interface{}{
				"log_id":     msgLog.ID,
				"message_id": evt.Info.ID,
				"from":       remoteJID.User,
				"chat_jid":   senderPhone,
				"from_name":  evt.Info.PushName,
				"is_group":   evt.Info.IsGroup,
				"type":       msgType,
				"text":       textContent,
				"media": map[string]interface{}{
					"url":       mediaURL,
					"mime_type": mimeType,
					"file_name": fileName,
				},
			},
		}
		DispatchInboundWebhook(project, &msgLog, payload)
	}
}

func saveInboundMedia(projectID uint, msgID, mimeType, defaultExt string, data []byte) (string, string) {
	ext := defaultExt
	if exts, err := mime.ExtensionsByType(mimeType); err == nil && len(exts) > 0 {
		ext = strings.TrimPrefix(exts[0], ".")
	}
	name := fmt.Sprintf("proj_%d_%s.%s", projectID, msgID, ext)
	relPath := filepath.Join("storage", "uploads", "inbound", name)
	_ = os.WriteFile(relPath, data, 0644)
	url := fmt.Sprintf("%s/uploads/inbound/%s", strings.TrimRight(config.Global.App.URL, "/"), name)
	return url, name
}

func saveInboundMediaWithName(projectID uint, msgID, origName, mimeType string, data []byte) (string, string) {
	safeName := filepath.Base(origName)
	if safeName == "" || safeName == "." {
		return saveInboundMedia(projectID, msgID, mimeType, "bin", data)
	}
	name := fmt.Sprintf("proj_%d_%s_%s", projectID, msgID, safeName)
	relPath := filepath.Join("storage", "uploads", "inbound", name)
	_ = os.WriteFile(relPath, data, 0644)
	url := fmt.Sprintf("%s/uploads/inbound/%s", strings.TrimRight(config.Global.App.URL, "/"), name)
	return url, safeName
}

// EnqueueOutboundMessage validates the session and queues a message into the per-number Anti-Ban worker
func (m *WhatsappManager) EnqueueOutboundMessage(project *models.Project, to string, msgType, text string, mediaBytes []byte, mimeType, fileName, idemKey string) (*models.MessageLog, error) {
	sess := m.GetSession(project.ID)
	if sess == nil || sess.Client == nil || !sess.Client.IsLoggedIn() {
		return nil, fmt.Errorf("WhatsApp session for project '%s' is not connected", project.Name)
	}

	targetJID, err := parseRecipientJID(to)
	if err != nil {
		return nil, err
	}

	// Resolve LID to canonical phone JID if needed
	if targetJID.Server == types.HiddenUserServer || (targetJID.Server == types.DefaultUserServer && len(targetJID.User) >= 14) {
		lidLookup := types.NewJID(targetJID.User, types.HiddenUserServer)
		if pn, lidErr := sess.Client.Store.LIDs.GetPNForLID(context.Background(), lidLookup); lidErr == nil && !pn.IsEmpty() {
			targetJID = types.NewJID(pn.User, types.DefaultUserServer)
		}
	}

	// Voice notes: convert ANY input (webm, mp3, m4a, wav, ogg...) to real OGG/Opus PTT before queueing
	var audioSeconds uint32
	var audioWaveform []byte
	if msgType == "audio" {
		if len(mediaBytes) == 0 {
			return nil, fmt.Errorf("audio content is empty")
		}
		oggBytes, secs, wave, convErr := PrepareVoiceNote(mediaBytes)
		if convErr != nil {
			return nil, fmt.Errorf("invalid or unsupported audio file: %v", convErr)
		}
		mediaBytes = oggBytes
		audioSeconds = secs
		audioWaveform = wave
		mimeType = "audio/ogg; codecs=opus"
		if fileName == "" || !strings.HasSuffix(strings.ToLower(fileName), ".ogg") {
			fileName = fmt.Sprintf("voice_%d.ogg", time.Now().Unix())
		}
	}

	var outboundMediaURL string
	if len(mediaBytes) > 0 {
		ext := "bin"
		if msgType == "audio" {
			ext = "ogg"
		} else if fileName != "" && strings.Contains(fileName, ".") {
			ext = strings.TrimPrefix(filepath.Ext(fileName), ".")
		} else if exts, extErr := mime.ExtensionsByType(mimeType); extErr == nil && len(exts) > 0 {
			ext = strings.TrimPrefix(exts[0], ".")
		} else if msgType == "image" {
			ext = "jpg"
		}
		outName := fmt.Sprintf("proj_%d_%d.%s", project.ID, time.Now().UnixNano(), ext)
		relPath := filepath.Join("storage", "uploads", "outbound", outName)
		if writeErr := os.WriteFile(relPath, mediaBytes, 0644); writeErr == nil {
			outboundMediaURL = fmt.Sprintf("%s/uploads/outbound/%s", strings.TrimRight(config.Global.App.URL, "/"), outName)
		}
	}

	msgLog := &models.MessageLog{
		ProjectID:      project.ID,
		IdempotencyKey: idemKey,
		Direction:      "outbound",
		RemoteJID:      targetJID.String(),
		IsGroup:        targetJID.Server == types.GroupServer,
		MessageType:    msgType,
		Content:        text,
		MediaURL:       outboundMediaURL,
		MimeType:       mimeType,
		FileName:       fileName,
		Status:         "queued",
		WebhookStatus:  "none",
	}

	if err := bootstrap.DB.Create(msgLog).Error; err != nil {
		return nil, fmt.Errorf("failed to create message log: %w", err)
	}

	job := OutboundJob{
		LogID:      msgLog.ID,
		ProjectID:  project.ID,
		ToJID:      targetJID,
		MsgType:    msgType,
		Text:       text,
		MediaBytes: mediaBytes,
		MimeType:   mimeType,
		FileName:   fileName,
		Seconds:    audioSeconds,
		Waveform:   audioWaveform,
	}

	select {
	case sess.SendQueue <- job:
		return msgLog, nil
	default:
		bootstrap.DB.Model(msgLog).Updates(map[string]interface{}{
			"status":     "failed",
			"last_error": "Outbound queue is full",
		})
		return nil, fmt.Errorf("outbound queue is full for project")
	}
}

func (m *WhatsappManager) runOutboundWorker(sess *ProjectSession) {
	for {
		select {
		case <-sess.StopChan:
			return
		case job := <-sess.SendQueue:
			m.processOutboundJob(sess, job)
		}
	}
}

func (m *WhatsappManager) processOutboundJob(sess *ProjectSession, job OutboundJob) {
	var project models.Project
	if err := bootstrap.DB.First(&project, job.ProjectID).Error; err != nil {
		return
	}

	ctx := context.Background()

	// 1. Anti-Ban Human Presence Simulation (Typing / Recording Audio)
	if project.SimulateTyping {
		if job.MsgType == "audio" {
			_ = sess.Client.SendChatPresence(ctx, job.ToJID, types.ChatPresenceComposing, types.ChatPresenceMediaAudio)
			time.Sleep(1400 * time.Millisecond)
			_ = sess.Client.SendChatPresence(ctx, job.ToJID, types.ChatPresencePaused, types.ChatPresenceMediaAudio)
		} else {
			_ = sess.Client.SendChatPresence(ctx, job.ToJID, types.ChatPresenceComposing, types.ChatPresenceMediaText)
			time.Sleep(1100 * time.Millisecond)
			_ = sess.Client.SendChatPresence(ctx, job.ToJID, types.ChatPresencePaused, types.ChatPresenceMediaText)
		}
	}

	var waMsg *waE2E.Message
	var sendErr error

	switch job.MsgType {
	case "text":
		waMsg = &waE2E.Message{
			Conversation: proto.String(job.Text),
		}

	case "image":
		upResp, err := sess.Client.Upload(ctx, job.MediaBytes, whatsmeow.MediaImage)
		if err != nil {
			sendErr = fmt.Errorf("image upload failed: %w", err)
			break
		}
		if job.MimeType == "" {
			job.MimeType = http.DetectContentType(job.MediaBytes)
		}
		waMsg = &waE2E.Message{
			ImageMessage: &waE2E.ImageMessage{
				Caption:       proto.String(job.Text),
				Mimetype:      proto.String(job.MimeType),
				URL:           &upResp.URL,
				DirectPath:    &upResp.DirectPath,
				MediaKey:      upResp.MediaKey,
				FileEncSHA256: upResp.FileEncSHA256,
				FileSHA256:    upResp.FileSHA256,
				FileLength:    &upResp.FileLength,
			},
		}

	case "document":
		upResp, err := sess.Client.Upload(ctx, job.MediaBytes, whatsmeow.MediaDocument)
		if err != nil {
			sendErr = fmt.Errorf("document upload failed: %w", err)
			break
		}
		if job.MimeType == "" {
			job.MimeType = "application/octet-stream"
		}
		if job.FileName == "" {
			job.FileName = "document.pdf"
		}
		waMsg = &waE2E.Message{
			DocumentMessage: &waE2E.DocumentMessage{
				Title:         proto.String(job.FileName),
				FileName:      proto.String(job.FileName),
				Caption:       proto.String(job.Text),
				Mimetype:      proto.String(job.MimeType),
				URL:           &upResp.URL,
				DirectPath:    &upResp.DirectPath,
				MediaKey:      upResp.MediaKey,
				FileEncSHA256: upResp.FileEncSHA256,
				FileSHA256:    upResp.FileSHA256,
				FileLength:    &upResp.FileLength,
			},
		}

	case "audio":
		// job.MediaBytes is already a validated OGG/Opus voice note (converted in EnqueueOutboundMessage)
		upResp, err := sess.Client.Upload(ctx, job.MediaBytes, whatsmeow.MediaAudio)
		if err != nil {
			sendErr = fmt.Errorf("audio upload failed: %w", err)
			break
		}
		secs := job.Seconds
		if secs == 0 {
			secs = 1
		}
		audioMsg := &waE2E.AudioMessage{
			Mimetype:      proto.String("audio/ogg; codecs=opus"),
			PTT:           proto.Bool(true),
			Seconds:       proto.Uint32(secs),
			URL:           &upResp.URL,
			DirectPath:    &upResp.DirectPath,
			MediaKey:      upResp.MediaKey,
			FileEncSHA256: upResp.FileEncSHA256,
			FileSHA256:    upResp.FileSHA256,
			FileLength:    &upResp.FileLength,
		}
		if len(job.Waveform) > 0 {
			audioMsg.Waveform = job.Waveform
		}
		waMsg = &waE2E.Message{AudioMessage: audioMsg}
	}

	if sendErr == nil && waMsg != nil {
		resp, err := sess.Client.SendMessage(ctx, job.ToJID, waMsg)
		if err != nil {
			sendErr = err
		} else {
			bootstrap.DB.Model(&models.MessageLog{}).Where("id = ?", job.LogID).Updates(map[string]interface{}{
				"message_id": resp.ID,
				"status":     "sent",
				"last_error": "",
			})
			dispatchOutboundStatusWebhook(project, job.LogID, "message.sent", "sent", resp.ID, "")
		}
	}

	if sendErr != nil {
		bootstrap.DB.Model(&models.MessageLog{}).Where("id = ?", job.LogID).Updates(map[string]interface{}{
			"status":     "failed",
			"last_error": sendErr.Error(),
		})
		dispatchOutboundStatusWebhook(project, job.LogID, "message.failed", "failed", "", sendErr.Error())
	}

	// 2. Per-Number Anti-Ban Random Jitter Delay before next message
	minMs := project.MinDelayMs
	maxMs := project.MaxDelayMs
	if minMs < 0 {
		minMs = 0
	}
	if maxMs < minMs {
		maxMs = minMs
	}
	if maxMs > 0 {
		jitter := minMs
		if maxMs > minMs {
			jitter += rand.Intn(maxMs - minMs + 1)
		}
		time.Sleep(time.Duration(jitter) * time.Millisecond)
	}
}

// PrepareVoiceNote converts any audio input (webm, mp3, m4a, wav, ogg...) into a WhatsApp-compatible
// OGG/Opus mono 48kHz voice note, and returns its real duration (seconds) and a 64-byte waveform.
// It never falls back to the original bytes: a broken voice note is rejected with an error.
func PrepareVoiceNote(inputBytes []byte) ([]byte, uint32, []byte, error) {
	tmpDir := os.TempDir()
	stamp := time.Now().UnixNano()
	tmpIn := filepath.Join(tmpDir, fmt.Sprintf("vn_in_%d", stamp))
	tmpOut := filepath.Join(tmpDir, fmt.Sprintf("vn_out_%d.ogg", stamp))
	defer func() {
		_ = os.Remove(tmpIn)
		_ = os.Remove(tmpOut)
	}()

	if err := os.WriteFile(tmpIn, inputBytes, 0644); err != nil {
		return nil, 0, nil, fmt.Errorf("failed to write temp audio: %w", err)
	}

	cmd := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
		"-i", tmpIn,
		"-vn", "-map_metadata", "-1",
		"-ac", "1", "-ar", "48000",
		"-c:a", "libopus", "-b:a", "32k", "-vbr", "on", "-application", "voip",
		"-f", "ogg", tmpOut)
	if out, err := cmd.CombinedOutput(); err != nil {
		msg := strings.TrimSpace(string(out))
		if len(msg) > 200 {
			msg = msg[:200]
		}
		return nil, 0, nil, fmt.Errorf("ffmpeg conversion failed: %s", msg)
	}

	outBytes, err := os.ReadFile(tmpOut)
	if err != nil || len(outBytes) < 100 {
		return nil, 0, nil, fmt.Errorf("converted voice note is empty")
	}

	// Real duration via ffprobe
	var seconds uint32 = 1
	if probeOut, probeErr := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1", tmpOut).Output(); probeErr == nil {
		var dur float64
		if _, scanErr := fmt.Sscanf(strings.TrimSpace(string(probeOut)), "%f", &dur); scanErr == nil && dur > 0 {
			seconds = uint32(dur + 0.5)
			if seconds < 1 {
				seconds = 1
			}
		}
	}

	return outBytes, seconds, buildWaveform(tmpOut), nil
}

// buildWaveform decodes the audio to 8kHz mono PCM and returns 64 amplitude buckets (0-100)
func buildWaveform(path string) []byte {
	pcm, err := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error",
		"-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-").Output()
	if err != nil || len(pcm) < 128 {
		return nil
	}
	samples := len(pcm) / 2
	const buckets = 64
	per := samples / buckets
	if per < 1 {
		return nil
	}
	levels := make([]float64, buckets)
	var peak float64
	for b := 0; b < buckets; b++ {
		var sum float64
		for i := b * per; i < (b+1)*per; i++ {
			v := float64(int16(uint16(pcm[2*i]) | uint16(pcm[2*i+1])<<8))
			if v < 0 {
				v = -v
			}
			sum += v
		}
		levels[b] = sum / float64(per)
		if levels[b] > peak {
			peak = levels[b]
		}
	}
	wave := make([]byte, buckets)
	for i, l := range levels {
		if peak > 0 {
			wave[i] = byte(l / peak * 100)
		}
	}
	return wave
}

// NormalizeRecipient exposes recipient normalization (Iraqi default 964, LID-safe) for controllers
func NormalizeRecipient(to string) string {
	jid, err := parseRecipientJID(to)
	if err != nil {
		return ""
	}
	return jid.String()
}

// dispatchOutboundStatusWebhook notifies the external project about outbound message status changes
func dispatchOutboundStatusWebhook(project models.Project, logID uint, event, status, waMessageID, errMsg string) {
	if project.WebhookURL == "" || logID == 0 {
		return
	}
	var msgLog models.MessageLog
	if err := bootstrap.DB.First(&msgLog, logID).Error; err != nil {
		return
	}
	data := map[string]interface{}{
		"log_id":          msgLog.ID,
		"message_id":      waMessageID,
		"idempotency_key": msgLog.IdempotencyKey,
		"to":              strings.Split(msgLog.RemoteJID, "@")[0],
		"chat_jid":        msgLog.RemoteJID,
		"type":            msgLog.MessageType,
		"status":          status,
	}
	if waMessageID == "" {
		data["message_id"] = msgLog.MessageID
	}
	if errMsg != "" {
		data["error"] = errMsg
	}
	payload := WebhookPayload{
		Event:       event,
		ProjectID:   project.ID,
		ProjectName: project.Name,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		Data:        data,
	}
	// Use logID 0 so outbound status webhooks don't overwrite the message's own last_error
	DispatchInboundWebhook(project, &models.MessageLog{}, payload)
}

func parseRecipientJID(to string) (types.JID, error) {
	clean := strings.TrimSpace(to)
	if clean == "" {
		return types.EmptyJID, fmt.Errorf("recipient 'to' is required")
	}
	if strings.Contains(clean, "@") {
		return types.ParseJID(clean)
	}
	// Strip +, spaces, dashes
	var digits strings.Builder
	for _, r := range clean {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	num := digits.String()
	if strings.HasPrefix(num, "00") {
		num = strings.TrimPrefix(num, "00")
	} else if strings.HasPrefix(num, "0") {
		// Default local Iraqi number (e.g. 07742209251 -> 9647742209251)
		num = "964" + strings.TrimPrefix(num, "0")
	} else if len(num) == 10 && strings.HasPrefix(num, "7") {
		// Iraqi mobile number without leading 0 or country code (e.g. 7742209251 -> 9647742209251)
		num = "964" + num
	}
	if len(num) < 7 {
		return types.EmptyJID, fmt.Errorf("invalid phone number: %s", to)
	}
	return types.NewJID(num, types.DefaultUserServer), nil
}

// FetchMediaFromURLOrBytes downloads remote media URL if provided
func FetchMediaFromURL(mediaURL string) ([]byte, string, string, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Get(mediaURL)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to download media from URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", "", fmt.Errorf("media URL returned status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 25*1024*1024)) // 25MB limit
	if err != nil {
		return nil, "", "", err
	}

	mimeType := resp.Header.Get("Content-Type")
	fileName := filepath.Base(mediaURL)
	return data, mimeType, fileName, nil
}

func startMediaCleanupWorker() {
	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		cleanupDir("storage/uploads/inbound", 48*time.Hour)
		cleanupDir("storage/uploads/outbound", 2*time.Hour)
	}
}

func cleanupDir(dir string, maxAge time.Duration) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	now := time.Now()
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err == nil && now.Sub(info.ModTime()) > maxAge {
			_ = os.Remove(filepath.Join(dir, entry.Name()))
		}
	}
}
