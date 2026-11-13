const API_BASE = '/api/v1';

/**
 * Centralized HTTP client for the Wasla Go backend API.
 */
export async function apiRequest(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem('wasla_token');
  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && typeof onUnauthorized === 'function') {
    onUnauthorized();
  }

  return res;
}

export async function sendGatewayMessage({ apiKey, type, to, idempotencyKey, text, mediaUrl, caption, filename, file }) {
  const endpointMap = {
    text: '/send/text',
    image: '/send/image',
    document: '/send/document',
    audio: '/send/audio',
  };

  const cleanTo = to.replace(/\s+/g, '');
  const headers = {
    'X-API-Key': apiKey,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };

  let body;
  if (type === 'text') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ to: cleanTo, message: text });
  } else if (file) {
    const fd = new FormData();
    fd.append('to', cleanTo);
    fd.append('caption', caption);
    fd.append('filename', file.name || filename);
    fd.append('file', file);
    body = fd;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      to: cleanTo,
      media_url: mediaUrl,
      caption,
      filename,
    });
  }

  return fetch(`${API_BASE}${endpointMap[type]}`, {
    method: 'POST',
    headers,
    body,
  });
}

