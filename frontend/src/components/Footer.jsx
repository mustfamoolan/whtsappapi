import React from 'react';

export default function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 text-[#72849a] text-[11px] pt-4 border-t border-[#edf2f7] mt-6">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#208b72] animate-pulse" />
        <span>جميع خوادم الـ API وواتساب تعمل بكفاءة عالية</span>
      </div>
      <div className="flex items-center gap-3">
        <span>بوابة almoq3 WhatsApp API © {new Date().getFullYear()}</span>
        <span>•</span>
        <a
          href="https://almoq3.com/"
          target="_blank"
          rel="noreferrer"
          className="text-[#00a3e0] hover:underline font-bold"
        >
          تطوير almoq3
        </a>
      </div>
    </footer>
  );
}
