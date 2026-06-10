// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, getCsrfToken, isCsrfTarget } from '../../lib/utils/csrf';

const TOKEN = 'aabbccdd:eeff0011';
const DEFAULT_API_ORIGIN = 'https://api.revealui.com';

function setCsrfCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API; direct assignment is the only way to seed cookies in tests
  document.cookie = `revealui-csrf=${value}`;
}

function clearCsrfCookie(): void {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API; direct assignment is the only way to clear cookies in tests
  document.cookie = 'revealui-csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

describe('getCsrfToken', () => {
  afterEach(() => {
    clearCsrfCookie();
  });

  it('reads the revealui-csrf cookie', () => {
    setCsrfCookie(TOKEN);
    expect(getCsrfToken()).toBe(TOKEN);
  });

  it('returns null when the cookie is absent', () => {
    expect(getCsrfToken()).toBeNull();
  });
});

describe('isCsrfTarget', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches relative admin /api/ paths', () => {
    expect(isCsrfTarget('/api/chat')).toBe(true);
    expect(isCsrfTarget('/api/mcp/servers')).toBe(true);
  });

  it('does not match relative non-/api/ paths', () => {
    expect(isCsrfTarget('/account/billing')).toBe(false);
  });

  it('matches absolute URLs on the default api origin', () => {
    expect(isCsrfTarget(`${DEFAULT_API_ORIGIN}/api/billing/checkout`)).toBe(true);
  });

  it('matches absolute URLs on a configured NEXT_PUBLIC_API_URL origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3004');
    expect(isCsrfTarget('http://localhost:3004/api/billing/checkout')).toBe(true);
    // The default prod origin is no longer the configured one.
    expect(isCsrfTarget(`${DEFAULT_API_ORIGIN}/api/billing/checkout`)).toBe(false);
  });

  it('matches absolute URLs on the page origin', () => {
    expect(isCsrfTarget(`${window.location.origin}/api/collections/posts`)).toBe(true);
  });

  it('does not match foreign origins, even on /api/ paths', () => {
    expect(isCsrfTarget('https://evil.example/api/billing/checkout')).toBe(false);
  });

  it('does not match non-/api/ paths on the api origin', () => {
    expect(isCsrfTarget(`${DEFAULT_API_ORIGIN}/health`)).toBe(false);
  });

  it('rejects unparseable URLs', () => {
    expect(isCsrfTarget('http://[bad')).toBe(false);
  });
});

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    clearCsrfCookie();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function sentHeaders(): Record<string, string> {
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    return (init?.headers ?? {}) as Record<string, string>;
  }

  it('attaches X-CSRF-Token on POST to a relative /api/ path', async () => {
    setCsrfCookie(TOKEN);
    await apiFetch('/api/chat', { method: 'POST' });
    expect(sentHeaders()['X-CSRF-Token']).toBe(TOKEN);
  });

  it('attaches X-CSRF-Token on POST to the api origin (absolute URL)', async () => {
    setCsrfCookie(TOKEN);
    await apiFetch(`${DEFAULT_API_ORIGIN}/api/billing/checkout`, {
      method: 'POST',
      credentials: 'include',
    });
    expect(sentHeaders()['X-CSRF-Token']).toBe(TOKEN);
  });

  it('attaches X-CSRF-Token on DELETE to the api origin', async () => {
    setCsrfCookie(TOKEN);
    await apiFetch(`${DEFAULT_API_ORIGIN}/api/content/media/abc`, {
      method: 'DELETE',
      credentials: 'include',
    });
    expect(sentHeaders()['X-CSRF-Token']).toBe(TOKEN);
  });

  it('preserves caller headers and init options when attaching', async () => {
    setCsrfCookie(TOKEN);
    await apiFetch(`${DEFAULT_API_ORIGIN}/api/billing/checkout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{"tier":"pro"}',
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(sentHeaders()['Content-Type']).toBe('application/json');
    expect(sentHeaders()['X-CSRF-Token']).toBe(TOKEN);
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"tier":"pro"}');
  });

  it('does not attach on GET', async () => {
    setCsrfCookie(TOKEN);
    await apiFetch(`${DEFAULT_API_ORIGIN}/api/billing/subscription`, {
      credentials: 'include',
    });
    expect(sentHeaders()['X-CSRF-Token']).toBeUndefined();
  });

  it('does not attach on POST to a foreign origin', async () => {
    setCsrfCookie(TOKEN);
    await apiFetch('https://evil.example/api/billing/checkout', { method: 'POST' });
    expect(sentHeaders()['X-CSRF-Token']).toBeUndefined();
  });

  it('falls through to plain fetch when no token cookie exists', async () => {
    await apiFetch(`${DEFAULT_API_ORIGIN}/api/billing/checkout`, { method: 'POST' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentHeaders()['X-CSRF-Token']).toBeUndefined();
  });
});
