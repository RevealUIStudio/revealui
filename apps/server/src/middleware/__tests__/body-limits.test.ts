import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { bodyLimitGate, isMediaUploadRequest } from '../body-limits.js';

function makeApp(): Hono {
  const app = new Hono();
  app.use('*', bodyLimitGate());
  app.post('/api/content/media', (c) => c.json({ ok: true }));
  app.post('/api/v1/content/media', (c) => c.json({ ok: true }));
  app.patch('/api/content/media/:id', (c) => c.json({ ok: true }));
  app.post('/api/other', (c) => c.json({ ok: true }));
  return app;
}

function withBody(mb: number): RequestInit {
  const data = new Uint8Array(Math.round(mb * 1024 * 1024));
  return { body: data, headers: { 'content-length': String(data.length) } };
}

describe('isMediaUploadRequest', () => {
  it('matches POST to the media upload paths only', () => {
    expect(isMediaUploadRequest('POST', '/api/content/media')).toBe(true);
    expect(isMediaUploadRequest('POST', '/api/v1/content/media')).toBe(true);
    expect(isMediaUploadRequest('POST', '/api/content/media/')).toBe(true); // trailing slash tolerated
  });

  it('does not match metadata methods, sub-paths, or other routes', () => {
    expect(isMediaUploadRequest('PATCH', '/api/content/media/abc')).toBe(false);
    expect(isMediaUploadRequest('DELETE', '/api/content/media/abc')).toBe(false);
    expect(isMediaUploadRequest('GET', '/api/content/media')).toBe(false);
    expect(isMediaUploadRequest('POST', '/api/other')).toBe(false);
  });

  it('does not match presign/confirm JSON paths (GAP-215 direct-to-R2)', () => {
    expect(isMediaUploadRequest('POST', '/api/content/media/presign')).toBe(false);
    expect(isMediaUploadRequest('POST', '/api/content/media/confirm')).toBe(false);
    expect(isMediaUploadRequest('POST', '/api/v1/content/media/presign')).toBe(false);
  });
});

describe('bodyLimitGate', () => {
  it('allows a media upload up to 10MB (regression: the prior global 1MB rejected all media uploads)', async () => {
    const res = await makeApp().request('/api/content/media', { method: 'POST', ...withBody(5) });
    expect(res.status).toBe(200);
  });

  it('allows the 10MB media path on v1 too', async () => {
    const res = await makeApp().request('/api/v1/content/media', {
      method: 'POST',
      ...withBody(5),
    });
    expect(res.status).toBe(200);
  });

  it('rejects a media upload over 10MB with 413', async () => {
    const res = await makeApp().request('/api/content/media', { method: 'POST', ...withBody(11) });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('10MB');
  });

  it('caps media metadata methods (PATCH) at 1MB', async () => {
    const res = await makeApp().request('/api/content/media/abc', {
      method: 'PATCH',
      ...withBody(5),
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('1MB');
  });

  it('caps non-media routes at 1MB', async () => {
    const res = await makeApp().request('/api/other', { method: 'POST', ...withBody(5) });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('1MB');
  });

  it('caps presign/confirm JSON bodies at 1MB (file bytes never hit the function)', async () => {
    const app = makeApp();
    app.post('/api/content/media/presign', (c) => c.json({ ok: true }));
    const res = await app.request('/api/content/media/presign', {
      method: 'POST',
      ...withBody(5),
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('1MB');
  });
});
