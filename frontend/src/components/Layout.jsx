import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import NewProjectModal from './NewProjectModal';
import { useApp } from '../context/AppContext';

export default function Layout() {
  const { toast } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#f7f7fc] flex" dir="rtl">
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:right-auto sm:left-6 z-50 bg-[#24213b] text-white px-5 py-3 rounded-[12px] shadow-lg text-[12px] font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#208b72] shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <Sidebar
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4">
          <Topbar onOpenMenu={() => setMobileMenuOpen(true)} />
        </div>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-2">
          <Outlet />
        </main>

        <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-3 bg-[#f7f7fc]">
          <Footer />
        </div>
      </div>

      <NewProjectModal />
    </div>
  );
}
