import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { sendGatewayMessage } from '../services/api';

export default function PlaygroundPage() {
  const { selectedProject, showToast } = useApp();
  const [playType, setPlayType] = useState('text');
  const [playForm, setPlayForm] = useState({
    to: '+966501234567',
    idempotencyKey: `order-${Math.floor(1000 + Math.random() * 9000)}-confirmation`,
    text: 'تم تأكيد طلبك #1042 بنجاح.',
    caption: 'تقرير الأداء الشهري جاهز للمراجعة.',
    mediaUrl: 'https://cdn.wasla.dev/reports/monthly.pdf',
    filename: 'monthly-report.pdf',
  });
  const [playFile, setPlayFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);

  const handleSend = async () => {
    if (!selectedProject) {
      showToast('يرجى اختيار مشروع أولاً');
      return;
    }
    setSending(true);
    const startTime = performance.now();
    try {
      const res = await sendGatewayMessage({
        apiKey: selectedProject.api_key,
        type: playType,
        to: playForm.to,
        idempotencyKey: playForm.idempotencyKey,
        text: playForm.text,
        mediaUrl: playForm.mediaUrl,
        caption: playForm.caption,
        filename: playForm.filename,
        file: playFile,
      });
      const elapsed = Math.round(performance.now() - startTime);
      const rawText = await res.text();
      let parsed = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { raw: rawText };
      }
      setResponse({
        status: `${res.status} ${res.ok ? 'Accepted' : 'Error'}`,
        ok: res.ok,
        durationMs: elapsed,
        sizeB: new Blob([rawText]).size,
        data: parsed,
      });
      showToast(
        res.ok
          ? 'تمت إضافة الرسالة لطابور الإرسال الآمن'
          : parsed.error || 'تعذر إرسال الرسالة'
      );
    } catch (err) {
      setResponse({
        status: '500 Error',
        ok: false,
        durationMs: 0,
        sizeB: 0,
        data: { error: err.message },
      });
    } finally {
      setSending(false);
    }
  };

  const getCurlSnippet = () => {
    const apiKeyDisplay = selectedProject?.api_key || '$WASLA_API_KEY';
    const payload =
      playType === 'text'
        ? { to: playForm.to.replace(/\+/g, ''), message: playForm.text }
        : {
            to: playForm.to.replace(/\+/g, ''),
            media_url: playForm.mediaUrl,
            caption: playForm.caption,
          };

    return `curl -X POST \\
  ${window.location.origin}/api/v1/send/${playType} \\
  -H 'X-API-Key: ${apiKeyDisplay}' \\
  -H 'Idempotency-Key: ${playForm.idempotencyKey}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#838398] text-[11px] mb-1">مساحة العمل / مختبر الإرسال</p>
        <h1 className="text-[#22213d] text-[27px] font-semibold">مختبر تجربة الإرسال</h1>
        <p className="text-[#838398] text-[13px] mt-1">
          اختبر طلبات API قبل دمجها في تطبيقك.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Card */}
        <div className="lg:col-span-6 bg-white rounded-[18px] p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-[#24233d] font-semibold text-[17px] mb-4">رسالة جديدة</h2>

            <div className="bg-[#f8f7fd] h-[48px] rounded-[11px] p-1 grid grid-cols-4 gap-1 mb-6">
              {[
                { id: 'text', label: 'نص' },
                { id: 'image', label: 'صورة' },
                { id: 'document', label: 'ملف PDF' },
                { id: 'audio', label: 'بصمة صوتية PTT' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPlayType(t.id)}
                  className={`rounded-[8px] text-[11px] transition-all ${
                    playType === t.id
                      ? 'bg-white text-[#7b68ee] font-semibold shadow-sm'
                      : 'text-[#838398]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                رقم المستلم • مع رمز الدولة
              </label>
              <input
                type="text"
                dir="ltr"
                value={playForm.to}
                onChange={(e) => setPlayForm({ ...playForm, to: e.target.value })}
                placeholder="+966501234567"
                className="w-full h-[50px] bg-[#f8f7fd] rounded-[10px] px-4 text-left font-inter text-[#67617d] text-[13px] outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                مفتاح منع التكرار  /  Idempotency-Key
              </label>
              <input
                type="text"
                dir="ltr"
                value={playForm.idempotencyKey}
                onChange={(e) =>
                  setPlayForm({ ...playForm, idempotencyKey: e.target.value })
                }
                placeholder="order-1042-confirmation"
                className="w-full h-[50px] bg-[#f8f7fd] rounded-[10px] px-4 text-left font-inter text-[#67617d] text-[13px] outline-none"
              />
            </div>

            {playType === 'text' ? (
              <>
                <div className="mb-4">
                  <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                    محتوى الرسالة
                  </label>
                  <div className="bg-[#f8f7fd] rounded-[11px] p-4">
                    <textarea
                      rows={4}
                      value={playForm.text}
                      onChange={(e) => setPlayForm({ ...playForm, text: e.target.value })}
                      className="w-full bg-transparent text-[#55516f] text-[14px] outline-none resize-none"
                      placeholder="اكتب نص الرسالة..."
                    />
                    <div
                      className="font-inter text-[#9895ad] text-[10px] text-left mt-2"
                      dir="ltr"
                    >
                      {playForm.text.length} / 4096
                    </div>
                  </div>
                </div>

                <div className="bg-[#f5f2fe] rounded-[11px] p-4 mb-5">
                  <p className="text-[#7b68ee] font-semibold text-[12px]">
                    إرسال آمن بدون تكرار
                  </p>
                  <p className="text-[#838398] text-[11px] mt-1">
                    نفس المفتاح مع نفس الطلب يعيد الاستجابة السابقة.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                    ملف الوسائط أو الرابط المباشر
                  </label>
                  <label className="block bg-[#f8f7fd] border border-dashed border-[#d8d4f2] rounded-[12px] p-4 text-center cursor-pointer hover:bg-[#f2effd] transition-colors mb-3">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setPlayFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-[#7b68ee] font-semibold text-[12px]">
                      {playFile
                        ? `تم اختيار: ${playFile.name}`
                        : 'اسحب الملف إلى هنا أو اختر من جهازك'}
                    </p>
                    <p className="text-[#838398] text-[10px] mt-1">
                      PNG, JPG, PDF, MP3, WAV, OGG — يُحوّل الصوت تلقائياً إلى بصمة صوتية
                      PTT
                    </p>
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={playForm.mediaUrl}
                    onChange={(e) => setPlayForm({ ...playForm, mediaUrl: e.target.value })}
                    placeholder="https://cdn.wasla.dev/reports/monthly.pdf"
                    className="w-full h-[46px] bg-[#f8f7fd] rounded-[10px] px-4 text-left font-inter text-[#67617d] text-[12px] outline-none"
                  />
                </div>

                <div className="mb-5">
                  <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                    الرسالة أو الوصف المرفق
                  </label>
                  <textarea
                    rows={2}
                    value={playForm.caption}
                    onChange={(e) => setPlayForm({ ...playForm, caption: e.target.value })}
                    className="w-full bg-[#f8f7fd] rounded-[11px] p-3.5 text-[#55516f] text-[13px] outline-none resize-none"
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <button
              type="button"
              disabled={sending}
              onClick={handleSend}
              className="w-full h-[50px] bg-[#7b68ee] hover:bg-[#6b58dc] text-white font-semibold text-[14px] rounded-[12px] px-5 text-right transition-colors"
            >
              {sending ? 'جاري الإرسال...' : 'إرسال الطلب  ←'}
            </button>
            <p className="text-[#838398] text-[10px] mt-3">
              {selectedProject?.status === 'connected'
                ? 'المشروع متصل • هذه الرسالة ستُرسل إلى الرقم المحدد.'
                : 'تنبيه: المشروع غير متصل حالياً، يرجى ربط الرقم من صفحة ربط واتساب.'}
            </p>
          </div>
        </div>

        {/* Code Preview & Response Column */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#24213b] rounded-[18px] p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-[15px]">الطلب  /  Request</span>
              <span className="font-inter font-semibold text-[#bbb3d7] text-[11px]">
                cURL  ⌄
              </span>
            </div>

            <div
              className="bg-[#35314e] h-[39px] rounded-[9px] px-3.5 flex items-center gap-3 font-inter text-[11px] mb-4"
              dir="ltr"
            >
              <span className="text-[#b8abff] font-semibold">POST</span>
              <span className="text-[#e4dff4]">/api/v1/send/{playType}</span>
            </div>

            <p className="font-inter text-[#a89cc9] text-[9px] text-left mb-2" dir="ltr">
              Request source
            </p>

            <pre
              className="font-inter text-[#dad3f0] text-[11px] leading-[1.6] overflow-x-auto text-left whitespace-pre-wrap"
              dir="ltr"
            >
              {getCurlSnippet()}
            </pre>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getCurlSnippet());
                  showToast('تم نسخ كود cURL');
                }}
                className="text-[#b8abff] text-[11px] hover:underline"
              >
                ⧉  نسخ الطلب
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[18px] p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#24233d] font-semibold text-[16px]">استجابة الخادم</h3>
              {response && (
                <span
                  className={`font-inter font-semibold text-[10px] px-3 py-1.5 rounded-[8px] ${
                    response.ok
                      ? 'bg-[#eaf7f1] text-[#208b72]'
                      : 'bg-[#fceef1] text-[#c25e76]'
                  }`}
                  dir="ltr"
                >
                  {response.status}
                </span>
              )}
            </div>

            {response ? (
              <>
                <p className="font-inter text-[#9895ad] text-[10px] text-left mb-3" dir="ltr">
                  {response.durationMs} ms  •  {response.sizeB} B
                </p>

                <div
                  className="bg-[#f8f7fd] rounded-[11px] p-4 font-inter text-[#615777] text-[12px] text-left overflow-x-auto"
                  dir="ltr"
                >
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>

                <p
                  className={`text-[11px] mt-4 ${
                    response.ok ? 'text-[#208b72]' : 'text-[#c25e76]'
                  }`}
                >
                  {response.ok
                    ? '✓  تمت الإضافة للطابور • تابع التسليم من سجل الرسائل.'
                    : '✕  حدث خطأ أثناء معالجة الطلب.'}
                </p>
              </>
            ) : (
              <div className="bg-[#f8f7fd] rounded-[11px] p-6 text-center text-[#838398] text-[12px]">
                أرسل طلباً من النموذج لعرض استجابة الخادم الحقيقية هنا.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

