/**
 * Shared status badge mapping and formatting helpers.
 */

export function getProjectStatusBadge(status) {
  if (status === 'connected') {
    return {
      label: 'متصل',
      shortLabel: 'متصل',
      bg: 'bg-[#eaf7f1]',
      text: 'text-[#208b72]',
      dot: 'bg-[#208b72]',
    };
  }
  if (status === 'qr_ready' || status === 'connecting') {
    return {
      label: 'بانتظار مسح الباركود',
      shortLabel: 'بانتظار المسح',
      bg: 'bg-[#fff6e7]',
      text: 'text-[#a7772e]',
      dot: 'bg-[#a7772e]',
    };
  }
  return {
    label: 'غير متصل',
    shortLabel: 'غير متصل',
    bg: 'bg-[#fceef1]',
    text: 'text-[#c25e76]',
    dot: 'bg-[#c25e76]',
  };
}

export function formatTime(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getMessageTypeLabel(type) {
  const labels = {
    text: 'نص',
    audio: 'بصمة PTT',
    document: 'ملف PDF',
    image: 'صورة',
  };
  return labels[type] || type || 'نص';
}

export function getMessageStatusBadge(status) {
  const map = {
    sent: { label: 'تم التسليم', cls: 'bg-[#eaf7f1] text-[#208b72]' },
    received: { label: 'مستلمة', cls: 'bg-[#eaf7f1] text-[#208b72]' },
    queued: { label: 'في الطابور', cls: 'bg-[#fff6e7] text-[#a7772e]' },
    failed: { label: 'فشل', cls: 'bg-[#fceef1] text-[#c25e76]' },
  };
  return map[status] || { label: status || 'غير معروف', cls: 'bg-[#f4f2fc] text-[#838398]' };
}

export function getWebhookStatusBadge(webhookStatus) {
  if (webhookStatus === 'failed') {
    return { label: '504 فشل', cls: 'bg-[#fceef1] text-[#c25e76]' };
  }
  if (webhookStatus === 'delivered' || webhookStatus === 'sent') {
    return { label: '200 OK', cls: 'bg-[#eaf7f1] text-[#208b72]' };
  }
  return { label: 'قيد الانتظار', cls: 'bg-[#fff6e7] text-[#a7772e]' };
}

