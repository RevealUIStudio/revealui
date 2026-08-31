import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const forwarded: Array<{ url: string; method: string; cronSecret: string | null }> = [];

  function stubApp() {
    return {
      fetch: async (req: Request) => {
        forwarded.push({
          url: req.url,
          method: req.method,
          cronSecret: req.headers.get('X-Cron-Secret'),
        });
        return Response.json({ ok: true });
      },
    };
  }

  return {
    forwarded,
    stubApp,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: hoisted.logger,
}));

vi.mock('../billing.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./billing-readiness.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./cleanup.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./admission-paid-pending-expire.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./admission-waitlist-drain.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./cogs-breaker.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./drain-unreconciled.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./jobs-safety-net.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./lifecycle-emails.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./margin-snapshot.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./marketplace-payouts.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./publish-scheduled.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-customers.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-entitlements.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-stripe-subscriptions.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-subscriptions.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./sweep-grace-periods.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./uptime-check.js', () => ({ default: hoisted.stubApp() }));

import dispatchApp from './dispatch.js';

const REVEALUI_CRON_SECRET = 'test-revealui-cron-secret-value!';
const CRON_SECRET = 'test-vercel-cron-secret-value!!!';

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  process.env.REVEALUI_CRON_SECRET = REVEALUI_CRON_SECRET;
  process.env.CRON_SECRET = CRON_SECRET;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv(): void {
  delete process.env.REVEALUI_CRON_SECRET;
  delete process.env.CRON_SECRET;
}

async function invokeDispatch(opts: {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
}): Promise<Response> {
  return dispatchApp.fetch(
    new Request('http://localhost/dispatch', {
      method: opts.method,
      headers: opts.headers,
    }),
  );
}

beforeEach(() => {
  hoisted.forwarded.length = 0;
  vi.clearAllMocks();
  setEnv();
});

afterEach(() => {
  clearEnv();
});

describe('GET /dispatch (Vercel platform cron)', () => {
  it('returns 401 when Authorization is missing', async () => {
    const res = await invokeDispatch({ method: 'GET' });
    expect(res.status).toBe(401);
    expect(hoisted.forwarded).toHaveLength(0);
  });

  it('returns 200 for Authorization Bearer CRON_SECRET', async () => {
    const res = await invokeDispatch({
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('forwards REVEALUI_CRON_SECRET to sub-jobs, not the Vercel Bearer token', async () => {
    const res = await invokeDispatch({
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    expect(hoisted.forwarded.length).toBeGreaterThan(0);
    expect(hoisted.forwarded.every((job) => job.cronSecret === REVEALUI_CRON_SECRET)).toBe(true);
    expect(hoisted.forwarded.some((job) => job.cronSecret === CRON_SECRET)).toBe(false);
  });

  it('fans out GAP-256 drain and paid-pending expire jobs', async () => {
    const res = await invokeDispatch({
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const urls = hoisted.forwarded.map((job) => job.url);
    expect(urls.some((u) => u.endsWith('/admission-waitlist-drain'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/admission-paid-pending-expire'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/margin-snapshot'))).toBe(true);
  });
});

describe('POST /dispatch (manual / WSL path)', () => {
  it('returns 200 for X-Cron-Secret matching REVEALUI_CRON_SECRET', async () => {
    const res = await invokeDispatch({
      method: 'POST',
      headers: { 'X-Cron-Secret': REVEALUI_CRON_SECRET },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('still accepts lowercase x-cron-secret', async () => {
    const res = await invokeDispatch({
      method: 'POST',
      headers: { 'x-cron-secret': REVEALUI_CRON_SECRET },
    });
    expect(res.status).toBe(200);
  });
});

describe('dispatch auth fail-closed', () => {
  it('returns 401 when the secret is wrong', async () => {
    const res = await invokeDispatch({
      method: 'POST',
      headers: { 'X-Cron-Secret': 'wrong-secret-not-the-configured-one' },
    });
    expect(res.status).toBe(401);
    expect(hoisted.forwarded).toHaveLength(0);
  });

  it('returns 401 for Bearer with the wrong token', async () => {
    const res = await invokeDispatch({
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-secret-not-the-configured-one' },
    });
    expect(res.status).toBe(401);
    expect(hoisted.forwarded).toHaveLength(0);
  });

  it('returns 401 when both secrets are unset', async () => {
    setEnv({ REVEALUI_CRON_SECRET: undefined, CRON_SECRET: undefined });
    const res = await invokeDispatch({
      method: 'POST',
      headers: { 'X-Cron-Secret': REVEALUI_CRON_SECRET },
    });
    expect(res.status).toBe(401);
    expect(hoisted.forwarded).toHaveLength(0);
  });
});
