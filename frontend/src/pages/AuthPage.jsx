import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function AuthPage() {
  const navigate = useNavigate();
  const { saveSession, showToast, toast } = useApp();
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: 'admin@whatsapp.local',
    password: 'admin123',
    confirmPassword: '',
    company: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      const path = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authForm.name || 'أحمد محمد',
          email: authForm.email,
          password: authForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل تسجيل الدخول');
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
      className="min-h-screen bg-[#f7f7fc] flex items-center justify-center p-4 lg:p-8"
      dir="rtl"
    >
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#24213b] text-white px-5 py-3 rounded-[12px] shadow-lg text-[12px] font-semibold">
          {toast}
        </div>
      )}

      <div className="w-full max-w-[1440px] bg-[#f7f7fc] rounded-[24px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Form Column */}
        <div className="lg:col-span-6 flex flex-col justify-between px-4 sm:px-12 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-[13px] bg-[#7b68ee] flex items-center justify-center text-white font-inter font-semibold text-[23px]">
                W
              </div>
              <span className="text-[#22213d] text-[29px] font-semibold">وصلة</span>
            </div>
            <span className="text-[#838398] text-[12px]">بوابة واتساب للمشاريع</span>
          </div>

          <div className="bg-white rounded-[24px] p-8 sm:p-10 shadow-[0_8px_30px_rgba(34,33,61,0.03)] my-8 max-w-[540px] w-full mx-auto">
            <div className="bg-[#f3f2fa] h-[46px] rounded-[12px] p-1 grid grid-cols-2 gap-1 mb-8">
              {[
                { id: 'login', label: 'تسجيل الدخول' },
                { id: 'register', label: 'إنشاء حساب' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setAuthMode(tab.id);
                    setError('');
                  }}
                  className={`rounded-[9px] text-[13px] transition-all ${
                    authMode === tab.id
                      ? 'bg-white text-[#23223d] font-semibold shadow-sm'
                      : 'text-[#84839a] font-normal'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <h1 className="text-[#23223d] text-[28px] sm:text-[31px] font-semibold mb-2">
              {authMode === 'login' ? 'أهلاً بعودتك' : 'ابدأ مساحتك الخاصة'}
            </h1>
            <p className="text-[#838398] text-[13px] mb-7">
              {authMode === 'login'
                ? 'سجّل دخولك لإدارة مشاريعك وأرقام واتساب المتصلة.'
                : 'أنشئ حساباً لربط أرقامك وإدارة مشاريعك من لوحة واحدة.'}
            </p>

            {error && (
              <div className="mb-5 bg-[#fceef1] text-[#c25e76] px-4 py-3 rounded-[11px] text-[12px] font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-[#24233d] text-[12px] font-semibold mb-2">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    required
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    placeholder="أحمد محمد"
                    className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-[#55516f] text-[14px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#24233d] text-[12px] font-semibold mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="ahmed@acme.dev"
                  className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-left font-inter text-[#55516f] text-[14px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
                />
              </div>

              {authMode === 'login' ? (
                <div>
                  <label className="block text-[#24233d] text-[12px] font-semibold mb-2">
                    كلمة المرور
                  </label>
                  <input
                    type="password"
                    required
                    dir="ltr"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-left font-inter text-[#55516f] text-[14px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#24233d] text-[12px] font-semibold mb-2">
                      كلمة المرور
                    </label>
                    <input
                      type="password"
                      required
                      dir="ltr"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-left font-inter text-[#55516f] text-[14px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[#24233d] text-[12px] font-semibold mb-2">
                      تأكيد كلمة المرور
                    </label>
                    <input
                      type="password"
                      required
                      dir="ltr"
                      value={authForm.confirmPassword}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, confirmPassword: e.target.value })
                      }
                      placeholder="••••••••••••"
                      className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-left font-inter text-[#55516f] text-[14px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
                    />
                  </div>
                </div>
              )}

              {authMode === 'register' && (
                <div>
                  <label className="block text-[#24233d] text-[12px] font-semibold mb-2">
                    اسم الشركة أو الفريق • اختياري
                  </label>
                  <input
                    type="text"
                    value={authForm.company}
                    onChange={(e) => setAuthForm({ ...authForm, company: e.target.value })}
                    placeholder="شركة أفق الرقمية"
                    className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-[#55516f] text-[14px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
                  />
                </div>
              )}

              {authMode === 'login' ? (
                <div className="flex items-center justify-between pt-1 text-[12px]">
                  <label className="flex items-center gap-2 text-[#838398] cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-[18px] h-[18px] accent-[#7b68ee] rounded-[5px]"
                    />
                    <span>تذكرني على هذا الجهاز</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      showToast('بيانات الدخول الافتراضية: admin@whatsapp.local / admin123')
                    }
                    className="text-[#7b68ee] font-semibold hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
              ) : (
                <p className="text-[#838398] text-[11px] pt-1">
                  بإنشاء الحساب، أنت توافق على شروط الخدمة وسياسة الخصوصية.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[54px] bg-[#7b68ee] hover:bg-[#6b58dc] transition-colors rounded-[12px] text-white font-semibold text-[15px] mt-2 shadow-sm"
              >
                {loading
                  ? 'جاري التحقق...'
                  : authMode === 'login'
                  ? 'دخول إلى لوحة التحكم  ←'
                  : 'إنشاء الحساب والبدء  ←'}
              </button>
            </form>

            <div className="mt-7 text-center text-[12px]">
              <span className="text-[#838398]">
                {authMode === 'login' ? 'ليس لديك حساب بعد؟ ' : 'لديك حساب بالفعل؟ '}
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-[#7b68ee] font-semibold mr-2 hover:underline"
                >
                  {authMode === 'login' ? 'إنشاء حساب جديد ←' : 'تسجيل الدخول ←'}
                </button>
              </span>
            </div>
          </div>

          <div className="text-[#838398] text-[10px] text-center">
            تشفير كامل للمفاتيح • عزل تام بين المشاريع
          </div>
        </div>

        {/* Purple Showcase Hero */}
        <div className="lg:col-span-6 bg-[#7865e9] rounded-[28px] p-8 sm:p-14 text-white flex flex-col justify-between relative overflow-hidden min-h-[680px]">
          <div>
            <div className="inline-flex items-center bg-[#8d7cf0] h-[34px] px-4 rounded-[9px] text-[11px] font-semibold mb-8">
              بوابة موحّدة • أرقام مستقلة لكل مشروع
            </div>
            <h2 className="text-[36px] sm:text-[42px] font-semibold leading-[1.35] mb-4 max-w-[490px]">
              كل محادثة، تبدأ باتصال ذكي.
            </h2>
            <p className="text-[#e7e3fd] text-[15px] leading-[1.7] max-w-[490px]">
              اربط كل مشروع برقمه الخاص عبر QR، وأدر الإرسال والاستقبال والـ Webhooks من
              مكان واحد هادئ وواضح.
            </p>
          </div>

          <div className="bg-[#8978ed] rounded-[22px] p-6 sm:p-7 my-8">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5 space-y-3">
                {[
                  { name: 'متجر سلة', phone: '+966 50 123 4567', dot: 'bg-[#208b72]' },
                  { name: 'مساعد الذكاء الاصطناعي', phone: '+966 55 987 6543', dot: 'bg-[#208b72]' },
                  { name: 'نظام التذاكر والدعم', phone: '+971 50 321 8765', dot: 'bg-[#e09f3e]' },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="bg-white rounded-[15px] p-3.5 flex items-center justify-between text-[#23223d]"
                  >
                    <div>
                      <p className="font-semibold text-[13px]">{c.name}</p>
                      <p className="font-inter text-[#828197] text-[11px]" dir="ltr">
                        {c.phone}
                      </p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                  </div>
                ))}
              </div>

              <div className="sm:col-span-3 flex flex-col items-center justify-center py-2">
                <div className="w-[88px] h-[88px] rounded-[24px] bg-white shadow-md flex flex-col items-center justify-center">
                  <span className="text-[#23223d] font-semibold text-[16px]">وصلة</span>
                  <span className="text-[#7b68ee] font-inter font-semibold text-[10px]">
                    API Hub
                  </span>
                </div>
              </div>

              <div className="sm:col-span-4 space-y-3">
                <div className="bg-[#f4f2fe] rounded-[13px] p-3 text-right">
                  <p className="font-inter font-semibold text-[#23223d] text-[11px]">
                    Webhook
                  </p>
                  <p className="text-[#7d7b92] text-[10px]">أحداث فورية موقّعة</p>
                </div>
                <div className="bg-[#f4f2fe] rounded-[13px] p-3 text-right">
                  <p className="font-inter font-semibold text-[#23223d] text-[11px]">
                    REST API
                  </p>
                  <p className="text-[#7d7b92] text-[10px]">إرسال نص ووسائط</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="bg-[#8b7bee] px-4 py-2 rounded-[9px] text-[11px]">
              ✓ حماية ذكية من الحظر
            </span>
            <span className="bg-[#8b7bee] px-4 py-2 rounded-[9px] text-[11px]">
              ✓ Webhooks موثوقة مع إعادة المحاولة
            </span>
            <span className="bg-[#8b7bee] px-4 py-2 rounded-[9px] text-[11px]">
              ✓ بصمات صوتية PTT تلقائية
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

