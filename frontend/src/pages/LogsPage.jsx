import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatTime,
  getMessageStatusBadge,
  getMessageTypeLabel,
  getWebhookStatusBadge,
} from '../utils/status';

export default function LogsPage() {
  const { selectedProject, apiFetch, showToast } = useApp();
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchMessages = useCallback(async () => {
    if (!selectedProject?.id) return;
    try {
      const res = await apiFetch(`/projects/${selectedProject.id}/messages?limit=100`);
      if (res.ok) {
        const resData = await res.json();
        const list = resData.data || resData.messages || [];
        setMessages(list);
        const failed = list.find((m) => m.webhook_status === 'failed');
        setSelectedLog(failed || list[0] || null);
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedProject?.id, apiFetch]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleRetryWebhook = async (msgId) => {
    const res = await apiFetch(`/messages/${msgId}/retry-webhook`, { method: 'POST' });
    if (res.ok) {
      showToast('تم إرسال طلب إعادة المحاولة إلى Webhook المشروع');
      fetchMessages();
    } else {
      showToast('تعذر إعادة إرسال Webhook');
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ['Time', 'Direction', 'Phone', 'Type', 'Content', 'Status', 'Webhook', 'Retries'],
      ...messages.map((m) => [
        m.created_at,
        m.direction,
        m.remote_jid,
        m.message_type,
        (m.content || '').replace(/"/g, '""'),
        m.status,
        m.webhook_status,
        m.webhook_attempts,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wasla-messages-${selectedProject?.id || 'all'}.csv`;
    a.click();
  };

  const filtered = messages.filter((m) => {
    const matchQ =
      !search ||
      m.remote_jid?.includes(search) ||
      m.content?.toLowerCase().includes(search.toLowerCase()) ||
      m.message_id?.toLowerCase().includes(search.toLowerCase());
    const matchDir = direction === 'all' || m.direction === direction;
    const matchType = typeFilter === 'all' || m.message_type === typeFilter;
    const matchStatus =
      statusFilter === 'all' || m.status === statusFilter || m.webhook_status === statusFilter;
    return matchQ && matchDir && matchType && matchStatus;
  });

  const rowsToDisplay = filtered;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[#838398] text-[11px] mb-1">
            المشاريع / {selectedProject?.name || 'متجر سلة'} / سجل الرسائل و Webhooks
          </p>
          <h1 className="text-[#22213d] text-[27px] font-semibold">
            سجل الرسائل وحالة التسليم
          </h1>
          <p className="text-[#838398] text-[13px] mt-1">
            راقب كل رسالة صادرة أو واردة، وأعد إرسال Webhooks الفاشلة بنقرة واحدة.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="bg-white hover:bg-[#f8f7fd] text-[#24233d] font-semibold text-[12px] h-[46px] px-6 rounded-[12px] transition-colors"
        >
          تصدير CSV  ↓
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white min-h-[60px] rounded-[18px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالرقم أو المحتوى أو معرف الرسالة..."
            className="bg-[#f8f7fd] h-[42px] w-full sm:max-w-[320px] rounded-[10px] px-4 text-[12px] text-[#22213d] placeholder-[#838398] outline-none"
          />
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="bg-transparent text-[#838398] text-[12px] outline-none cursor-pointer"
          >
            <option value="all">الاتجاه: الكل ⌄</option>
            <option value="outbound">صادرة</option>
            <option value="inbound">واردة</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent text-[#838398] text-[12px] outline-none cursor-pointer"
          >
            <option value="all">النوع: الكل ⌄</option>
            <option value="text">نص</option>
            <option value="audio">بصمة PTT</option>
            <option value="document">ملف PDF</option>
            <option value="image">صورة</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-[#838398] text-[12px] outline-none cursor-pointer"
          >
            <option value="all">الحالة: الكل ⌄</option>
            <option value="sent">تم التسليم</option>
            <option value="queued">في الطابور</option>
            <option value="failed">فشل</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setDirection('all');
            setTypeFilter('all');
            setStatusFilter('all');
          }}
          className="text-[#7b68ee] font-semibold text-[12px] hover:underline"
        >
          إعادة ضبط
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[18px] p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#24233d] font-semibold text-[16px]">رسائل المشروع</h2>
          <span className="text-[#838398] text-[11px]">
            عرض 1–{rowsToDisplay.length} من {messages.length} رسالة
          </span>
        </div>

        <table className="w-full text-right border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#f8f7fd] text-[#838398] text-[11px] h-[38px]">
              <th className="pr-4 rounded-r-[10px] font-normal">الوقت</th>
              <th className="font-normal">الاتجاه</th>
              <th className="font-normal">الرقم</th>
              <th className="font-normal">النوع</th>
              <th className="font-normal">المحتوى</th>
              <th className="font-normal">الرسالة</th>
              <th className="font-normal">Webhook</th>
              <th className="font-normal">المحاولات</th>
              <th className="pl-4 rounded-l-[10px] font-normal">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f2fa] text-[12px]">
            {rowsToDisplay.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[#838398]">
                  لا توجد رسائل مسجلة بعد لهذا المشروع.
                </td>
              </tr>
            ) : (
              rowsToDisplay.map((m) => {
                const msgBadge = getMessageStatusBadge(m.status);
                const whBadge = getWebhookStatusBadge(m.webhook_status);
                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedLog(m)}
                    className="h-[52px] hover:bg-[#faf9fe] cursor-pointer"
                  >
                    <td className="pr-4 font-inter text-[#55546e]" dir="ltr">
                      {formatTime(m.created_at)}
                    </td>
                    <td className="text-[#24233d] font-semibold">
                      {m.direction === 'outbound' ? 'صادرة ↑' : 'واردة ↓'}
                    </td>
                    <td className="font-inter text-[#55546e]" dir="ltr">
                      {m.remote_jid}
                    </td>
                    <td className="text-[#838398]">{getMessageTypeLabel(m.message_type)}</td>
                    <td className="text-[#24233d] max-w-[260px]">
                      {m.media_url ? (
                        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                          {m.message_type === 'audio' ? (
                            <audio controls preload="none" src={m.media_url} className="h-8 w-[210px] max-w-full" />
                          ) : m.message_type === 'image' ? (
                            <a href={m.media_url} target="_blank" rel="noreferrer" className="text-[#7b68ee] hover:underline text-[11px] font-medium">
                              🖼️ عرض الصورة
                            </a>
                          ) : (
                            <a href={m.media_url} target="_blank" rel="noreferrer" className="text-[#7b68ee] hover:underline text-[11px] font-medium truncate">
                              📎 {m.file_name || 'فتح الملف'}
                            </a>
                          )}
                          {m.content && <span className="truncate text-[11px]">{m.content}</span>}
                        </div>
                      ) : (
                        <span className="block truncate">{m.content || '—'}</span>
                      )}
                    </td>
                    <td>
                      <span className={`text-[9px] font-semibold px-2.5 py-1 rounded-[7px] ${msgBadge.cls}`}>
                        {msgBadge.label}
                      </span>
                    </td>
                    <td>
                      <span className={`font-inter text-[9px] font-semibold px-2.5 py-1 rounded-[7px] ${whBadge.cls}`}>
                        {whBadge.label}
                      </span>
                    </td>
                    <td className="font-inter text-[#838398]" dir="ltr">
                      {m.webhook_attempts ?? 0} / 4
                    </td>
                    <td className="pl-4">
                      {typeof m.id === 'number' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetryWebhook(m.id);
                          }}
                          className="bg-[#efecfc] hover:bg-[#e1dbfa] text-[#7b68ee] font-semibold text-[10px] px-3 py-1 rounded-[7px]"
                        >
                          ↻ إعادة
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Retry Details Bar */}
      <div className="bg-white rounded-[18px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[#24233d] font-semibold text-[15px]">
            تفاصيل إعادة المحاولة
          </h3>
          <p className="text-[#838398] text-[11px] mt-1">
            {selectedLog
              ? `الرسالة للرقم ${selectedLog.remote_jid} • الحالة: ${
                  selectedLog.last_error || selectedLog.webhook_status || 'تم التسليم'
                } • سياسة Exponential Backoff مفعّلة.`
              : 'اختر أي رسالة من الجدول لعرض تفاصيل التسليم وإعادة إرسال الـ Webhook يدوياً.'}
          </p>
        </div>
        {selectedLog && typeof selectedLog.id === 'number' && (
          <button
            type="button"
            onClick={() => handleRetryWebhook(selectedLog.id)}
            className="bg-[#7b68ee] hover:bg-[#6b58dc] text-white font-semibold text-[12px] h-[44px] px-6 rounded-[11px] transition-colors"
          >
            ↻  إعادة إرسال Webhook الآن
          </button>
        )}
      </div>
    </div>
  );
}

