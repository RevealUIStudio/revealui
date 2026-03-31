import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must come before route import
// ---------------------------------------------------------------------------

const mockTransaction = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  update: mockUpdate,
  set: mockSet,
  transaction: mockTransaction,
};

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/core/license', () => ({
  resetLicenseState: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/db/schema', () => ({
  accountEntitlements: {
    accountId: 'accountId',
    status: 'status',
    graceUntil: 'graceUntil',
    updatedAt: 'updatedAt',
  },
  accountSubscriptions: {
    accountId: 'accountId',
    status: 'status',
    stripeCustomerId: 'stripeCustomerId',
    updatedAt: 'updatedAt',
  },
  licenses: { customerId: 'customerId', status: 'status', updatedAt: 'updatedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({ type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  lte: vi.fn((_col, _val) => ({ type: 'lte' })),
}));

import { resetLicenseState } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import sweepApp from '../cron/sweep-grace-periods.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-cron-secret-32chars-padded!!';

function createApp() {
  const app = new Hono();
  app.route('/', sweepApp);
  return app;
}

function makeRequest(secret?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret !== undefined) {
    headers['X-Cron-Secret'] = secret;
  }
  return new Request('http://localhost/sweep-grace-periods', {
    method: 'POST',
    headers,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /sweep-grace-periods — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockWhere.mockResolvedValue([]);
  });

  it('returns 401 when X-Cron-Secret header is absent', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(undefined));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when secret is wrong', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when REVEALUI_CRON_SECRET env var is unset', async () => {
    delete process.env.REVEALUI_CRON_SECRET;
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(401);
  });

  it('returns 401 when secret length differs (timing-safe)', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('short'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when both secret and env are empty strings', async () => {
    process.env.REVEALUI_CRON_SECRET = '';
    const app = createApp();
    const res = await app.request(makeRequest(''));
    expect(res.status).toBe(401);
  });

  it('does not expose the secret in 401 body', async () => {
    const app = createApp();
    const res = await app.request(makeRequest('wrong'));
    const bodyText = await res.text();
    expect(bodyText).not.toContain(VALID_SECRET);
  });

  it('accepts lowercase x-cron-secret header', async () => {
    const app = createApp();
    const req = new Request('http://localhost/sweep-grace-periods', {
      method: 'POST',
      headers: { 'x-cron-secret': VALID_SECRET },
    });
    const res = await app.request(req);
    expect(res.status).not.toBe(401);
  });
});

describe('POST /sweep-grace-periods — no expired entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockWhere.mockResolvedValue([]);
  });

  it('returns 200 with expired:0 when no grace periods found', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(0);
    expect(body.accountIds).toEqual([]);
  });

  it('does not call transaction when no expired grace periods', async () => {
    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does not call resetLicenseState when no expired grace periods', async () => {
    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(resetLicenseState).not.toHaveBeenCalled();
  });
});

describe('POST /sweep-grace-periods — expired entitlements', () => {
  const expiredAccounts = [
    { accountId: 'acc-1', graceUntil: new Date('2025-01-01') },
    { accountId: 'acc-2', graceUntil: new Date('2025-02-01') },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockWhere.mockResolvedValue(expiredAccounts);
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      // First update (entitlements) returns rowCount to satisfy TOCTOU guard
      const txEntitlementWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
      const txOtherWhere = vi.fn().mockResolvedValue([]);
      const txLimit = vi.fn().mockResolvedValue([]);
      let updateCallCount = 0;
      const txSet = vi.fn().mockImplementation(() => ({
        where: ++updateCallCount === 1 ? txEntitlementWhere : txOtherWhere,
      }));
      const txFrom = vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockReturnValue({ limit: txLimit }) });
      const tx = {
        update: vi.fn().mockReturnValue({ set: txSet }),
        select: vi.fn().mockReturnValue({ from: txFrom }),
      };
      await cb(tx);
    });
  });

  it('returns 200 with count and account IDs', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(2);
    expect(body.accountIds).toEqual(['acc-1', 'acc-2']);
  });

  it('calls transaction for each expired account', async () => {
    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('calls resetLicenseState after processing', async () => {
    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(resetLicenseState).toHaveBeenCalledOnce();
  });

  it('logs success with expired count and account IDs', async () => {
    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(logger.info).toHaveBeenCalledWith(
      'Grace period sweep completed',
      expect.objectContaining({
        expired: 2,
        accountIds: ['acc-1', 'acc-2'],
      }),
    );
  });
});

