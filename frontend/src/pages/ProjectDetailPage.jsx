import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getProjectStatusBadge } from '../utils/status';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, selectedProject, setSelectedProjectId } = useApp();

  const numericId = Number(id);

  useEffect(() => {
    if (numericId && (!selectedProject || selectedProject.id !== numericId)) {
      setSelectedProjectId(numericId);
    }
  }, [numericId, selectedProject, setSelectedProjectId]);

  const project = projects.find((p) => p.id === numericId) || selectedProject;
  const badge = getProjectStatusBadge(project?.status);

  if (!project) {
    return (
      <div className="bg-white rounded-[18px] p-8 text-center">
        <p className="text-[#24233d] font-semibold text-[15px]">
          جاري تحميل بيانات المشروع...
        </p>
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="mt-4 text-[#7b68ee] text-[12px] font-semibold hover:underline"
        >
          العودة إلى قائمة المشاريع
        </button>
      </div>
    );
  }

  const tabs = [
    { to: `/projects/${project.id}`, end: true, label: 'ربط واتساب والمفاتيح' },
    { to: `/projects/${project.id}/webhook`, label: 'الحماية و Webhook' },
    { to: `/projects/${project.id}/playground`, label: 'مختبر الإرسال' },
    { to: `/projects/${project.id}/logs`, label: 'سجل الرسائل' },
  ];

  return (
    <div className="space-y-5">
      {/* Project Workspace Header */}
      <div className="bg-white rounded-[18px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="bg-[#f8f7fd] hover:bg-[#efecfc] text-[#7b68ee] text-[12px] font-semibold h-[38px] px-3.5 rounded-[10px] transition-colors"
          >
            → كل المشاريع
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[#22213d] font-semibold text-[18px]">
                {project.name}
              </h2>
              <span
                className={`${badge.bg} ${badge.text} text-[10px] font-semibold px-2.5 py-0.5 rounded-[7px]`}
              >
                {badge.shortLabel}
              </span>
            </div>
            <p className="font-inter text-[#838398] text-[11px] mt-0.5" dir="ltr">
              {project.phone_number || 'غير مربوط برقم واتساب بعد'}
            </p>
          </div>
        </div>

        {/* Project Sub-tabs */}
        <div className="bg-[#f8f7fd] p-1 rounded-[12px] flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-[9px] text-[12px] transition-all ${
                  isActive
                    ? 'bg-white text-[#7b68ee] font-semibold shadow-sm'
                    : 'text-[#838398] hover:text-[#22213d]'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Active Project Tab Content */}
      <Outlet />
    </div>
  );
}

