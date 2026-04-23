import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { extractRequestContext } from '../request-context.js';

function extractFromRequest(headers: Record<string, string>) {
  return new Promise<{ userAgent: string | undefined; ipAddress: string | undefined }>(
    (resolve) => {
      const app = new Hono();
      app.get('/ctx', (c) => {
        resolve(extractRequestContext(c));
        return c.text('ok');
      });
      void app.request('/ctx', { headers });
    },
  );
}

describe('extractRequestContext', () => {
  it('reads user-agent header', async () => {
    const ctx = await extractFromRequest({ 'user-agent': 'Mozilla/5.0 (test)' });
    expect(ctx.userAgent).toBe('Mozilla/5.0 (test)');
  });

  it('returns undefined userAgent when header missing', async () => {
    const ctx = await extractFromRequest({});
    expect(ctx.userAgent).toBeUndefined();
  });

  it('reads the first IP from x-forwarded-for', async () => {
    const ctx = await extractFromRequest({
      'x-forwarded-for': '203.0.113.1, 198.51.100.5, 192.0.2.10',
    });
    expect(ctx.ipAddress).toBe('203.0.113.1');
  });

  it('trims whitespace from x-forwarded-for entries', async () => {
    const ctx = await extractFromRequest({ 'x-forwarded-for': '   203.0.113.1  , 198.51.100.5' });
    expect(ctx.ipAddress).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const ctx = await extractFromRequest({ 'x-real-ip': '203.0.113.9' });
    expect(ctx.ipAddress).toBe('203.0.113.9');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', async () => {
    const ctx = await extractFromRequest({
      'x-forwarded-for': '203.0.113.1',
      'x-real-ip': '198.51.100.5',
    });
    expect(ctx.ipAddress).toBe('203.0.113.1');
  });

  it('returns undefined ipAddress when neither header is set', async () => {
    const ctx = await extractFromRequest({});
    expect(ctx.ipAddress).toBeUndefined();
  });
});
