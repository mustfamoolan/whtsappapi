import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getProjectStatusBadge } from '../utils/status';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, setSelectedProjectId, setShowNewModal, globalSearch, setGlobalSearch } =
    useApp();
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = projects.filter((p) => {
    const q = globalSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.phone_number?.includes(q) ||
      p.description?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[#838398] text-[11px] mb-1">
            مساحة العمل / المشاريع والأرقام
          </p>
          <h1 className="text-[#22213d] text-[27px] font-semibold">المشاريع والأرقام</h1>
          <p className="text-[#838398] text-[13px] mt-1">
            أنشئ مشاريعك وأدر أرقام واتساب المرتبطة بها.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="bg-[#7b68ee] hover:bg-[#6b58dc] text-white h-[48px] px-6 rounded-[12px] font-semibold text-[13px] transition-colors"
        >
          إضافة مشروع  +
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white min-h-[60px] rounded-[18px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="ابحث باسم المشروع أو رقم الهاتف..."
            className="bg-[#f8f7fd] h-[42px] w-full sm:max-w-[360px] rounded-[10px] px-4 text-[12px] text-[#22213d] placeholder-[#838398] outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-[#838398] text-[12px] outline-none cursor-pointer"
          >
            <option value="all">كل الحالات ⌄</option>
            <option value="connected">متصل</option>
            <option value="qr_ready">بانتظار مسح الباركود</option>
            <option value="disconnected">غير متصل</option>
          </select>
        </div>
        <span className="text-[#838398] text-[12px]">{filtered.length} مشاريع</span>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((proj) => {
          const badge = getProjectStatusBadge(proj.status);
          return (
            <div
              key={proj.id}
              className="bg-white h-[200px] rounded-[18px] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-[#24233d] font-semibold text-[16px] truncate">
                    {proj.name}
                  </h3>
                  <span
                    className={`${badge.bg} ${badge.text} font-semibold text-[9px] h-[26px] px-3 rounded-[8px] inline-flex items-center shrink-0`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-[#838398] text-[11px] truncate mb-4">
                  {proj.description || 'إشعارات الطلبات وتكامل الـ API'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[#9895ad] text-[10px]">الإنتاج</span>
                  <span className="font-inter text-[#55546e] text-[14px]" dir="ltr">
                    {proj.phone_number || 'غير مربوط بعد'}
                  </span>
                </div>
              </div>

              <div>
                <div className="h-px bg-[#efedf7] mb-3" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(proj.id);
                    navigate(`/projects/${proj.id}`);
                  }}
                  className="w-full h-[41px] bg-[#f6f4fe] hover:bg-[#ece8fc] transition-colors rounded-[10px] text-[#7b68ee] font-semibold text-[12px] px-4 text-right"
                >
                  فتح لوحة المشروع  ←
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

