# 📱 مشروع WhatsApp API Gateway - وثيقة الغرض والخطة والمعمارية المعتمدة

## 1. الغرض من المشروع (Project Purpose)
بناء **منصة مركزية خاصة وعالية الاعتمادية (Multi-Project WhatsApp API Gateway)** لإدارة وربط حسابات الواتساب لجميع مشاريعك البرمجية (أنظمة الأتمتة، الرد الآلي، وكلاء الذكاء الاصطناعي AI Agents، إشعارات الأنظمة والـ OTP) من مكان واحد، بدون الحاجة لإعادة بناء نظام واتساب في كل مشروع جديد.

### القرارات الأساسية المعتمدة:
1. **نطاق المنصة**: لوحة تحكم خاصة بإدارة مشاريعك وأرقامك (عزل كامل لكل مشروع برقم واتساب مستقل ومفتاح `API Key` خاص به).
2. **أنواع الرسائل المدعومة**:
   - الرسائل النصية (`Text Messages`).
   - الوسائط والملفات (`Media & Files`: صور، ملفات PDF ومستندات، وبصمات صوتية/Audio مع تحويل تلقائي للصيغ).
3. **آلية استقبال الرسائل الواردة**: عبر **Webhook URL** مخصص لكل مشروع مع نظام ضمان الوصول (`Retry Queue`) وتوقيع أمني (`HMAC-SHA256`).

---

## 2. التحسينات التقنية المتقدمة المعتمدة (Enterprise Technical Features)

### 🛡️ أ. نظام حماية الأرقام من الحظر (Anti-Ban & Human Simulation)
- **محاكاة السلوك البشري (`Presence Simulation`)**: إرسال حالة *"جاري الكتابة..."* (`composing`) قبل الرسائل النصية، وحالة *"جاري تسجيل مقطع صوتي..."* (`recording`) قبل البصمات الصوتية لمدة 1–2 ثانية تلقائياً.
- **طابور إرسال ذكي لكل رقم (`Per-Number Rate Limiting & Jitter`)**: جدولة الرسائل الصادرة لكل رقم عبر Redis بفاصل زمني عشوائي ذكي (`1–3 ثوانٍ`) لمنع إرسال عشرات الرسائل في نفس الجزء من الثانية وحماية الرقم من الحظر.

### 🔄 ب. ضمان وصول الـ Webhook والفلترة الذكية (Reliable Webhooks & AI Filtering)
- **إعادة المحاولة التلقائية (`Exponential Backoff Retry`)**: في حال كان سيرفر المشروع المستهدف في حالة إعادة تشغيل أو لم يستجب بـ `2xx`، يعيد النظام المحاولة تلقائياً على فترات متصاعدة (`5s -> 30s -> 2m -> 10m`) مع حفظ سجل المحاولات وإتاحة زر **"إعادة إرسال"** في لوحة التحكم.
- **توقيع أمني (`X-Webhook-Signature`)**: توقيع كل طلب Webhook بواسطة `HMAC-SHA256` باستخدام `webhook_secret` الخاص بالمشروع.
- **فلترة ذكية مخصصة لمشاريع الـ AI**: تجاهل تلقائي لرسائل مزامنة السجل القديم (`History Sync`)، وتحديثات الحالات (`status@broadcast`)، والرسائل الصادرة من نفس الرقم، مع خيار تفعيل/تعطيل استقبال رسائل المجموعات لكل مشروع.

### 🎙️ ج. معالجة الوسائط وتحويل الصوتيات لبصمة واتساب (`FFmpeg PTT Pipeline`)
- **تحويل تلقائي للصوتيات (`MP3 / WAV -> OGG Opus`)**: دمج `ffmpeg` خفيف داخل حاوية Docker لتحويل أي ملف صوتي وارد من مشاريع الذكاء الاصطناعي إلى صيغة `audio/ogg; codecs=opus` القياسية ليظهر للمستلم كـ **بصمة صوتية أصلية (PTT)**.
- **التنظيف التلقائي للملفات المؤقتة (`TTL Media Cleanup`)**: مهمة خلفية دورية لحذف الوسائط المؤقتة القديمة بعد فترة محددة للحفاظ على مساحة القرص في Docker.

