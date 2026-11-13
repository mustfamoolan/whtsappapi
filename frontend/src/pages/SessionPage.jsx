import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getProjectStatusBadge } from '../utils/status';

export default function SessionPage() {
  const { selectedProject, setProjects, apiFetch, showToast, fetchProjects } = useApp();
  const [sessionData, setSessionData] = useState({
    status: selectedProject?.status || 'disconnected',
    phone_number: selectedProject?.phone_number || '',
    jid: selectedProject?.jid || '',
    qr_code: '',
  });
  const [qrLoading, setQrLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const fetchSession = useCallback(
    async (forceQr = false) => {
      if (!selectedProject?.id) return;
      try {
        if (forceQr) setQrLoading(true);
        const endpoint = forceQr
          ? `/projects/${selectedProject.id}/qr`
          : `/projects/${selectedProject.id}/status`;
        const res = await apiFetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          const rawQr = data.qr_base64 || data.qr_code || '';
          const formattedQr =
            rawQr && !rawQr.startsWith('data:image')
              ? `data:image/png;base64,${rawQr}`
              : rawQr;
          setSessionData((prev) => ({
            status: data.status || prev.status,
            phone_number: data.phone_number ?? prev.phone_number,
            jid: data.jid ?? prev.jid,
            qr_code: data.status === 'connected' ? '' : formattedQr || prev.qr_code,
          }));
          setProjects((prev) =>
            prev.map((p) =>
              p.id === selectedProject.id
                ? {
                    ...p,
                    status: data.status || p.status,
                    phone_number: data.phone_number || p.phone_number,
                  }
                : p
            )
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (forceQr) setQrLoading(false);
      }
    },
    [selectedProject?.id, apiFetch, setProjects]
  );

  useEffect(() => {
    if (!selectedProject?.id) return;
    fetchSession(true);
    const timer = setInterval(() => fetchSession(false), 5000);
    return () => clearInterval(timer);
  }, [selectedProject?.id, fetchSession]);

  const handleRegenerateKey = async () => {
    if (!selectedProject) return;
    const res = await apiFetch(`/projects/${selectedProject.id}/regenerate-key`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      const updated = data.data || data;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject.id
            ? {
                ...p,
                api_key: updated.api_key || p.api_key,
                webhook_secret: updated.webhook_secret || p.webhook_secret,
              }
            : p
        )
      );
      showToast('تم تدوير مفاتيح الأمان بنجاح');
    }
  };

  const handleDisconnect = async () => {
    if (!selectedProject) return;
    const res = await apiFetch(`/projects/${selectedProject.id}/logout`, {
      method: 'POST',
    });
    if (res.ok) {
      setSessionData({ status: 'disconnected', phone_number: '', jid: '', qr_code: '' });
      fetchProjects();
      showToast('تم فصل رقم واتساب من المشروع');
    }
  };

  const badge = getProjectStatusBadge(sessionData.status);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#838398] text-[11px] mb-1">
          المشاريع / {selectedProject?.name || 'متجر سلة'} / ربط واتساب والمفاتيح
        </p>
        <h1 className="text-[#22213d] text-[27px] font-semibold">
          ربط الرقم ومفاتيح الوصول
        </h1>
        <p className="text-[#838398] text-[13px] mt-1">
          امسح الباركود لربط رقم واتساب الخاص بهذا المشروع، وانسخ مفاتيح الـ API.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp QR Card */}
        <div className="bg-white rounded-[18px] p-6 flex flex-col justify-between min-h-[458px]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#24233d] font-semibold text-[17px]">اتصال واتساب</h2>
              <p className="text-[#838398] text-[11px] mt-1">
                كل مشروع يعمل بجلسة مستقلة ورقم خاص به.
              </p>
            </div>
            <span
              className={`${badge.bg} ${badge.text} font-semibold text-[10px] px-3.5 py-1.5 rounded-[8px]`}
            >
              {badge.shortLabel}
            </span>
          </div>

          <div className="bg-[#f9f8fe] w-[224px] h-[224px] rounded-[18px] mx-auto my-5 flex items-center justify-center p-4">
            {sessionData.status === 'connected' ? (
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-[#eaf7f1] text-[#208b72] flex items-center justify-center mx-auto text-2xl font-bold">
                  ✓
                </div>
                <p className="text-[#24233d] font-semibold text-[14px]">
                  الرقم متصل بنجاح
                </p>
                <p className="font-inter text-[#208b72] text-[13px] font-semibold" dir="ltr">
                  {sessionData.phone_number || selectedProject?.phone_number}
                </p>
              </div>
            ) : sessionData.qr_code ? (
              <img
                src={sessionData.qr_code}
                alt="WhatsApp QR Code"
                className="w-[184px] h-[184px] object-contain rounded-lg"
              />
            ) : (
              <img
                src="/figma/qr-placeholder.svg"
                alt="QR Placeholder"
                className="w-[176px] h-[176px] object-contain opacity-90"
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#838398]">
                {qrLoading
                  ? 'جاري توليد الباركود...'
                  : 'يتجدد الباركود تلقائياً كل 20 ثانية'}
              </span>
              <button
                type="button"
                onClick={() => fetchSession(true)}
                className="text-[#208b72] font-semibold hover:underline"
              >
                ● تحديث الباركود الآن
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#f0f8fd]">
              <span className="text-[#838398] text-[12px]">
                الرقم المستهدف:{' '}
                <strong className="font-inter text-[#24233d]" dir="ltr">
                  {sessionData.phone_number ||
                    selectedProject?.phone_number ||
                    'غير مربوط بعد'}
                </strong>
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="bg-[#f8f7fd] hover:bg-[#fceef1] text-[#838398] hover:text-[#c25e76] h-[40px] px-5 rounded-[10px] text-[11px] transition-colors"
              >
                فصل الرقم
              </button>
            </div>
          </div>
        </div>

        {/* Security Keys Card */}
        <div className="bg-white rounded-[18px] p-6 flex flex-col justify-between min-h-[458px]">
          <div>
            <h2 className="text-[#24233d] font-semibold text-[17px]">مفاتيح الأمان</h2>
            <p className="text-[#838398] text-[11px] mt-1">
              استخدم هذه المفاتيح لمصادقة طلبات مشروعك والتحقق من Webhooks.
            </p>

            <div className="mt-6">
              <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                مفتاح المشروع / X-API-Key
              </label>
              <div className="bg-[#f8f7fd] h-[52px] rounded-[11px] px-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedProject?.api_key || '');
                    showToast('تم نسخ X-API-Key');
                  }}
                  className="text-[#00a3e0] font-semibold text-[11px] shrink-0 hover:underline"
                >
                  ⧉  نسخ
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-[#838398] text-[11px] shrink-0 hover:text-[#24233d]"
                >
                  {showApiKey ? 'إخفاء' : 'إظهار'}
                </button>
                <span
                  className="font-inter text-[#5d5975] text-[13px] truncate text-left flex-1"
                  dir="ltr"
                >
                  {showApiKey
                    ? selectedProject?.api_key
                    : `wsl_live_${(selectedProject?.api_key || '').slice(0, 6)}••••••••••••••••`}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                سر التوقيع / Webhook Secret (HMAC-SHA256)
              </label>
              <div className="bg-[#f8f7fd] h-[52px] rounded-[11px] px-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedProject?.webhook_secret || '');
                    showToast('تم نسخ Webhook Secret');
                  }}
                  className="text-[#00a3e0] font-semibold text-[11px] shrink-0 hover:underline"
                >
                  ⧉  نسخ
                </button>
                <button
                  type="button"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  className="text-[#838398] text-[11px] shrink-0 hover:text-[#24233d]"
                >
                  {showWebhookSecret ? 'إخفاء' : 'إظهار'}
                </button>
                <span
                  className="font-inter text-[#5d5975] text-[13px] truncate text-left flex-1"
                  dir="ltr"
                >
                  {showWebhookSecret
                    ? selectedProject?.webhook_secret
                    : `whsec_${(selectedProject?.webhook_secret || '').slice(0, 6)}••••••••••••••••`}
                </span>
              </div>
            </div>

            <div className="mt-5 bg-[#f5f2fe] rounded-[12px] p-4">
              <p className="text-[#00a3e0] font-semibold text-[12px]">
                تدوير المفاتيح بأمان
              </p>
              <p className="text-[#838398] text-[11px] mt-1">
                عند توليد مفتاح جديد، يتوقف المفتاح السابق فوراً لحماية مشروعك.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleRegenerateKey}
              className="bg-[#e8f6fd] hover:bg-[#e3defa] text-[#00a3e0] font-semibold text-[12px] h-[44px] px-6 rounded-[11px] transition-colors"
            >
              ↻  تدوير المفاتيح
            </button>
          </div>
        </div>
      </div>

      {/* External Project API Endpoints Card */}
      <div className="bg-white rounded-[18px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-[#24233d] font-semibold text-[16px]">
              نقاط الاتصال للمشروع الخارجي (API Endpoints)
            </h3>
            <p className="text-[#838398] text-[11px] mt-1">
              أعطِ هذا الرابط والمفاتيح لمشروعك الآخر ليقوم بالإرسال والاستقبال عبر رقم واتساب هذا المشروع.
            </p>
          </div>
          <span className="bg-[#e8f6fd] text-[#00a3e0] font-inter font-semibold text-[11px] px-3 py-1.5 rounded-[8px]" dir="ltr">
            Header: X-API-Key
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { method: 'POST', path: '/api/v1/send/text', desc: 'إرسال رسالة نصية (to, message)' },
            { method: 'POST', path: '/api/v1/send/image', desc: 'إرسال صورة (to, media_url / file)' },
            { method: 'POST', path: '/api/v1/send/document', desc: 'إرسال PDF/مستند (to, media_url / file)' },
            { method: 'POST', path: '/api/v1/send/audio', desc: 'إرسال بصمة صوتية PTT (to, media_url / file)' },
          ].map((ep) => (
            <div
              key={ep.path}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${ep.path}`);
                showToast(`تم نسخ ${ep.path}`);
              }}
              className="bg-[#f8f7fd] hover:bg-[#e8f6fd] cursor-pointer transition-colors rounded-[12px] p-3.5 text-right"
            >
              <div className="flex items-center justify-between mb-1.5" dir="ltr">
                <span className="font-inter font-semibold text-[10px] bg-[#00a3e0] text-white px-2 py-0.5 rounded-md">
                  {ep.method}
                </span>
                <span className="font-inter text-[#24233d] text-[11px] font-semibold">
                  {ep.path}
                </span>
              </div>
              <p className="text-[#838398] text-[10px]">{ep.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3-Step Guide */}
      <div className="bg-white rounded-[18px] p-6">
        <h3 className="text-[#24233d] font-semibold text-[16px] mb-5">
          اربط رقمك في ثلاث خطوات
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              num: '01',
              title: 'افتح واتساب على هاتفك',
              desc: 'اذهب إلى الإعدادات ثم الأجهزة المرتبطة.',
            },
            {
              num: '02',
              title: 'امسح رمز الاستجابة QR',
              desc: 'وجّه الكاميرا نحو الرمز الظاهر في هذه الصفحة.',
            },
            {
              num: '03',
              title: 'ابدأ الإرسال عبر API',
              desc: 'استخدم مفتاح X-API-Key في تطبيقك أو مختبر الإرسال.',
            },
          ].map((step) => (
            <div key={step.num} className="flex items-start gap-3.5">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-[#e8f6fd] text-[#00a3e0] font-inter font-semibold text-[13px] flex items-center justify-center shrink-0">
                {step.num}
              </div>
              <div>
                <p className="text-[#24233d] font-semibold text-[14px]">{step.title}</p>
                <p className="text-[#838398] text-[11px] mt-1">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

