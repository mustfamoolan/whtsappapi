import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'نظرة عامة',
    icon: '/figma/nav-overview.svg',
    activeIcon: '/figma/nav-overview-active.svg',
  },
  {
    to: '/projects',
    label: 'المشاريع والأرقام',
    icon: '/figma/nav-projects.svg',
    activeIcon: '/figma/nav-projects-active.svg',
  },
  {
    to: '/playground',
    label: 'مختبر الإرسال',
    icon: '/figma/nav-playground.svg',
    activeIcon: '/figma/nav-playground-active.svg',
  },
  {
    to: '/logs',
    label: 'سجل الرسائل',
    icon: '/figma/nav-logs.svg',
    activeIcon: '/figma/nav-logs-active.svg',
  },
  {
    to: '/api-docs',
    label: 'توثيق API والربط',
    icon: '/figma/nav-webhook.svg',
    activeIcon: '/figma/nav-webhook-active.svg',
  },
];

export default function Sidebar({ mobileOpen = false, onClose }) {
  const { projects, user, setShowNewModal, logout } = useApp();
  const connectedCount = projects.filter((p) => p.status === 'connected').length;
  const usagePct =
    projects.length > 0 ? Math.round((connectedCount / projects.length) * 100) : 0;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#22213d]/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[260px] lg:w-[240px] shrink-0 bg-white h-screen overflow-y-auto flex flex-col justify-between p-4 border-l border-[#ededf5] transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
        }`}
      >
        <div>
          {/* Brand Logo */}
          <div className="px-2 pt-3 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[#0e2032] text-[26px] font-bold leading-none block">
                  almoq3
                </span>
                <p
                  className="font-inter text-[#00a3e0] text-[9.5px] font-semibold tracking-wider mt-1 text-right"
                  dir="ltr"
                >
                  WHATSAPP API GATEWAY
                </p>
              </div>
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="almoq3"
                  className="w-[44px] h-[44px] object-contain"
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق القائمة"
                  className="lg:hidden w-8 h-8 rounded-lg bg-[#f0f6fa] text-[#72849a] flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <p className="text-[#838398] text-[11px] px-3 mb-2">مساحة العمل</p>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `w-full h-[48px] rounded-[12px] px-3.5 flex items-center gap-3 transition-colors ${
                    isActive
                      ? 'bg-[#e6f6fc] text-[#00a3e0] font-bold'
                      : 'bg-white hover:bg-[#f8fafc] text-[#72849a] font-normal'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <img
                      src={isActive ? item.activeIcon : item.icon}
                      alt=""
                      className="w-[20px] h-[20px]"
                    />
                    <span className="text-[12px]">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Plan Card & User Profile */}
        <div className="space-y-4 pt-6">
          <div className="bg-[#f0f8fd] border border-[#d6effa] rounded-[18px] p-4">
            <p className="text-[#0e2032] font-semibold text-[13.5px]">
              حالة اتصال المشاريع
            </p>
            <p className="text-[#72849a] text-[11px] mt-1">
              {connectedCount} من {projects.length} مشروع متصل حالياً
            </p>
            <div className="w-full h-[5px] bg-[#d6effa] rounded-[3px] mt-4 overflow-hidden">
              <div
                className="h-full bg-[#00a3e0] rounded-[3px] transition-all duration-300"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                setShowNewModal(true);
              }}
              className="text-[#00a3e0] font-bold text-[12px] mt-3 block hover:underline"
            >
              + إضافة مشروع جديد
            </button>
          </div>

          <div className="border-t border-[#edf2f7] pt-4 px-2 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[#0e2032] font-semibold text-[13px] truncate">
                {user?.name || 'الأدمن'}
              </p>
              <a
                href="https://almoq3.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[#00a3e0] text-[10.5px] hover:underline font-semibold block"
              >
                تطوير almoq3
              </a>
            </div>
            <button
              type="button"
              onClick={logout}
              title="تسجيل الخروج"
              className="text-[#72849a] hover:text-[#d32f2f] text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-[#fdeeed] shrink-0"
            >
              خروج
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