### ⚡ د. منع التكرار والاستشفاء الذاتي للجلسات (`Idempotency & Auto-Reconnect`)
- **منع تكرار الرسائل (`Idempotency-Key`)**: دعم ترويسة `Idempotency-Key` في طلبات الإرسال وحفظها في Redis لمدة 24 ساعة لمنع إرسال نفس الرسالة مرتين عند تكرار الطلب من المشروع.
- **استرجاع الجلسات التلقائي (`Auto-Reconnect on Boot`)**: إعادة الاتصال بجميع جلسات الواتساب الفعالة من قاعدة البيانات `PostgreSQL` تلقائياً وبالتوازي (`goroutines`) فور تشغيل حاوية Docker دون الحاجة لإعادة مسح الـ QR Code.

---

## 3. المعمارية التقنية (Technical Architecture)
يعتمد المشروع على إطار العمل **almoq3 Framework**:
- **Backend (`Go + Fiber`)**:
  - مكتبة **`go.mau.fi/whatsmeow`** لإدارة الجلسات المتعددة (`Multi-Device`).
  - `ffmpeg` مدمج داخل صورة Alpine Docker لمعالجة البصمات الصوتية.
- **Database (`PostgreSQL`)**:
  - جداول التطبيق الأساسية (`users`, `projects`, `message_logs`, `webhook_deliveries`).
  - جداول مخزن `whatsmeow` (`sqlstore`) لحفظ مفاتيح التشفير والجلسات بشكل دائم.
- **Cache, Rate-Limiter & Queue (`Redis`)**:
  - طوابير الإرسال لكل رقم، طابور إعادة محاولة الـ Webhooks، ومفاتيح `Idempotency`.
- **Frontend (`React 18 + Tailwind CSS + shadcn/ui`)**:
  - لوحة تحكم متكاملة لإدارة المشاريع، مسح الـ QR Code، مراقبة حالة الأرقام، استعراض سجل الرسائل والـ Webhooks، وتجربة الإرسال المباشر.

---

## 4. تصميم قاعدة البيانات (Database Schema)

### 1. جدول المستخدمين (`users`)
- `id`, `name`, `email`, `password` (`bcrypt`), `created_at`, `updated_at`

### 2. جدول المشاريع (`projects`)
- `id`: المعرف الأساسي
- `user_id`: مالك المشروع
- `name`: اسم المشروع (مثال: `AI Customer Support`, `Clinic Bot`)
- `api_key`: مفتاح الـ API الفريد للمشروع (`wapi_live_...`)
- `webhook_url`: الرابط الذي تُرسل إليه الرسائل الواردة (`POST`)
- `webhook_secret`: مفتاح توقيع `HMAC-SHA256` للـ Webhook
- `allow_groups`: السماح باستقبال رسائل المجموعات (`boolean`, افتراضياً `false`)
- `simulate_typing`: تفعيل محاكاة "جاري الكتابة/التسجيل" (`boolean`, افتراضياً `true`)
- `min_delay_ms`, `max_delay_ms`: الفاصل الزمني الذكي بين الرسائل الصادرة لنفس الرقم (افتراضياً `1000ms - 2500ms`)
- `phone_number`: رقم الواتساب المتصل حالياً
- `jid`: معرف جهاز الواتساب في `whatsmeow` بعد الربط
- `status`: حالة الاتصال (`disconnected`, `qr_ready`, `connected`)
- `created_at`, `updated_at`

### 3. جدول سجل الرسائل والـ Webhooks (`message_logs`)
- `id`: المعرف الأساسي
- `project_id`: المشروع المرتبط
- `message_id`: معرف الرسالة في واتساب أو النظام
- `idempotency_key`: مفتاح عدم التكرار (اختياري)
- `direction`: اتجاه الرسالة (`outbound` صادر / `inbound` وارد)
- `remote_jid`: رقم المرسل أو المستقبل
- `message_type`: نوع الرسالة (`text`, `image`, `document`, `audio`)
- `content`: نص الرسالة أو وصف الملف
- `media_url`: مسار أو رابط الملف المرفق
- `status`: حالة الرسالة (`queued`, `sent`, `delivered`, `failed`)
- `webhook_status`: حالة تسليم الـ Webhook للرسائل الواردة (`pending`, `delivered`, `retrying`, `failed`)
- `webhook_attempts`: عدد محاولات إرسال الـ Webhook
- `last_error`: تفاصيل آخر خطأ (إن وجد)
- `created_at`, `updated_at`

---

## 5. مواصفات الـ API والـ Webhook (API & Webhook Specification)

