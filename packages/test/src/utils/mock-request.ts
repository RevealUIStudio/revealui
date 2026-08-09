/**
 * Minimal Next.js-like request mock for route unit tests.
 * Install-graph home: prefer this over packages/core/src/__tests__ paths.
 */

export function createMockRequest(
  overrides: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    ip?: string;
  } = {},
): {
  url: string;
  method: string;
  headers: Headers;
  nextUrl: { pathname: string; searchParams: URLSearchParams; href: string };
  ip: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  formData: () => Promise<FormData>;
} {
  const {
    url = 'http://localhost:3000/api/test',
    method = 'GET',
    headers = {},
    body = null,
    ip = '127.0.0.1',
  } = overrides;

  const urlObj = new URL(url);
  const headerMap = new Headers(headers);

  return {
    url,
    method,
    headers: headerMap,
    nextUrl: {
      pathname: urlObj.pathname,
      searchParams: urlObj.searchParams,
      href: url,
    },
    ip,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    formData: async () => new FormData(),
  };
}
