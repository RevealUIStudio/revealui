import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const state = { plainTextPath: '', jsonErrorPath: '' };

  function stubApp() {
    return {
      fetch: async (req: Request) => {
        const path = new URL(req.url).pathname;
        if (state.plainTextPath && path === state.plainTextPath) {
          return new Response('404 Not Found', {
            status: 404,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
        }
        if (state.jsonErrorPath && path === state.jsonErrorPath) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return Response.json({ ok: true });
      },
    };
  }

  return {
    state,
    stubApp,
    checkHealth: vi.fn(),
    auditLog: vi.fn(async () => undefined),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: hoisted.logger,
}));

vi.mock('@revealui/core/observability', () => ({
  healthCheck: { checkHealth: hoisted.checkHealth },
}));

vi.mock('@revealui/core/security', () => ({
  audit: { log: hoisted.auditLog },
  AuditWriteError: class AuditWriteError extends Error {},
  classifyAuditWriteFailure: () => 'unknown',
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
vi.mock('./revmarket-payouts.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./publish-scheduled.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-customers.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-entitlements.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-stripe-subscriptions.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./reconcile-subscriptions.js', () => ({ default: hoisted.stubApp() }));
vi.mock('./sweep-grace-periods.js', () => ({ default: hoisted.stubApp() }));

import dispatchApp from './dispatch.js';
import uptimeCheckApp from './uptime-check.js';

const REVEALUI_CRON_SECRET = 'test-revealui-cron-secret-value!';
const CRON_SECRET = 'test-vercel-cron-secret-value!!!';

interface JobResultBody {
  error?: string;
  status?: string;
}

interface DispatchBody {
  status: string;
  failed: number;
  results: Array<{ name: string; status: number; body: JobResultBody }>;
}

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
  delete process.env.REVEALUI_CRON_SECRET_PREVIOUS;
  delete process.env.CRON_SECRET;
  delete process.env.CRON_SECRET_PREVIOUS;
}

async function invokeDispatch(): Promise<DispatchBody> {
  const res = await dispatchApp.fetch(
    new Request('http://localhost/dispatch', {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    }),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type') ?? '').toContain('application/json');
  return (await res.json()) as DispatchBody;
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.state.plainTextPath = '';
  hoisted.state.jsonErrorPath = '';
  hoisted.checkHealth.mockResolvedValue({
    status: 'healthy',
    checks: {},
    timestamp: '2026-09-25T00:00:00.000Z',
    uptime: 10,
  });
  hoisted.auditLog.mockResolvedValue(undefined);
  setEnv();
});

afterEach(() => {
  clearEnv();
});

describe('dispatch fan-out to real uptime-check', () => {
  it('parses a JSON body from POST /uptime-check with X-Cron-Secret', async () => {
    const body = await invokeDispatch();
    const uptime = body.results.find((job) => job.name === 'uptime-check');

    expect(uptime).toBeDefined();
    expect(uptime?.status).toBe(200);
    expect(uptime?.body.status).toBe('healthy');
    expect(uptime?.body.error ?? '').not.toContain('Unexpected non-whitespace');
    expect(body.failed).toBe(0);
    expect(body.status).toBe('ok');
  });

  it('reports a non-JSON sub-job body without a JSON.parse throw', async () => {
    hoisted.state.plainTextPath = '/cleanup';

    const body = await invokeDispatch();
    const cleanup = body.results.find((job) => job.name === 'cleanup');

    expect(cleanup).toBeDefined();
    expect(cleanup?.status).toBe(500);
    expect(cleanup?.body.error ?? '').toContain('expected application/json');
    expect(cleanup?.body.error ?? '').toContain('404');
    expect(cleanup?.body.error ?? '').toContain('404 Not Found');
    expect(cleanup?.body.error ?? '').not.toContain('Unexpected non-whitespace');
  });

  it('keeps a JSON error status instead of treating it as a parse failure', async () => {
    hoisted.state.jsonErrorPath = '/cleanup';

    const body = await invokeDispatch();
    const cleanup = body.results.find((job) => job.name === 'cleanup');

    expect(cleanup?.status).toBe(401);
    expect(cleanup?.body.error).toBe('Unauthorized');
  });
});

describe('uptime-check route auth and method', () => {
  it('accepts POST /uptime-check with X-Cron-Secret and returns JSON', async () => {
    const res = await uptimeCheckApp.fetch(
      new Request('http://localhost/uptime-check', {
        method: 'POST',
        headers: { 'X-Cron-Secret': REVEALUI_CRON_SECRET },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('application/json');
    const payload = (await res.json()) as { status: string };
    expect(payload.status).toBe('healthy');
  });

  it('accepts GET /uptime-check with the Vercel bearer', async () => {
    const res = await uptimeCheckApp.fetch(
      new Request('http://localhost/uptime-check', {
        method: 'GET',
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      }),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { status: string };
    expect(payload.status).toBe('healthy');
  });

  it('returns JSON 401 when a configured secret does not match', async () => {
    const res = await uptimeCheckApp.fetch(
      new Request('http://localhost/uptime-check', {
        method: 'POST',
        headers: { 'X-Cron-Secret': 'wrong-secret-not-the-configured-one' },
      }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type') ?? '').toContain('application/json');
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toBe('Unauthorized');
  });

  it('returns JSON 401 when only the dispatch secret is set and the header is missing', async () => {
    setEnv({ CRON_SECRET: undefined, CRON_SECRET_PREVIOUS: undefined });

    const res = await uptimeCheckApp.fetch(
      new Request('http://localhost/uptime-check', { method: 'POST' }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type') ?? '').toContain('application/json');
  });

  it('stays open when no cron secret is configured', async () => {
    setEnv({
      REVEALUI_CRON_SECRET: undefined,
      REVEALUI_CRON_SECRET_PREVIOUS: undefined,
      CRON_SECRET: undefined,
      CRON_SECRET_PREVIOUS: undefined,
    });

    const res = await uptimeCheckApp.fetch(
      new Request('http://localhost/uptime-check', { method: 'POST' }),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { status: string };
    expect(payload.status).toBe('healthy');
  });
});