describe('POST /sweep-grace-periods — transaction with stripeCustomerId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockWhere.mockResolvedValue([{ accountId: 'acc-stripe', graceUntil: new Date('2025-01-01') }]);
  });

  it('updates licenses when subscription has stripeCustomerId', async () => {
    let txUpdateCount = 0;
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const txLimit = vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_123' }]);
      const txFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: txLimit }),
      });
      const tx = {
        update: vi.fn(() => {
          txUpdateCount++;
          // First update (entitlements) returns rowCount for TOCTOU guard
          const txWhere = vi.fn().mockResolvedValue(txUpdateCount === 1 ? { rowCount: 1 } : []);
          return { set: vi.fn().mockReturnValue({ where: txWhere }) };
        }),
        select: vi.fn().mockReturnValue({ from: txFrom }),
      };
      await cb(tx);
    });

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(txUpdateCount).toBe(3);
  });

  it('skips license update when no stripeCustomerId', async () => {
    let txUpdateCount = 0;
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const txLimit = vi.fn().mockResolvedValue([{ stripeCustomerId: null }]);
      const txFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: txLimit }),
      });
      const tx = {
        update: vi.fn(() => {
          txUpdateCount++;
          const txWhere = vi.fn().mockResolvedValue(txUpdateCount === 1 ? { rowCount: 1 } : []);
          return { set: vi.fn().mockReturnValue({ where: txWhere }) };
        }),
        select: vi.fn().mockReturnValue({ from: txFrom }),
      };
      await cb(tx);
    });

    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(txUpdateCount).toBe(2);
  });
});

describe('POST /sweep-grace-periods — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
  });

  it('returns 500 when initial query fails', async () => {
    mockWhere.mockRejectedValue(new Error('DB connection refused'));
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
  });

  it('returns sanitized error message (no raw DB errors)', async () => {
    mockWhere.mockRejectedValue(new Error('FATAL: password authentication failed'));
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.error).toBe('Internal error during grace period sweep');
    expect(body.error).not.toContain('FATAL');
  });

  it('returns 500 when transaction fails', async () => {
    mockWhere.mockResolvedValue([{ accountId: 'acc-fail', graceUntil: new Date() }]);
    mockTransaction.mockRejectedValue(new Error('Transaction deadlock'));
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
  });

  it('logs error on failure', async () => {
    mockWhere.mockRejectedValue(new Error('Connection timeout'));
    const app = createApp();
    await app.request(makeRequest(VALID_SECRET));
    expect(logger.error).toHaveBeenCalledWith(
      'Grace period sweep failed',
      undefined,
      expect.objectContaining({ error: 'Connection timeout' }),
    );
  });

  it('handles non-Error thrown values', async () => {
    mockWhere.mockRejectedValue('string error');
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'Grace period sweep failed',
      undefined,
      expect.objectContaining({ error: 'string error' }),
    );
  });
});

describe('POST /sweep-grace-periods — method and content-type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = VALID_SECRET;
    mockWhere.mockResolvedValue([]);
  });

  it('rejects GET requests', async () => {
    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/sweep-grace-periods', {
        method: 'GET',
        headers: { 'X-Cron-Secret': VALID_SECRET },
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 404 for unknown paths', async () => {
    const app = createApp();
    const res = await app.request(
      new Request('http://localhost/unknown', {
        method: 'POST',
        headers: { 'X-Cron-Secret': VALID_SECRET },
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns application/json content-type on success', async () => {
    const app = createApp();
    const res = await app.request(makeRequest(VALID_SECRET));
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });
});
