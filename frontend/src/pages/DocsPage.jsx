import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const ENDPOINTS = [
  {
    id: 'text',
    method: 'POST',
    path: '/api/v1/send/text',
    title: 'إرسال رسالة نصية',
    desc: 'إضافة رسالة نصية إلى طابور الإرسال الذكي مع محاكاة "جاري الكتابة..." والفاصل العشوائي.',
    fields: [
      { name: 'to', type: 'string', required: true, desc: 'رقم المستلم مع رمز الدولة (مثال: 966501234567)' },
      { name: 'message', type: 'string', required: true, desc: 'نص الرسالة المراد إرسالها' },
    ],
    sampleBody: {
      to: '966501234567',
      message: 'مرحباً! تم تأكيد طلبك #1042 بنجاح.',
    },
  },
  {
    id: 'image',
    method: 'POST',
    path: '/api/v1/send/image',
    title: 'إرسال صورة',
    desc: 'إرسال صورة عبر رابط مباشر (media_url / image_url) أو رفع ملف multipart/form-data (حقل file) أو base64.',
    fields: [
      { name: 'to', type: 'string', required: true, desc: 'رقم المستلم مع رمز الدولة' },
      { name: 'media_url', type: 'string', required: false, desc: 'رابط الصورة المباشر (أو image_url / base64 / file)' },
      { name: 'caption', type: 'string', required: false, desc: 'وصف أو نص مرفق مع الصورة' },
    ],
    sampleBody: {
      to: '966501234567',
      media_url: 'https://example.com/invoice-preview.png',
      caption: 'معاينة الفاتورة الإلكترونية',
    },
  },
  {
    id: 'document',
    method: 'POST',
    path: '/api/v1/send/document',
    title: 'إرسال ملف أو PDF',
    desc: 'إرسال مستندات PDF أو فواتير أو تقارير عبر رابط مباشر (media_url / file_url) أو رفع ملف.',
    fields: [
      { name: 'to', type: 'string', required: true, desc: 'رقم المستلم مع رمز الدولة' },
      { name: 'media_url', type: 'string', required: false, desc: 'رابط الملف المباشر (أو file_url / base64 / file)' },
      { name: 'filename', type: 'string', required: false, desc: 'اسم الملف الظاهر للمستلم (مثال: invoice.pdf)' },
      { name: 'caption', type: 'string', required: false, desc: 'رسالة مرفقة مع الملف' },
    ],
    sampleBody: {
      to: '966501234567',
      media_url: 'https://example.com/invoice-1042.pdf',
      filename: 'invoice-1042.pdf',
      caption: 'فاتورة الطلب #1042',
    },
  },
  {
    id: 'audio',
    method: 'POST',
    path: '/api/v1/send/audio',
    title: 'إرسال بصمة صوتية (PTT)',
    desc: 'تحويل تلقائي لأي ملف صوتي (MP3/WAV) عبر FFmpeg إلى صيغة OGG/Opus وإرساله كبصمة صوتية أصلية مع محاكاة التسجيل.',
    fields: [
      { name: 'to', type: 'string', required: true, desc: 'رقم المستلم مع رمز الدولة' },
      { name: 'media_url', type: 'string', required: false, desc: 'رابط الملف الصوتي (أو audio_url / base64 / file)' },
    ],
    sampleBody: {
      to: '966501234567',
      media_url: 'https://example.com/voice-reply.mp3',
    },
  },
];

