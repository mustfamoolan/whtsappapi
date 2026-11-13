import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getProjectStatusBadge } from '../utils/status';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { user, projects, setSelectedProjectId, setShowNewModal, apiFetch } = useApp();
  const [stats, setStats] = useState({
    outbound_count: 0,
    inbound_count: 0,
    delivered_count: 0,
    failed_count: 0,
    daily_traffic: [],
  });

  useEffect(() => {
    apiFetch('/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((res) => {
        if (res?.data) setStats(res.data);
      })
      .catch(() => {});
  }, [apiFetch]);

  const connectedCount = projects.filter((p) => p.status === 'connected').length;
  const waitingQrCount = projects.filter(
    (p) => p.status === 'qr_ready' || p.status === 'connecting'
  ).length;
  const totalProcessed = stats.delivered_count + stats.failed_count;
  const healthPct =
    totalProcessed > 0
      ? ((stats.delivered_count / totalProcessed) * 100).toFixed(1)
      : '100.0';

  const kpis = [
    {
      label: 'إجمالي المشاريع',
      value: projects.length,
      sub: projects.length > 0 ? 'مشاريع مسجلة في النظام' : 'لا توجد مشاريع بعد',
      subColor: 'text-[#00a3e0]',
    },
    {
      label: 'الأرقام المتصلة',
      value: connectedCount,
      sub: connectedCount > 0 ? 'متزامنة بالكامل' : 'بانتظار ربط رقم',
      subColor: 'text-[#208b72]',
    },
    {
      label: 'بانتظار مسح QR',
      value: waitingQrCount,
      sub: waitingQrCount > 0 ? 'جاهز للمسح الفوري' : 'لا يوجد انتظار',
      subColor: 'text-[#a7772e]',
    },
    {
      label: 'الرسائل المرسلة',
      value: stats.outbound_count.toLocaleString(),
      sub: 'إجمالي الرسائل الصادرة',
      subColor: 'text-[#208b72]',
    },
    {
      label: 'الرسائل المستقبلة',
      value: stats.inbound_count.toLocaleString(),
      sub: 'مفلترة للذكاء الاصطناعي',
      subColor: 'text-[#00a3e0]',
    },
  ];

  const daily = stats.daily_traffic || [];
  const maxTraffic = Math.max(
    1,
    ...daily.map((d) => Math.max(d.outbound || 0, d.inbound || 0))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[#838398] text-[11px] mb-1">مساحة العمل / نظرة عامة</p>
          <h1 className="text-[#22213d] text-[27px] font-semibold">
            أهلاً بك، {user?.name?.split(' ')[0] || 'مدير النظام'}
          </h1>
          <p className="text-[#838398] text-[13px] mt-1">
            نظرة مباشرة على مشاريعك، حالة الأرقام، وحركة الرسائل الفعلية.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="bg-[#00a3e0] hover:bg-[#0090c7] text-white h-[48px] px-6 rounded-[12px] font-semibold text-[13px] transition-colors"
        >
          مشروع جديد  +
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-[18px] p-5 h-[132px] flex flex-col justify-between"
          >
            <p className="text-[#838398] text-[12px]">{kpi.label}</p>
            <p className="font-inter font-semibold text-[#23223d] text-[28px]">
              {kpi.value}
            </p>
            <p className={`${kpi.subColor} text-[10px]`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Real 7-Day Traffic Chart + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-[18px] p-6 flex flex-col justify-between min-h-[296px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[#23223d] font-semibold text-[16px]">حركة الرسائل</h2>
              <p className="text-[#838398] text-[11px] mt-0.5">
                الإرسال والاستقبال الفعلي خلال آخر 7 أيام
              </p>
            </div>
            <div className="flex items-center gap-6 text-[10px] text-[#838398]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#00a3e0]" />
                مرسلة
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[#dcd5fb]" />
                مستقبلة
              </span>
            </div>
          </div>

          <div className="my-4 flex-1 grid grid-cols-7 gap-3 items-end min-h-[150px] pt-4">
            {daily.map((d) => {
              const outH = Math.max(6, Math.round(((d.outbound || 0) / maxTraffic) * 120));
              const inH = Math.max(6, Math.round(((d.inbound || 0) / maxTraffic) * 120));
              return (
                <div key={d.date} className="flex flex-col items-center justify-end h-full gap-2">
                  <div className="flex items-end gap-1.5 h-[125px]">
                    <div
                      title={`صادرة: ${d.outbound}`}
                      className="w-3 sm:w-4 bg-[#00a3e0] rounded-t-[4px] transition-all"
                      style={{ height: `${outH}px` }}
                    />
                    <div
                      title={`واردة: ${d.inbound}`}
                      className="w-3 sm:w-4 bg-[#dcd5fb] rounded-t-[4px] transition-all"
                      style={{ height: `${inH}px` }}
                    />
                  </div>
                  <span className="text-[#838398] text-[10px]">{d.day_label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-[18px] p-6 flex flex-col justify-between min-h-[296px]">
          <div>
            <h2 className="text-[#23223d] font-semibold text-[16px]">سلامة النظام</h2>
            <p className="text-[#838398] text-[11px] mt-0.5">
              معدل نجاح التسليم الفعلي للرسائل
            </p>
          </div>

          <div className="relative w-[132px] h-[132px] mx-auto my-3 flex items-center justify-center">
            <img src="/figma/ring-track.svg" alt="" className="absolute inset-0 w-full h-full" />
            <img
              src="/figma/ring-progress.svg"
              alt=""
              className="absolute inset-0 w-full h-full"
            />
            <div className="text-center z-10">
              <p className="font-inter font-semibold text-[#23223d] text-[24px] leading-none">
                {healthPct}%
              </p>
              <p className="text-[#838398] text-[10px] mt-1">
                {stats.failed_count === 0 ? 'مستقر' : `${stats.failed_count} فشل`}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-center">
            <p className="text-[#208b72] text-[11px]">الطابور الذكي يعمل بشكل طبيعي</p>
            <p className="text-[#838398] text-[10px]">
              تم تسليم {stats.delivered_count} من أصل {totalProcessed} رسالة
            </p>
          </div>
        </div>
      </div>

      {/* Real Connected Numbers + CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-[18px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#23223d] font-semibold text-[16px]">أرقامك، على اتصال</h2>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="text-[#00a3e0] font-semibold text-[12px] hover:underline"
            >
              عرض كل المشاريع  ←
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="bg-[#f8f7fd] rounded-[12px] p-6 text-center">
              <p className="text-[#24233d] font-semibold text-[13px]">
                لا توجد مشاريع مضافة بعد
              </p>
              <p className="text-[#838398] text-[11px] mt-1 mb-4">
                أنشئ مشروعك الأول للحصول على X-API-Key وربط رقم واتساب الخاص به.
              </p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="bg-[#00a3e0] text-white text-[12px] font-semibold px-4 py-2 rounded-[10px]"
              >
                + إضافة مشروع جديد
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {projects.slice(0, 4).map((proj) => {
                const badge = getProjectStatusBadge(proj.status);
                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      navigate(`/projects/${proj.id}`);
                    }}
                    className="bg-[#f8f7fd] hover:bg-[#f2effd] cursor-pointer transition-colors min-h-[46px] rounded-[11px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-[#24233d] font-semibold text-[12px]">
                      {proj.name}
                    </span>
                    <span className="font-inter text-[#838398] text-[12px]" dir="ltr">
                      {proj.phone_number || 'غير مربوط بعد'}
                    </span>
                    <span
                      className={`${badge.bg} ${badge.text} font-semibold text-[9px] px-3 py-1 rounded-[7px]`}
                    >
                      {badge.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-[#00a3e0] rounded-[18px] p-6 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-[19px] font-semibold mb-2">من الفكرة إلى أول رسالة.</h3>
            <p className="text-[#e7e2fd] text-[12px] leading-[1.6]">
              أنشئ مشروعاً، امسح الباركود، وأرسل أول رسالة عبر API خلال أقل من دقيقة.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/playground')}
            className="mt-6 bg-white text-[#00a3e0] font-semibold text-[12px] h-[42px] px-5 rounded-[10px] self-start hover:bg-[#f8f7fd] transition-colors"
          >
            افتح مختبر الإرسال  ←
          </button>
        </div>
      </div>
    </div>
  );
}
