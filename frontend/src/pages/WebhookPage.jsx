import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

export default function WebhookPage() {
  const { selectedProject, setProjects, apiFetch, showToast } = useApp();
  const [form, setForm] = useState({
    name: '',
    description: '',
    webhook_url: '',
    allow_groups: false,
    simulate_typing: true,
    min_delay_ms: 1500,
    max_delay_ms: 4000,
  });
  const [testing, setTesting] = useState(false);

  const resetFormFromProject = () => {
    if (!selectedProject) return;
    setForm({
      name: selectedProject.name || '',
      description: selectedProject.description || '',
      webhook_url: selectedProject.webhook_url || '',
      allow_groups: Boolean(selectedProject.allow_groups),
      simulate_typing:
        selectedProject.simulate_typing !== undefined
          ? Boolean(selectedProject.simulate_typing)
          : true,
      min_delay_ms: selectedProject.min_delay_ms || 1500,
      max_delay_ms: selectedProject.max_delay_ms || 4000,
    });
  };

  useEffect(() => {
    resetFormFromProject();
  }, [selectedProject?.id]);

  const handleSave = async () => {
    if (!selectedProject) return;
    try {
      const res = await apiFetch(`/projects/${selectedProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name || selectedProject.name,
          description: form.description,
          webhook_url: form.webhook_url,
          allow_groups: form.allow_groups,
          simulate_typing: form.simulate_typing,
          min_delay_ms: Number(form.min_delay_ms) || 1500,
          max_delay_ms: Number(form.max_delay_ms) || 4000,
        }),
      });
      if (res.ok) {
        const resData = await res.json();
        const updated = resData.data || resData.project;
        if (updated) {
          setProjects((prev) =>
            prev.map((p) => (p.id === selectedProject.id ? updated : p))
          );
        }
        showToast('تم حفظ إعدادات الحماية و Webhook بنجاح');
      }
    } catch {
      showToast('تعذر حفظ الإعدادات');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#838398] text-[11px] mb-1">
          المشاريع / {selectedProject?.name || 'متجر سلة'} / الحماية و Webhook
        </p>
        <h1 className="text-[#22213d] text-[27px] font-semibold">
          إعدادات Webhook والحماية الذكية
        </h1>
        <p className="text-[#838398] text-[13px] mt-1">
          حدّد رابط استقبال الأحداث، واضبط الإرسال الآمن لمحاكاة الاستخدام البشري.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Webhook URL Card */}
          <div className="bg-white rounded-[18px] p-6">
            <h2 className="text-[#24233d] font-semibold text-[17px]">
              أين نرسل أحداث مشروعك؟
            </h2>
            <p className="text-[#838398] text-[11px] mt-1">
              نرسل الرسائل الواردة وتحديثات الحالة فوراً مع توقيع HMAC-SHA256.
            </p>

            <div className="mt-5">
              <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                رابط الاستقبال / Webhook URL
              </label>
              <input
                type="url"
                dir="ltr"
                value={form.webhook_url}
                onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                placeholder="https://api.salla-store.dev/webhooks/whatsapp"
                className="w-full h-[52px] bg-[#f8f7fd] rounded-[11px] px-4 text-left font-inter text-[#5d5975] text-[13px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={testing || !selectedProject}
                onClick={async () => {
                  if (!selectedProject) return;
                  setTesting(true);
                  try {
                    const res = await apiFetch(`/projects/${selectedProject.id}/test-webhook`, {
                      method: 'POST',
                    });
                    const data = await res.json();
                    if (res.ok && data.ok) {
                      showToast(`نجح الاتصال: استجاب الخادم برمز ${data.status_code}`);
                    } else {
                      showToast(data.error || `فشل الاختبار (HTTP ${data.status_code || res.status})`);
                    }
                  } catch {
                    showToast('تعذر الاتصال بالخادم لإجراء الاختبار');
                  } finally {
                    setTesting(false);
                  }
                }}
                className="bg-[#efecfc] hover:bg-[#e3defa] text-[#7b68ee] font-semibold text-[12px] h-[42px] px-5 rounded-[10px] transition-colors"
              >
                {testing ? 'جاري الاختبار...' : 'اختبار الاتصال'}
              </button>
              <span className="text-[#208b72] text-[11px]">
                ● إعادة محاولة تلقائية حتى 4 مرات عند انقطاع خادمك
              </span>
            </div>
          </div>

          {/* Anti-Ban & Filtering Card */}
          <div className="bg-white rounded-[18px] p-6">
            <h2 className="text-[#24233d] font-semibold text-[17px]">
              إرسال طبيعي، وتحكّم أدق.
            </h2>
            <p className="text-[#838398] text-[11px] mt-1">
              طابور ذكي بفاصل زمني عشوائي وفلترة للرسائل غير المهمة قبل وصولها لمشروعك.
            </p>

            <div className="mt-5 space-y-3">
              {[
                {
                  key: 'allow_groups',
                  title: 'السماح برسائل المجموعات',
                  desc: 'تجاهل رسائل القروبات افتراضياً لحماية الذكاء الاصطناعي من الإزعاج.',
                },
                {
                  key: 'simulate_typing',
                  title: 'محاكاة الكتابة والتسجيل الصوتي',
                  desc: 'إظهار جاري الكتابة أو تسجيل صوتي قبل الإرسال الفعلي.',
                },
              ].map((toggle) => (
                <div
                  key={toggle.key}
                  className="bg-[#f8f7fd] h-[66px] rounded-[13px] px-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[#24233d] font-semibold text-[13px]">
                      {toggle.title}
                    </p>
                    <p className="text-[#838398] text-[11px]">{toggle.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, [toggle.key]: !form[toggle.key] })}
                    className={`w-[44px] h-[24px] rounded-full p-1 transition-colors flex items-center shrink-0 ${
                      form[toggle.key]
                        ? 'bg-[#7b68ee] justify-start'
                        : 'bg-[#d9d7e8] justify-end'
                    }`}
                  >
                    <span className="w-[16px] h-[16px] rounded-full bg-white block shadow-sm" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                  الحد الأدنى للتأخير (ms)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={form.min_delay_ms}
                  onChange={(e) => setForm({ ...form, min_delay_ms: e.target.value })}
                  className="w-full h-[50px] bg-[#f8f7fd] rounded-[10px] px-4 text-left font-inter font-semibold text-[#24233d] text-[14px] outline-none"
                />
              </div>
              <div>
                <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
                  الحد الأقصى للتأخير (ms)
                </label>
                <input
                  type="number"
                  dir="ltr"
                  value={form.max_delay_ms}
                  onChange={(e) => setForm({ ...form, max_delay_ms: e.target.value })}
                  className="w-full h-[50px] bg-[#f8f7fd] rounded-[10px] px-4 text-left font-inter font-semibold text-[#24233d] text-[14px] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Left Summary Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#efebfd] rounded-[18px] p-6">
            <h3 className="text-[#24233d] font-semibold text-[19px]">
              صُمّم للثقة، لا للإزعاج.
            </h3>
            <p className="text-[#6f6b8a] text-[12px] leading-[1.7] mt-2">
              نرتّب الرسائل في طابور ذكي بفاصل عشوائي بين{' '}
              {(form.min_delay_ms / 1000).toFixed(1)} و{' '}
              {(form.max_delay_ms / 1000).toFixed(1)} ثانية لتقليل احتمالية حظر الرقم.
            </p>
            <div className="mt-5 space-y-2.5 text-[#24233d] text-[12px]">
              <p>✓ تجاهل تلقائي لتحديثات الحالة والبرودكاست</p>
              <p>✓ تجاهل الرسائل الصادرة من نفس الرقم لمنع الحلقات</p>
              <p>✓ توقيع رقمي لكل طلب Webhook وارد لمشروعك</p>
              <p>✓ تحويل الملفات الصوتية تلقائياً إلى بصمة OGG/Opus</p>
            </div>
          </div>

          <div className="bg-white rounded-[18px] p-6">
            <h3 className="text-[#24233d] font-semibold text-[15px] mb-4">
              إعداداتك الحالية
            </h3>
            <div className="space-y-3 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[#838398]">فلترة المجموعات</span>
                <span className="text-[#208b72] font-semibold">
                  {form.allow_groups ? 'مسموح بالمجموعات' : 'مفعّلة • تجاهل القروبات'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#838398]">محاكاة الحضور البشري</span>
                <span className="text-[#208b72] font-semibold">
                  {form.simulate_typing ? 'مفعّلة • كتابة وتسجيل' : 'معطّلة'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#838398]">الفاصل الزمني العشوائي</span>
                <span className="font-inter font-semibold text-[#24233d]" dir="ltr">
                  {form.min_delay_ms} ms – {form.max_delay_ms} ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#838398]">توقيع Webhook</span>
                <span className="font-inter font-semibold text-[#7b68ee]" dir="ltr">
                  HMAC-SHA256
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="bg-white min-h-[70px] rounded-[16px] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="bg-[#7b68ee] hover:bg-[#6b58dc] text-white font-semibold text-[13px] h-[44px] px-6 rounded-[11px] transition-colors"
          >
            حفظ التغييرات
          </button>
          <button
            type="button"
            onClick={resetFormFromProject}
            className="bg-[#f8f7fd] hover:bg-[#efecfc] text-[#838398] text-[12px] h-[44px] px-5 rounded-[11px] transition-colors"
          >
            إلغاء التغييرات
          </button>
        </div>
        <span className="text-[#838398] text-[11px] hidden sm:inline">
          تُطبّق التغييرات فوراً على جميع الرسائل الجديدة في هذا المشروع.
        </span>
      </div>
    </div>
  );
}

