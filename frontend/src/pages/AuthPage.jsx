import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function AuthPage() {
  const navigate = useNavigate();
  const { saveSession, toast } = useApp();
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!authForm.email || !authForm.password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authForm.email.trim(),
          password: authForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'بيانات الدخول غير صحيحة');
      } else {
        saveSession(data.token, data.user);
        navigate('/');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#f3f6f9] flex items-center justify-center p-4 lg:p-8"
      dir="rtl"
    >
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#0e2032] text-white px-5 py-3 rounded-[12px] shadow-lg text-[12px] font-semibold">
          {toast}
        </div>
      )}

      <div className="w-full max-w-[1380px] bg-white rounded-[28px] shadow-[0_12px_45px_rgba(14,32,50,0.06)] grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden items-stretch">
        {/* Form Column */}
        <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-12 md:p-14 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="almoq3"
                className="w-[48px] h-[48px] object-contain"
              />
              <div>
                <span className="text-[#0e2032] text-[26px] font-bold block leading-none">
                  almoq3
                </span>
                <span className="text-[#00a3e0] text-[11px] font-semibold tracking-wider font-inter">
                  WHATSAPP API GATEWAY
                </span>
              </div>
            </div>
            <span className="text-[#72849a] text-[11px] bg-[#f0f6fa] px-3 py-1.5 rounded-full font-medium">
              بوابة خاصة للمشاريع
            </span>
          </div>

          <div className="my-10 max-w-[460px] w-full mx-auto">
            <h1 className="text-[#0e2032] text-[28px] sm:text-[32px] font-bold mb-2">
              تسجيل الدخول
            </h1>
            <p className="text-[#72849a] text-[13px] mb-8">
              أدخل بياناتك لإدارة أرقام واتساب، المفاتيح، والـ Webhooks الخاصة بمشاريعك.
            </p>

            {error && (
              <div className="mb-6 bg-[#fdeeed] text-[#d32f2f] px-4 py-3 rounded-[12px] text-[12px] font-semibold border border-[#fadad7]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[#0e2032] text-[12px] font-semibold mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="name@domain.com"
                  className="w-full h-[52px] bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#00a3e0] rounded-[12px] px-4 text-left font-inter text-[#0e2032] text-[14px] outline-none transition-all focus:ring-2 focus:ring-[#00a3e0]/20"
                />
              </div>

              <div>
                <label className="block text-[#0e2032] text-[12px] font-semibold mb-2">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  required
                  dir="ltr"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full h-[52px] bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#00a3e0] rounded-[12px] px-4 text-left font-inter text-[#0e2032] text-[14px] outline-none transition-all focus:ring-2 focus:ring-[#00a3e0]/20"
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[12px]">
                <label className="flex items-center gap-2 text-[#72849a] cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-[18px] h-[18px] accent-[#00a3e0] rounded-[5px]"
                  />
                  <span>تذكرني على هذا المتصفح</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[54px] bg-[#00a3e0] hover:bg-[#0090c7] active:bg-[#007ba8] transition-all rounded-[12px] text-white font-bold text-[15px] mt-2 shadow-[0_4px_16px_rgba(0,163,224,0.25)] cursor-pointer"
              >
                {loading ? 'جاري التحقق...' : 'دخول إلى لوحة التحكم  ←'}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-[#edf2f7] flex items-center justify-between text-[#8a99ad] text-[11px]">
            <span>بوابة ربط واتساب الآمنة للمشاريع</span>
            <a
              href="https://almoq3.com/"
              target="_blank"
              rel="noreferrer"
              className="text-[#00a3e0] hover:underline font-semibold"
            >
              تطوير almoq3
            </a>
          </div>
        </div>

        {/* Brand Showcase Hero (Inspired by almoq3) */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#0e2032] via-[#11283e] to-[#0a1826] p-8 sm:p-14 text-white flex flex-col justify-between relative overflow-hidden min-h-[640px]">
          {/* Subtle glow circle */}
          <div className="absolute top-0 right-0 w-[380px] h-[380px] bg-[#00a3e0]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00b8f0]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#00a3e0]/15 border border-[#00a3e0]/30 h-[36px] px-4 rounded-[10px] text-[12px] font-semibold text-[#00b8f0] mb-8">
              <span>●</span>
              <span>بوابة ربط واتساب الرسمية لمشاريع almoq3</span>
            </div>
            <h2 className="text-[34px] sm:text-[40px] font-bold leading-[1.3] mb-4 max-w-[500px]">
              تحكم كامل بأرقام ورسائل مشاريعك من واجهة واحدة.
            </h2>
            <p className="text-[#a5b9cd] text-[15px] leading-[1.7] max-w-[480px]">
              وفر لعملائك وتطبيقاتك إمكانية إرسال واستقبال رسائل واتساب، الصور، المستندات، والبصمات الصوتية عبر REST API فائق السرعة.
            </p>
          </div>

          <div className="relative z-10 bg-[#162e45]/80 border border-[#234261] backdrop-blur-sm rounded-[22px] p-6 sm:p-7 my-8">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5 space-y-3">
                {[
                  { name: 'متجر سلة / زد', phone: '9647742209251', status: 'متصل' },
                  { name: 'تطبيق التوصيل الميداني', phone: '9647801234567', status: 'متصل' },
                  { name: 'مساعد الذكاء الاصطناعي', phone: '9647509876543', status: 'متصل' },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="bg-[#0e2032] border border-[#1e3b56] rounded-[14px] p-3 flex items-center justify-between text-white"
                  >
                    <div>
                      <p className="font-semibold text-[13px]">{c.name}</p>
                      <p className="font-inter text-[#00a3e0] text-[11px]" dir="ltr">
                        +{c.phone}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold bg-[#208b72]/20 text-[#2cd9b0] px-2 py-0.5 rounded-md">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="sm:col-span-3 flex flex-col items-center justify-center py-2">
                <div className="w-[90px] h-[90px] rounded-[24px] bg-[#0e2032] border border-[#00a3e0]/40 shadow-xl flex flex-col items-center justify-center p-2">
                  <img src="/logo.png" alt="almoq3" className="w-[38px] h-[38px] object-contain mb-1" />
                  <span className="text-[#00a3e0] font-inter font-bold text-[9px] tracking-wider">
                    GATEWAY
                  </span>
                </div>
              </div>

              <div className="sm:col-span-4 space-y-3">
                <div className="bg-[#0e2032]/80 border border-[#1e3b56] rounded-[13px] p-3 text-right">
                  <p className="font-inter font-semibold text-[#00b8f0] text-[11px]">
                    REST API + Polling
                  </p>
                  <p className="text-[#8ba2ba] text-[10px]">للمشاريع والموبايل</p>
                </div>
                <div className="bg-[#0e2032]/80 border border-[#1e3b56] rounded-[13px] p-3 text-right">
                  <p className="font-inter font-semibold text-[#00b8f0] text-[11px]">
                    Instant Webhooks
                  </p>
                  <p className="text-[#8ba2ba] text-[10px]">توقيع HMAC-SHA256</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-2.5">
            <span className="bg-[#18344e] border border-[#264c6f] px-3.5 py-1.5 rounded-[9px] text-[11px] text-[#cfe3f5]">
              ✓ محرك Go & whatsmeow
            </span>
            <span className="bg-[#18344e] border border-[#264c6f] px-3.5 py-1.5 rounded-[9px] text-[11px] text-[#cfe3f5]">
              ✓ بصمات صوتية OGG/Opus PTT
            </span>
            <span className="bg-[#18344e] border border-[#264c6f] px-3.5 py-1.5 rounded-[9px] text-[11px] text-[#cfe3f5]">
              ✓ خوارزمية ذكية لمقاومة الحظر
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
