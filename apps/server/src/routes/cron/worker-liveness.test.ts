/**
 * Tests for the Fly worker liveness probe (GAP-443).
 *
 * Covers:
 *   - auth: missing / wrong cron secret → 401
 *   - REVEALUI_WORKER_HEALTH_URL unset → skipped, no alert
 *   - healthy (200 from worker) → no alert
 *   - non-200 from worker → alert fired
 *   - timeout → alert fired
 *   - network error → alert fired
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Use vi.hoisted so the vi.mock factory below can reference the mock  -
// top-level consts are not visible inside a hoisted vi.mock factory.
const hoisted = vi.hoisted(() => ({
  sendCronFailureAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/cron-alerts.js', () => ({
  sendCronFailureAlert: (...args: unknown[]) => hoisted.sendCronFailureAlert(...args),
}));

// safeFetch delegates to globalThis.fetch at call time so per-test fetch
// stubs drive it directly. The real SSRF guard is covered by ssrf.test.ts
// (same mocking approach as routes/__tests__/marketplace.test.ts).
vi.mock('@revealui/security/server', async () => {
  const actual = await vi.importActual<typeof import('@revealui/security/server')>(
    '@revealui/security/server',
  );
  return {
    ...actual,
    createSafeFetch: vi.fn(
      () =>
        (...args: Parameters<typeof fetch>) =>
          globalThis.fetch(...args),
    ),
  };
});

import app from './worker-liveness.js';

const CRON_SECRET = 'test-cron-secret-long-enough-32chars!';

function request(headers?: Record<string, string>) {
  return app.request('/worker-liveness', {
    method: 'GET',
    headers,
  });
}

describe('Worker Liveness Cron', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
    delete process.env.REVEALUI_WORKER_HEALTH_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns 401 without cron secret', async () => {
    const res = await request();
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong cron secret', async () => {
    const res = await request({ 'X-Cron-Secret': 'wrong-secret-that-is-32-chars!!' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when REVEALUI_CRON_SECRET is unset', async () => {
    delete process.env.REVEALUI_CRON_SECRET;
    const res = await request({ 'X-Cron-Secret': 'anything' });
    expect(res.status).toBe(401);
  });

  it('skips the probe with no alert when REVEALUI_WORKER_HEALTH_URL is unset', async () => {
    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(hoisted.sendCronFailureAlert).not.toHaveBeenCalled();
  });

  it('reports healthy with no alert on a 200 response', async () => {
    process.env.REVEALUI_WORKER_HEALTH_URL = 'https://worker.example.internal/health';
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.healthy).toBe(true);
    expect(body.status).toBe(200);
    expect(hoisted.sendCronFailureAlert).not.toHaveBeenCalled();
  });

  it('fires an alert and returns 503 on a non-200 response', async () => {
    process.env.REVEALUI_WORKER_HEALTH_URL = 'https://worker.example.internal/health';
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response('bad', { status: 503 }));

    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.healthy).toBe(false);
    expect(body.status).toBe(503);
    expect(hoisted.sendCronFailureAlert).toHaveBeenCalledTimes(1);
    const call = hoisted.sendCronFailureAlert.mock.calls[0]?.[0];
    expect(call.jobName).toBe('worker-liveness');
    expect(call.error.message).not.toContain('worker.example.internal');
  });

  it('fires an alert and returns 503 on timeout', async () => {
    process.env.REVEALUI_WORKER_HEALTH_URL = 'https://worker.example.internal/health';
    globalThis.fetch = vi.fn().mockImplementationOnce(() => {
      const err = new DOMException('The operation was aborted', 'TimeoutError');
      return Promise.reject(err);
    });

    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.healthy).toBe(false);
    expect(body.error).toBe('timeout');
    expect(hoisted.sendCronFailureAlert).toHaveBeenCalledTimes(1);
    const call = hoisted.sendCronFailureAlert.mock.calls[0]?.[0];
    expect(call.error.message).not.toContain('worker.example.internal');
  });

  it('fires an alert and returns 503 on a network error', async () => {
    process.env.REVEALUI_WORKER_HEALTH_URL = 'https://worker.example.internal/health';
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed'));

    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.healthy).toBe(false);
    expect(body.error).toBe('network-error');
    expect(hoisted.sendCronFailureAlert).toHaveBeenCalledTimes(1);
    const call = hoisted.sendCronFailureAlert.mock.calls[0]?.[0];
    expect(call.error.message).not.toContain('worker.example.internal');
  });
});
