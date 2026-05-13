export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === 'revealui-csrf') return val || null;
  }
  return null;
}

const CSRF_UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function apiFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const urlStr = typeof url === 'string' ? url : url.toString();
  const needsCsrf = CSRF_UNSAFE.has(method) && urlStr.startsWith('/api/');
  if (!needsCsrf) return fetch(url, init);
  const token = getCsrfToken();
  if (!token) return fetch(url, init);
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      'X-CSRF-Token': token,
    },
  });
}
