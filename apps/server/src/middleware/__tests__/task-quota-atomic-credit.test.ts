/**
 * C-1 — Credit-balance decrement is atomic (P0 fix)
 *
 * The fix replaces a non-atomic SELECT … WHERE balance > 0 + UPDATE pattern
 * with a single atomic UPDATE … WHERE balance >= 1 RETURNING. This prevents
 * concurrent requests from both observing a positive balance and both
 * decrementing (enabling free tasks under load).
 *
 * Verification strategy: mock the DB so that the UPDATE returning a row
 * signals "credit consumed" and returning an empty array signals "out of
 * credit". Confirm the middleware gates correctly on both outcomes.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  agentTaskUsage: {
    userId: 'user_id',
    cycleStart: 'cycle_start',
    count: 'count',
    overage: 'overage',
  },
  agentCreditBalance: {
    userId: 'agentCreditBalance.userId',
    balance: 'agentCreditBalance.balance',
    updatedAt: 'agentCreditBalance.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  gt: vi.fn((col: unknown, val: unknown) => ({ col, val, op: 'gt' })),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => args),
    { join: vi.fn() },
  ),
}));

vi.mock('@revealui/core/license', () => ({
  normalizePem: (raw: string) => raw.split('\\n').join('\n'),
  readPemEnv: (name: string) => process.env[name],
  coversRenewalBound: vi.fn(() => false),
  getMaxAgentTasks: vi.fn(() => 1),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../x402.js', () => ({
  getX402Config: vi.fn(() => ({
    enabled: false,
    receivingAddress: '',
    network: 'evm:base',
    pricePerTask: '0.001',
    usdcAsset: '0x',
    facilitatorUrl: 'https://x402.org/facilitator',
    maxTimeoutSeconds: 300,
  })),
  buildPaymentRequired: vi.fn(() => ({ x402Version: 1, accepts: [] })),
  encodePaymentRequired: vi.fn(() => 'encoded'),
  verifyPayment: vi.fn(() => Promise.resolve({ valid: true })),
  getAdvertisedCurrencyLabel: vi.fn(() => 'usdc-only'),
  trackX402PaymentRequired: vi.fn(),
}));

import { requireTaskQuota } from '../task-quota.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_USER = { id: 'user-credit-test', email: 'c@test.com', role: 'admin', name: 'C' };

function createApp() {
  const app = new Hono<{ Variables: { user: typeof TEST_USER } }>();
  app.use('*', (c, next) => {
    c.set('user', TEST_USER);
    return next();
  });
  app.use('*', requireTaskQuota);
  app.get('/test', (c) => c.text('ok'));
  return app;
}

// Sets up the SELECT chain for usage count: returns `count` as the current
// agent task usage (so the middleware sees "quota reached" when count >= 1).
function setupUsageCount(count: number) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(count > 0 ? [{ count }] : []),
  };
  mockSelect.mockReturnValue(selectChain);
  return selectChain;
}

// Sets up the UPDATE chain for atomic credit decrement.
// `rows` is what .returning() resolves to: non-empty = credit consumed, [] = out of credit.
function setupAtomicDecrement(rows: unknown[]) {
  const returningChain = { returning: vi.fn().mockResolvedValue(rows) };
  const whereChain = { where: vi.fn().mockReturnValue(returningChain) };
  const setChain = { set: vi.fn().mockReturnValue(whereChain) };
  mockUpdate.mockReturnValue(setChain);

  const insertChain = {
    values: mockValues.mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate.mockReturnValue({
        catch: vi.fn(),
      }),
    }),
  };
  mockInsert.mockReturnValue(insertChain);

  return { setChain, whereChain, returningChain };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('task-quota — atomic credit decrement (C-1 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request through when atomic UPDATE returns a row (credit successfully consumed)', async () => {
    setupUsageCount(1);
    setupAtomicDecrement([{ balance: 4 }]);

    const app = createApp();
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('blocks request (429) when atomic UPDATE returns empty array (balance was 0)', async () => {
    setupUsageCount(1);
    setupAtomicDecrement([]);

    const app = createApp();
    const res = await app.request('/test');
    expect(res.status).toBe(429);
  });

  it('calls UPDATE with the user ID in the WHERE clause', async () => {
    setupUsageCount(1);
    const { whereChain } = setupAtomicDecrement([{ balance: 9 }]);

    const app = createApp();
    await app.request('/test');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(whereChain.where).toHaveBeenCalledTimes(1);
    const whereArg = whereChain.where.mock.calls[0][0];
    expect(JSON.stringify(whereArg)).toContain(TEST_USER.id);
  });

  it('calls .returning() (not a separate SELECT) to check if balance was positive', async () => {
    setupUsageCount(1);
    const { returningChain } = setupAtomicDecrement([{ balance: 2 }]);

    const app = createApp();
    await app.request('/test');

    expect(returningChain.returning).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('blocks on atomic UPDATE error (503) rather than allowing free task', async () => {
    setupUsageCount(1);

    const returningChain = { returning: vi.fn().mockRejectedValue(new Error('DB timeout')) };
    const whereChain = { where: vi.fn().mockReturnValue(returningChain) };
    const setChain = { set: vi.fn().mockReturnValue(whereChain) };
    mockUpdate.mockReturnValue(setChain);

    const app = createApp();
    const res = await app.request('/test');
    expect(res.status).toBe(503);
  });
});
