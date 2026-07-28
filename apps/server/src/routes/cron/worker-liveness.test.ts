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

import app, { classifyProbeError } from './worker-liveness.js';

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

  // GAP-455: a guard rejection must NOT report as 'network-error'. That
  // collapse is what made the first live false alarm undiagnosable.
  it('reports a guard rejection distinctly from a network fault', async () => {
    process.env.REVEALUI_WORKER_HEALTH_URL = 'https://worker.example.internal/health';
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('SSRF: worker.example.internal did not resolve to any public IP address'),
      );

    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('dns-unresolved');
    expect(body.error).not.toBe('network-error');

    // The hostname is in the thrown message; it must not survive into the
    // response body or the alert.
    expect(JSON.stringify(body)).not.toContain('worker.example.internal');
    const call = hoisted.sendCronFailureAlert.mock.calls[0]?.[0];
    expect(call.error.message).not.toContain('worker.example.internal');
    expect(call.metadata.reason).toBe('dns-unresolved');
  });

  it('surfaces a safe error code on a network fault', async () => {
    process.env.REVEALUI_WORKER_HEALTH_URL = 'https://worker.example.internal/health';
    const wrapped = new TypeError('fetch failed');
    (wrapped as NodeJS.ErrnoException).cause = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    globalThis.fetch = vi.fn().mockRejectedValueOnce(wrapped);

    const res = await request({ 'X-Cron-Secret': CRON_SECRET });
    const body = await res.json();
    expect(body.error).toBe('network-error');
    expect(body.code).toBe('ECONNREFUSED');
  });
});

describe('classifyProbeError', () => {
  it('maps a timeout', () => {
    expect(classifyProbeError(new DOMException('aborted', 'TimeoutError'))).toBe('timeout');
    expect(classifyProbeError(new DOMException('aborted', 'AbortError'))).toBe('timeout');
  });

  it('finds the reason through a cause chain', () => {
    // undici wraps a dispatcher-lookup rejection, so the guard's message sits
    // one or more levels below the error fetch actually throws.
    const root = new Error('SSRF: host.example resolved to private IP(s): 10.0.0.1');
    const mid = new Error('other side closed', { cause: root });
    const top = new TypeError('fetch failed', { cause: mid });
    expect(classifyProbeError(top)).toBe('blocked-private-ip');
  });

  it('falls back to blocked-by-guard for an unrecognized guard message', () => {
    expect(classifyProbeError(new Error('SSRF: some future rejection'))).toBe('blocked-by-guard');
  });

  it('reports a plain fault as network-error', () => {
    expect(classifyProbeError(new TypeError('fetch failed'))).toBe('network-error');
    expect(classifyProbeError('not an error')).toBe('network-error');
  });

  it('terminates on a self-referential cause chain', () => {
    const err = new Error('boom') as Error & { cause?: unknown };
    err.cause = err;
    expect(classifyProbeError(err)).toBe('network-error');
  });
});

// These drive the REAL SSRF guard rather than a stub. They are the reason the
// message-fragment coupling in GUARD_MESSAGE_TOKENS is safe: if the guard
// rewords a rejection, this block fails loudly instead of the classifier
// quietly degrading every guard rejection back to 'network-error'.
describe('classifyProbeError against the real SSRF guard', () => {
  it('classifies a private-IP target as blocked-private-ip', async () => {
    const { createSafeFetch: realSafeFetch } = await vi.importActual<
      typeof import('@revealui/security/server')
    >('@revealui/security/server');

    await expect(realSafeFetch()('http://127.0.0.1/health')).rejects.toSatisfy(
      (err: unknown) => classifyProbeError(err) === 'blocked-private-ip',
    );
  });

  it('classifies a disallowed protocol as invalid-target', async () => {
    const { createSafeFetch: realSafeFetch } = await vi.importActual<
      typeof import('@revealui/security/server')
    >('@revealui/security/server');

    await expect(realSafeFetch()('ftp://example.com/health')).rejects.toSatisfy(
      (err: unknown) => classifyProbeError(err) === 'invalid-target',
    );
  });

  it('classifies an unresolvable host as dns-unresolved', async () => {
    const { createSafeFetch: realSafeFetch } = await vi.importActual<
      typeof import('@revealui/security/server')
    >('@revealui/security/server');

    // .invalid is reserved by RFC 2606 and is guaranteed never to resolve, so
    // this does not depend on the runner's DNS answering for a made-up name.
    await expect(realSafeFetch()('https://worker.invalid/health')).rejects.toSatisfy(
      (err: unknown) => classifyProbeError(err) === 'dns-unresolved',
    );
  });
});
