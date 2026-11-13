import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function NewProjectModal() {
  const navigate = useNavigate();
  const {
    showNewModal,
    setShowNewModal,
    apiFetch,
    setProjects,
    setSelectedProjectId,
    showToast,
  } = useApp();

  const [form, setForm] = useState({
    name: '',
    description: '',
    env: 'الإنتاج',
  });

  if (!showNewModal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      const res = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || `مشروع ضمن بيئة ${form.env}`,
          min_delay_ms: 1500,
          max_delay_ms: 4000,
          simulate_typing: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.data || data.project;
        if (created) {
          setProjects((prev) => [created, ...prev]);
          setSelectedProjectId(created.id);
          setShowNewModal(false);
          setForm({ name: '', description: '', env: 'الإنتاج' });
          navigate(`/projects/${created.id}`);
          showToast('تم إنشاء المشروع بنجاح — امسح الباركود لربط الرقم');
        }
      }
    } catch {
      showToast('حدث خطأ أثناء إنشاء المشروع');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#22213d]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-[560px] rounded-[24px] p-7 sm:p-8 shadow-2xl relative">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[#24233d] font-semibold text-[22px]">
              إضافة مشروع جديد
            </h2>
            <p className="text-[#838398] text-[12px] mt-1">
              سيحصل المشروع على جلسة واتساب مستقلة ومفاتيح API خاصة به.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(false)}
            className="w-[34px] h-[34px] rounded-[9px] bg-[#f8f7fd] hover:bg-[#efecfc] text-[#838398] flex items-center justify-center text-[13px]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
              اسم المشروع
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="متجر سلة • الإشعارات"
              className="w-full h-[50px] bg-[#f8f7fd] rounded-[11px] px-4 text-[#55516f] text-[13px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
            />
          </div>

          <div>
            <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
              وصف مختصر
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="إشعارات الطلبات وتحديثات الشحن للعملاء"
              className="w-full h-[50px] bg-[#f8f7fd] rounded-[11px] px-4 text-[#55516f] text-[13px] outline-none focus:ring-2 focus:ring-[#7b68ee]/30"
            />
          </div>

          <div>
            <label className="block text-[#24233d] font-semibold text-[12px] mb-2">
              البيئة
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['الإنتاج', 'التطوير'].map((envOption) => (
                <button
                  key={envOption}
                  type="button"
                  onClick={() => setForm({ ...form, env: envOption })}
                  className={`h-[48px] rounded-[11px] text-[12px] transition-all ${
                    form.env === envOption
                      ? 'bg-[#efecfc] text-[#7b68ee] font-semibold'
                      : 'bg-[#f8f7fd] text-[#838398]'
                  }`}
                >
                  {form.env === envOption ? '●' : '○'}  {envOption}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#f5f2fe] rounded-[12px] p-4">
            <p className="text-[#7b68ee] font-semibold text-[12px]">
              الخطوة التالية: مسح الباركود QR
            </p>
            <p className="text-[#838398] text-[11px] mt-1">
              بعد الإنشاء سنولّد لك مفتاح X-API-Key وشاشة باركود لربط الرقم فوراً.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3">
            <button
              type="submit"
              className="flex-1 h-[48px] bg-[#7b68ee] hover:bg-[#6b58dc] text-white font-semibold text-[13px] rounded-[11px] px-6 text-right transition-colors"
            >
              إنشاء المشروع وربط الرقم  ←
            </button>
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="h-[48px] px-6 bg-[#f8f7fd] hover:bg-[#efecfc] text-[#838398] text-[12px] rounded-[11px] transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

