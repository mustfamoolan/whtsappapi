import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getProjectStatusBadge } from '../utils/status';

export default function Topbar({ onOpenMenu }) {
  const navigate = useNavigate();
  const {
    projects,
    selectedProject,
    setSelectedProjectId,
    globalSearch,
    setGlobalSearch,
    setShowNewModal,
  } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-white min-h-[64px] rounded-[17px] px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-[0_2px_12px_rgba(34,33,61,0.02)]">
      {/* Right side: Mobile Hamburger + Project Switcher */}
      <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="فتح القائمة"
          className="lg:hidden w-10 h-10 shrink-0 rounded-[11px] bg-[#f8f7fd] hover:bg-[#e8f6fd] text-[#22213d] flex items-center justify-center text-lg"
        >
          ☰
        </button>

        <div className="relative min-w-0 flex-1 sm:flex-initial">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="bg-[#f8f7fd] h-[44px] w-full sm:w-[280px] md:w-[320px] rounded-[11px] px-3 sm:px-3.5 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className={`w-[7px] h-[7px] rounded-full shrink-0 ${
                  selectedProject?.status === 'connected'
                    ? 'bg-[#208b72]'
                    : 'bg-[#a7772e]'
                }`}
              />
              <span className="text-[#22213d] font-semibold text-[12px] sm:text-[13px] truncate">
                {selectedProject
                  ? `${selectedProject.name} • الإنتاج`
                  : 'جميع المشاريع'}
              </span>
            </div>
            <span className="text-[#838398] text-[16px] leading-none shrink-0">⌄</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-[280px] sm:w-[320px] bg-white rounded-[14px] shadow-xl border border-[#ededf5] py-2 z-40">
              {projects.map((p) => {
                const badge = getProjectStatusBadge(p.status);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setDropdownOpen(false);
                      navigate(`/projects/${p.id}`);
                    }}
                    className={`w-full px-4 py-2.5 text-right flex items-center justify-between hover:bg-[#f8f7fd] ${
                      selectedProject?.id === p.id
                        ? 'bg-[#f5f2fe] text-[#00a3e0] font-semibold'
                        : 'text-[#22213d]'
                    }`}
                  >
                    <span className="text-[13px] truncate">{p.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 ${badge.bg} ${badge.text}`}
                    >
                      {badge.shortLabel}
                    </span>
                  </button>
                );
              })}
              <div className="border-t border-[#ededf5] mt-1 pt-1 px-2">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowNewModal(true);
                  }}
                  className="w-full py-2 text-right px-2 text-[#00a3e0] text-[12px] font-semibold hover:bg-[#f8f7fd] rounded-lg"
                >
                  + إضافة مشروع جديد
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar (Desktop) */}
      <div className="hidden xl:flex items-center justify-between w-[320px] px-3 py-2 rounded-[10px]">
        <div className="flex items-center gap-2.5 flex-1">
          <img src="/figma/icon-search.svg" alt="" className="w-5 h-5" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && globalSearch.trim()) {
                navigate('/projects');
              }
            }}
            placeholder="ابحث عن مشروع أو رسالة..."
            className="bg-transparent text-[12px] text-[#22213d] placeholder-[#838398] outline-none w-full"
          />
        </div>
        <span className="font-inter text-[#838398] text-[10px]">⌘ K</span>
      </div>

      {/* Environment Indicator & Bell */}
      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="w-[7px] h-[7px] rounded-full bg-[#208b72]" />
          <span className="hidden sm:inline text-[#208b72] text-[11px]">
            بيئة الإنتاج
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/logs')}
          className="p-1.5 rounded-lg hover:bg-[#f8f7fd]"
          title="سجل الرسائل و Webhooks"
        >
          <img src="/figma/icon-bell.svg" alt="" className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