### أ. مسارات لوحة التحكم (محمية بـ `JWT Token`)
| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/api/v1/auth/register` / `login` | تسجيل حساب / تسجيل الدخول للوحة التحكم |
| `GET` | `/api/v1/projects` | عرض جميع المشاريع وحالة اتصال كل رقم |
| `POST` | `/api/v1/projects` | إنشاء مشروع جديد وتوليد `API Key` و`Webhook Secret` |
| `PUT` | `/api/v1/projects/:id` | تحديث إعدادات المشروع (`webhook_url`, `allow_groups`, `simulate_typing`, إلخ) |
| `DELETE` | `/api/v1/projects/:id` | حذف مشروع وفصل الجلسة المرتبطة به |
| `POST` | `/api/v1/projects/:id/regenerate-key` | إعادة توليد `API Key` للمشروع |
| `GET` | `/api/v1/projects/:id/qr` | بدء جلسة واتساب وجلب الـ `QR Code` |
| `GET` | `/api/v1/projects/:id/status` | فحص حالة الاتصال ورقم الهاتف المرتبط |
| `POST` | `/api/v1/projects/:id/logout` | تسجيل الخروج من واتساب وفصل الرقم |
| `GET` | `/api/v1/projects/:id/messages` | سجل الرسائل الصادرة والواردة وحالة الـ Webhook |
| `POST` | `/api/v1/messages/:id/retry-webhook` | إعادة إرسال Webhook يدوياً لرسالة واردة |

### ب. مسارات المشاريع الخارجية (محمية بترويسة `X-API-Key` وتدعم `Idempotency-Key`)
| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/api/v1/send/text` | إرسال رسالة نصية (`to`, `message`) مع محاكاة الكتابة وطابور الحماية |
| `POST` | `/api/v1/send/image` | إرسال صورة مع نص اختياري (`to`, `image_url` أو `file`, `caption`) |
| `POST` | `/api/v1/send/document` | إرسال ملف PDF أو مستند (`to`, `file_url` أو `file`, `filename`) |
| `POST` | `/api/v1/send/audio` | إرسال بصمة صوتية (`to`, `audio_url` أو `file`) مع تحويل تلقائي لـ `OGG/Opus` ومحاكاة التسجيل |

---

## 6. مراحل التنفيذ (Execution Phases) - مكتملة ✅

1. **المرحلة 1 (Auth, Database & Projects Core)** ✅:
   - [x] تهيئة المصادقة (`JWT Auth`) مع حساب المدير الافتراضي (`admin@whatsapp.local` / `admin123`).
   - [x] إنشاء جداول وموديلات `users` و`projects` و`message_logs` مع الترحيل التلقائي (`AutoMigrate`).
   - [x] بناء Middleware التحقق من `X-API-Key` ([apikey_middleware.go](file:///d:/whtsapapi/whatsapp-api/app/middleware/apikey_middleware.go)) و`Idempotency-Key` ([idempotency_middleware.go](file:///d:/whtsapapi/whatsapp-api/app/middleware/idempotency_middleware.go)).
2. **المرحلة 2 (WhatsApp Multi-Session Engine & Anti-Ban Queue)** ✅:
   - [x] دمج `whatsmeow` + `sqlstore` (PostgreSQL) في [whatsapp_service.go](file:///d:/whtsapapi/whatsapp-api/app/services/whatsapp_service.go).
   - [x] بناء مدير الجلسات المتعددة مع الاسترجاع التلقائي (`Auto-Reconnect`) وتوليد الـ QR Code (`Base64 PNG`).
   - [x] إضافة `ffmpeg` في [Dockerfile](file:///d:/whtsapapi/whatsapp-api/Dockerfile) لتحويل الصوتيات.
3. **المرحلة 3 (Outbound Media/Audio Pipeline & Reliable Webhook Dispatcher)** ✅:
   - [x] بناء طابور الإرسال الذكي مع محاكاة السلوك البشري (`typing`/`recording`) والفاصل العشوائي (`Jitter`) وتحويل الصوتيات (`OGG/Opus`).
   - [x] بناء مستمع الرسائل الواردة مع الفلترة الذكية، توقيع `HMAC-SHA256`، وطابور إعادة محاولة الـ Webhook ([webhook_service.go](file:///d:/whtsapapi/whatsapp-api/app/services/webhook_service.go)) + التنظيف التلقائي للملفات المؤقتة.
4. **المرحلة 4 (React Dashboard)** ✅:
   - [x] بناء لوحة التحكم الكاملة بـ React + Tailwind في [App.jsx](file:///d:/whtsapapi/whatsapp-api/frontend/src/App.jsx) لإدارة المشاريع، مسح الـ QR Code، إعدادات الحماية والـ Webhook، مراقبة السجلات، وتجربة الـ API مباشرة.