export default function DocsPage() {
  const { selectedProject, showToast } = useApp();
  const [activeEndpoint, setActiveEndpoint] = useState('text');
  const [codeLang, setCodeLang] = useState('curl');

  const origin = window.location.origin;
  const apiKey = selectedProject?.api_key || 'wapi_live_your_project_api_key';
  const webhookSecret = selectedProject?.webhook_secret || 'whsec_your_webhook_secret';
  const currentEp = ENDPOINTS.find((e) => e.id === activeEndpoint) || ENDPOINTS[0];

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`تم نسخ ${label}`);
  };

  const buildCodeExample = () => {
    const url = `${origin}${currentEp.path}`;
    const bodyJson = JSON.stringify(currentEp.sampleBody, null, 2);

    if (codeLang === 'curl') {
      return `curl -X POST "${url}" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Idempotency-Key: req-${currentEp.id}-001" \\
  -H "Content-Type: application/json" \\
  -d '${bodyJson}'`;
    }

    if (codeLang === 'node') {
      return `const response = await fetch("${url}", {
  method: "POST",
  headers: {
    "X-API-Key": "${apiKey}",
    "Idempotency-Key": "req-${currentEp.id}-001",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${bodyJson}),
});

const result = await response.json();
console.log(result);`;
    }

    if (codeLang === 'python') {
      return `import requests

response = requests.post(
    "${url}",
    headers={
        "X-API-Key": "${apiKey}",
        "Idempotency-Key": "req-${currentEp.id}-001",
    },
    json=${bodyJson}
)

print(response.status_code, response.json())`;
    }

    return `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "X-API-Key: ${apiKey}",
        "Idempotency-Key: req-${currentEp.id}-001",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode(${bodyJson}),
]);
$result = curl_exec($ch);`;
  };

  const webhookVerifySnippet = `const crypto = require("crypto");

// Verify X-Webhook-Signature header on incoming POST request
function verifyWaslaWebhook(rawBody, signatureHeader, secret) {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader || "")
  );
}`;

  const webhookSamplePayload = JSON.stringify(
    {
      event: 'message.received',
      project_id: selectedProject?.id || 1,
      project_name: selectedProject?.name || 'متجر سلة',
      timestamp: '2026-11-13T05:30:00Z',
      data: {
        message_id: '3EB0A9F2C1B8',
        from: '966501234567',
        push_name: 'أحمد',
        type: 'text',
        message: 'مرحباً، متى يصل طلبي؟',
        is_group: false,
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[#838398] text-[11px] mb-1">
            مساحة العمل / توثيق API والربط
          </p>
          <h1 className="text-[#22213d] text-[27px] font-semibold">
            دليل الربط البرمجي و API
          </h1>
          <p className="text-[#838398] text-[13px] mt-1">
            كل ما تحتاجه لربط مشاريعك الخارجية مع بوابة almoq3 WhatsApp API لإرسال الرسائل واستقبال الـ Webhooks.
          </p>
        </div>
        <div className="bg-[#e8f6fd] text-[#00a3e0] font-inter font-semibold text-[12px] px-4 py-2.5 rounded-[11px]" dir="ltr">
          Base URL: {origin}/api/v1
        </div>
      </div>

      {/* Credentials Summary Banner */}
      <div className="bg-white rounded-[18px] p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#f8f7fd] rounded-[12px] p-4 flex flex-col justify-between">
          <span className="text-[#838398] text-[11px]">المشروع المحدد للأمثلة</span>
          <span className="text-[#24233d] font-semibold text-[14px] mt-1">
            {selectedProject?.name || 'لم يتم اختيار مشروع'}
          </span>
        </div>

        <div className="bg-[#f8f7fd] rounded-[12px] p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[#838398] text-[11px] block">ترويسة المصادقة (X-API-Key)</span>
            <span className="font-inter text-[#24233d] text-[12px] font-semibold truncate block mt-1" dir="ltr">
              {apiKey}
            </span>
          </div>
          <button
            type="button"
            onClick={() => copyText(apiKey, 'X-API-Key')}
            className="text-[#00a3e0] font-semibold text-[11px] shrink-0 hover:underline"
          >
            ⧉ نسخ
          </button>
        </div>

        <div className="bg-[#f8f7fd] rounded-[12px] p-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[#838398] text-[11px] block">مفتاح توقيع Webhook</span>
            <span className="font-inter text-[#24233d] text-[12px] font-semibold truncate block mt-1" dir="ltr">
              {webhookSecret}
            </span>
          </div>
          <button
            type="button"
            onClick={() => copyText(webhookSecret, 'Webhook Secret')}
            className="text-[#00a3e0] font-semibold text-[11px] shrink-0 hover:underline"
          >
            ⧉ نسخ
          </button>
        </div>
      </div>

      {/* Outbound API Endpoints Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right: Endpoint Selector & Field Specs */}
        <div className="lg:col-span-6 bg-white rounded-[18px] p-6 space-y-5">
          <div>
            <h2 className="text-[#24233d] font-semibold text-[17px]">
              1. مسارات إرسال الرسائل (Outbound API)
            </h2>
            <p className="text-[#838398] text-[11px] mt-1">
              تُرسل هذه الطلبات من خادم مشروعك الخارجي مع ترويسة X-API-Key.
            </p>
          </div>

          {/* Endpoint Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => setActiveEndpoint(ep.id)}
                className={`h-[40px] rounded-[10px] text-[11px] transition-all ${
                  activeEndpoint === ep.id
                    ? 'bg-[#00a3e0] text-white font-semibold'
                    : 'bg-[#f8f7fd] text-[#838398] hover:bg-[#e8f6fd]'
                }`}
              >
                {ep.title}
              </button>
            ))}
          </div>

          {/* Selected Endpoint Details */}
          <div className="bg-[#f8f7fd] rounded-[14px] p-4 space-y-2">
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <span className="bg-[#00a3e0] text-white font-inter font-semibold text-[10px] px-2.5 py-1 rounded-md">
                  {currentEp.method}
                </span>
                <span className="font-inter font-semibold text-[#24233d] text-[13px]">
                  {currentEp.path}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(`${origin}${currentEp.path}`, 'رابط الـ Endpoint')}
                className="text-[#00a3e0] text-[11px] font-semibold hover:underline"
              >
                نسخ الرابط
              </button>
            </div>
            <p className="text-[#6f6b8a] text-[12px] pt-1">{currentEp.desc}</p>
          </div>

          {/* Fields Table */}
          <div>
            <h3 className="text-[#24233d] font-semibold text-[13px] mb-3">
              الحقول المطلوبة والاختيارية (Body Fields)
            </h3>
            <div className="space-y-2">
              {currentEp.fields.map((f) => (
                <div
                  key={f.name}
                  className="bg-[#f8f7fd] rounded-[10px] px-4 py-3 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2" dir="ltr">
                      <code className="font-inter font-semibold text-[#00a3e0] text-[12px]">
                        {f.name}
                      </code>
                      <span className="text-[#838398] font-inter text-[10px]">{f.type}</span>
                      {f.required && (
                        <span className="bg-[#fceef1] text-[#c25e76] text-[9px] font-semibold px-2 py-0.5 rounded">
                          مطلوب
                        </span>
                      )}
                    </div>
                    <p className="text-[#55516f] text-[11px] mt-1">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#f5f2fe] rounded-[12px] p-4">
            <p className="text-[#00a3e0] font-semibold text-[12px]">
              ترويسة منع التكرار (Idempotency-Key)
            </p>
            <p className="text-[#838398] text-[11px] mt-1">
              اختيارية: مرّر معرفاً فريداً مثل رقم الطلب، وسيتم حفظ الاستجابة في Redis لمدة 24 ساعة لمنع الإرسال المزدوج.
            </p>
          </div>
        </div>

        {/* Left: Live Multi-Language Code Example */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#24213b] rounded-[18px] p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className="font-semibold text-[15px]">مثال تطبيقي جاهز للنسخ</span>
              <div className="flex items-center gap-1.5 bg-[#35314e] p-1 rounded-[9px]" dir="ltr">
                {[
                  { id: 'curl', label: 'cURL' },
                  { id: 'node', label: 'Node.js' },
                  { id: 'python', label: 'Python' },
                  { id: 'php', label: 'PHP' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setCodeLang(lang.id)}
                    className={`px-2.5 py-1 rounded-[6px] font-inter text-[10px] transition-colors ${
                      codeLang === lang.id
                        ? 'bg-[#00a3e0] text-white font-semibold'
                        : 'text-[#bbb3d7] hover:text-white'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <pre
              className="font-inter text-[#dad3f0] text-[11px] leading-[1.65] overflow-x-auto text-left whitespace-pre-wrap bg-[#1c1930] rounded-[12px] p-4"
              dir="ltr"
            >
              {buildCodeExample()}
            </pre>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => copyText(buildCodeExample(), 'الكود البرمجي')}
                className="text-[#b8abff] text-[11px] hover:underline"
              >
                ⧉  نسخ الكود
              </button>
            </div>
          </div>

          {/* Expected Response */}
          <div className="bg-white rounded-[18px] p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#24233d] font-semibold text-[15px]">الاستجابة القياسية (202 Accepted)</h3>
              <span className="bg-[#eaf7f1] text-[#208b72] font-inter font-semibold text-[10px] px-3 py-1 rounded-[8px]" dir="ltr">
                202 Accepted
              </span>
            </div>
            <pre
              className="bg-[#f8f7fd] rounded-[11px] p-4 font-inter text-[#615777] text-[11px] text-left overflow-x-auto"
              dir="ltr"
            >{`{
  "status": "queued",
  "message": "Text message queued for delivery",
  "data": {
    "id": 14,
    "project_id": ${selectedProject?.id || 1},
    "direction": "outbound",
    "remote_jid": "966501234567",
    "status": "queued"
  }
}`}</pre>
          </div>
        </div>
      </div>

      {/* Pull API Section (For Mobile, Plain Web, Shared Hosting) */}
      <div className="bg-white rounded-[18px] p-6 space-y-4">
        <div>
          <h2 className="text-[#24233d] font-semibold text-[17px]">
            2. سحب الرسائل وحالة الاتصال بدون Webhook (Pull API)
          </h2>
          <p className="text-[#838398] text-[12px] mt-1">
            مخصص لتطبيقات الموبايل (Flutter / React Native) أو مواقع الويب أو مشاريع Laravel على استضافة مشتركة لا تدعم استقبال Webhooks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#f8f7fd] rounded-[14px] p-4 space-y-2">
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <span className="bg-[#208b72] text-white font-inter font-semibold text-[10px] px-2.5 py-1 rounded-md">
                  GET
                </span>
                <span className="font-inter font-semibold text-[#24233d] text-[13px]">
                  /api/v1/messages
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(`${origin}/api/v1/messages`, 'رابط جلب الرسائل')}
                className="text-[#00a3e0] text-[11px] font-semibold hover:underline"
              >
                نسخ الرابط
              </button>
            </div>
            <p className="text-[#55516f] text-[11px]">
              جلب الرسائل الصادرة والواردة مع دعم الفلترة بـ{' '}
              <code className="font-inter text-[#00a3e0]" dir="ltr">?direction=inbound&since_id=0&limit=50</code>
            </p>
          </div>

          <div className="bg-[#f8f7fd] rounded-[14px] p-4 space-y-2">
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <span className="bg-[#208b72] text-white font-inter font-semibold text-[10px] px-2.5 py-1 rounded-md">
                  GET
                </span>
                <span className="font-inter font-semibold text-[#24233d] text-[13px]">
                  /api/v1/status
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(`${origin}/api/v1/status`, 'رابط فحص الحالة')}
                className="text-[#00a3e0] text-[11px] font-semibold hover:underline"
              >
                نسخ الرابط
              </button>
            </div>
            <p className="text-[#55516f] text-[11px]">
              فحص حالة اتصال رقم الواتساب الخاص بالمشروع باستخدام ترويسة{' '}
              <code className="font-inter text-[#00a3e0]" dir="ltr">X-API-Key</code> فقط.
            </p>
          </div>
          <div className="bg-[#f8f7fd] rounded-[14px] p-4 space-y-2">
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <span className="bg-[#208b72] text-white font-inter font-semibold text-[10px] px-2.5 py-1 rounded-md">
                  GET
                </span>
                <span className="font-inter font-semibold text-[#24233d] text-[13px]">
                  /api/v1/qr
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(`${origin}/api/v1/qr`, 'رابط جلب الباركود')}
                className="text-[#00a3e0] text-[11px] font-semibold hover:underline"
              >
                نسخ الرابط
              </button>
            </div>
            <p className="text-[#55516f] text-[11px]">
              بدء الجلسة وجلب صورة الباركود (<code className="font-inter text-[#00a3e0]" dir="ltr">qr_base64</code>) ليعرضه مشروعك لمستخدميه ويتجدد تلقائياً عند كل طلب حتى يتم المسح.
            </p>
          </div>

          <div className="bg-[#f8f7fd] rounded-[14px] p-4 space-y-2">
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <span className="bg-[#208b72] text-white font-inter font-semibold text-[10px] px-2.5 py-1 rounded-md">
                  GET
                </span>
                <span className="font-inter font-semibold text-[#24233d] text-[13px]">
                  /api/v1/contacts
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(`${origin}/api/v1/contacts`, 'رابط جهات الاتصال')}
                className="text-[#00a3e0] text-[11px] font-semibold hover:underline"
              >
                نسخ الرابط
              </button>
            </div>
            <p className="text-[#55516f] text-[11px]">
              جلب قائمة جهات اتصال واتساب المتزامنة مع الرقم الفعلي مع الأسماء والأرقام بدون تكرار.
            </p>
          </div>

          <div className="bg-[#f8f7fd] rounded-[14px] p-4 space-y-2">
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <span className="bg-[#00a3e0] text-white font-inter font-semibold text-[10px] px-2.5 py-1 rounded-md">
                  POST
                </span>
                <span className="font-inter font-semibold text-[#24233d] text-[13px]">
                  /api/v1/logout
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText(`${origin}/api/v1/logout`, 'رابط فصل الرقم')}
                className="text-[#00a3e0] text-[11px] font-semibold hover:underline"
              >
                نسخ الرابط
              </button>
            </div>
            <p className="text-[#55516f] text-[11px]">
              تسجيل الخروج وفصل رقم الواتساب المرتبط بالمشروع عبر <code className="font-inter text-[#00a3e0]" dir="ltr">X-API-Key</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Inbound Webhook Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-[18px] p-6 space-y-4">
          <h2 className="text-[#24233d] font-semibold text-[17px]">
            3. استقبال الرسائل الفوري (Inbound Webhook)
          </h2>
          <p className="text-[#838398] text-[12px] leading-[1.7]">
            عندما يرسل عميل رسالة إلى رقم الواتساب المرتبط بمشروعك، ترسل البوابة طلب{' '}
            <code className="font-inter text-[#00a3e0]" dir="ltr">POST</code> تلقائياً إلى{' '}
            <code className="font-inter text-[#00a3e0]" dir="ltr">Webhook URL</code> المحدد في صفحة الحماية و Webhook.
          </p>

          <div className="space-y-2 text-[12px]">
            <div className="bg-[#f8f7fd] rounded-[10px] p-3.5 flex items-center justify-between">
              <span className="text-[#24233d] font-semibold">ترويسة التوقيع الأمني</span>
              <code className="font-inter text-[#00a3e0] text-[11px]" dir="ltr">
                X-Webhook-Signature: sha256=...
              </code>
            </div>
            <div className="bg-[#f8f7fd] rounded-[10px] p-3.5 flex items-center justify-between">
              <span className="text-[#24233d] font-semibold">سياسة إعادة المحاولة</span>
              <span className="font-inter text-[#208b72] text-[11px]" dir="ltr">
                0s → 5s → 30s → 2m → 5m
              </span>
            </div>
          </div>

          <div>
            <p className="text-[#24233d] font-semibold text-[12px] mb-2">
              نموذج البيانات الواصلة لخادمك (Webhook JSON Payload)
            </p>
            <pre
              className="bg-[#f8f7fd] rounded-[12px] p-4 font-inter text-[#55516f] text-[11px] text-left overflow-x-auto"
              dir="ltr"
            >
              {webhookSamplePayload}
            </pre>
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#24213b] rounded-[18px] p-6 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-[15px]">
                التحقق من توقيع Webhook (HMAC-SHA256)
              </span>
              <span className="font-inter text-[#b8abff] text-[11px]" dir="ltr">
                Node.js
              </span>
            </div>
            <p className="text-[#bbb3d7] text-[12px] mb-4">
              تحقق من صحة الطلب في مشروعك الخارجي باستخدام{' '}
              <code className="font-inter text-[#b8abff]" dir="ltr">Webhook Secret</code>{' '}
              لضمان أن الطلب صادر فعلاً من بوابة almoq3 WhatsApp API.
            </p>
            <pre
              className="font-inter text-[#dad3f0] text-[11px] leading-[1.65] overflow-x-auto text-left whitespace-pre-wrap bg-[#1c1930] rounded-[12px] p-4"
              dir="ltr"
            >
              {webhookVerifySnippet}
            </pre>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => copyText(webhookVerifySnippet, 'كود التحقق من Webhook')}
              className="text-[#b8abff] text-[11px] hover:underline"
            >
              ⧉  نسخ كود التحقق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

