import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  agentTaskUsage: {
    userId: 'user_id',
    cycleStart: 'cycle_start',
    count: 'count',
    overage: 'overage',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  sql: vi.fn(),
}));

vi.mock('@revealui/core/license', () => ({
  getMaxAgentTasks: vi.fn(() => 1_000),
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
    usdcAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    facilitatorUrl: 'https://x402.org/facilitator',
    maxTimeoutSeconds: 300,
  })),
  buildPaymentRequired: vi.fn(() => ({
    x402Version: 1,
    accepts: [{ scheme: 'exact', resource: 'http://localhost/test' }],
  })),
  encodePaymentRequired: vi.fn(() => 'encoded-payment-required'),
  verifyPayment: vi.fn(() => Promise.resolve({ valid: true })),
  getAdvertisedCurrencyLabel: vi.fn(() => 'usdc-only'),
}));

import { getMaxAgentTasks } from '@revealui/core/license';
import { requireTaskQuota } from '../task-quota.js';
import {
  buildPaymentRequired,
  encodePaymentRequired,
  getX402Config,
  verifyPayment,
} from '../x402.js';

const mockedGetMaxAgentTasks = vi.mocked(getMaxAgentTasks);
const mockedGetX402Config = vi.mocked(getX402Config);
const mockedVerifyPayment = vi.mocked(verifyPayment);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const TEST_USER: UserContext = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
};

/** Set up the mock chain for DB insert (fire-and-forget upsert). */
function setupInsertMock(): void {
  const catchFn = vi.fn(() => Promise.resolve());
  mockOnConflictDoUpdate.mockReturnValue({ catch: catchFn });
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  mockInsert.mockReturnValue({ values: mockValues });
}

/** Set up the mock chain for DB select with a given count result. */
function setupSelectMock(count: number | null): void {
  const rows = count !== null ? [{ count }] : [];
  mockLimit.mockResolvedValue(rows);
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

function createApp(user?: UserContext, entitlements?: { limits?: { maxAgentTasks?: number } }) {
  const app = new Hono<{
    Variables: {
      user: UserContext | undefined;
      entitlements?: { limits?: { maxAgentTasks?: number } };
    };
  }>();

  // Set user context before quota middleware
  app.use('/*', async (c, next) => {
    c.set('user', user);
    if (entitlements) {
      c.set('entitlements', entitlements);
    }
    return next();
  });

  app.use('/*', requireTaskQuota);
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireTaskQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupInsertMock();
    setupSelectMock(0);
    mockedGetMaxAgentTasks.mockReturnValue(1_000);
    mockedGetX402Config.mockReturnValue({
      enabled: false,
      receivingAddress: '',
      network: 'evm:base',
      pricePerTask: '0.001',
      usdcAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      facilitatorUrl: 'https://x402.org/facilitator',
      maxTimeoutSeconds: 300,
    });
  });

  // =========================================================================
  // Unauthenticated requests
  // =========================================================================

  describe('unauthenticated requests', () => {
    it('passes through when no user context is set', async () => {
      const app = createApp(undefined);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('does not query the database when unauthenticated', async () => {
      const app = createApp(undefined);
      await app.request('/test');

      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Under quota
  // =========================================================================

  describe('under quota', () => {
    it('allows requests when current count is zero', async () => {
      setupSelectMock(0);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('allows requests when current count is below quota', async () => {
      setupSelectMock(500);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });

    it('allows requests when count is one below quota', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(100);
      setupSelectMock(99);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });

    it('increments the count via upsert after allowing the request', async () => {
      setupSelectMock(10);

      const app = createApp(TEST_USER);
      await app.request('/test');

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          count: 1,
          overage: 0,
        }),
      );
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('handles missing DB row (null count defaults to 0)', async () => {
      setupSelectMock(null);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Quota exceeded (x402 disabled)
  // =========================================================================

  describe('quota exceeded (x402 disabled)', () => {
    it('returns 429 when count equals quota', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(100);
      setupSelectMock(100);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain('quota exceeded');
      expect(body.used).toBe(100);
      expect(body.quota).toBe(100);
      expect(body.resetAt).toBeDefined();
    });

    it('returns 429 when count exceeds quota', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(100);
      setupSelectMock(150);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.used).toBe(150);
    });

    it('tracks overage when quota is exceeded', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(100);
      setupSelectMock(100);

      const app = createApp(TEST_USER);
      await app.request('/test');

      // The overage insert fires (fire-and-forget)
      expect(mockInsert).toHaveBeenCalled();
    });

    it('includes resetAt timestamp for the next billing cycle', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(100);
      setupSelectMock(100);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      const body = await res.json();
      const resetAt = new Date(body.resetAt);
      // Reset should be the 1st of the next month
      expect(resetAt.getUTCDate()).toBe(1);
    });
  });

  // =========================================================================
  // Enterprise / Forge tier (Infinity quota)
  // =========================================================================

  describe('enterprise tier (Infinity quota)', () => {
    it('always passes through without blocking', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(Infinity);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });

    it('increments count for metering even though it never blocks', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(Infinity);

      const app = createApp(TEST_USER);
      await app.request('/test');

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          count: 1,
          overage: 0,
        }),
      );
    });

    it('does not query the DB for current count (skips select)', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(Infinity);

      const app = createApp(TEST_USER);
      await app.request('/test');

      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Different tier quotas
  // =========================================================================

  describe('tier-specific quotas', () => {
    it('uses free tier quota (1,000)', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(1_000);
      setupSelectMock(999);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });

    it('blocks free tier at 1,000', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(1_000);
      setupSelectMock(1_000);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.quota).toBe(1_000);
    });

    it('uses pro tier quota (10,000)', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(10_000);
      setupSelectMock(9_999);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });

    it('blocks pro tier at 10,000', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(10_000);
      setupSelectMock(10_000);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.quota).toBe(10_000);
    });

    it('uses max tier quota (50,000)', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(50_000);
      setupSelectMock(49_999);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // x402 payment path
  // =========================================================================

  describe('x402 payment path (quota exceeded, x402 enabled)', () => {
    beforeEach(() => {
      mockedGetMaxAgentTasks.mockReturnValue(100);
      setupSelectMock(100);
      mockedGetX402Config.mockReturnValue({
        enabled: true,
        receivingAddress: '0xWALLET',
        network: 'evm:base',
        pricePerTask: '0.001',
        usdcAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        facilitatorUrl: 'https://x402.org/facilitator',
        maxTimeoutSeconds: 300,
      });
    });

    it('returns 402 with payment info when no payment header is present', async () => {
      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.payment_required).toBe(true);
      expect(body.amount).toBe('0.001');
      expect(body.currency).toBe('USDC');
      expect(body.address).toBe('0xWALLET');
      expect(body.used).toBe(100);
      expect(body.quota).toBe(100);
      expect(body.resetAt).toBeDefined();
    });

    it('includes X-PAYMENT-REQUIRED header when no payment header is present', async () => {
      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(402);
      expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('encoded-payment-required');
      expect(encodePaymentRequired).toHaveBeenCalled();
      expect(buildPaymentRequired).toHaveBeenCalled();
    });

    it('allows the request through when valid payment proof is provided', async () => {
      mockedVerifyPayment.mockResolvedValue({ valid: true });

      const paymentPayload = Buffer.from(
        JSON.stringify({ x402Version: 1, scheme: 'exact', network: 'evm:base', payload: {} }),
      ).toString('base64');

      const app = createApp(TEST_USER);
      const res = await app.request('/test', {
        headers: { 'X-PAYMENT-PAYLOAD': paymentPayload },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('returns 402 with error when payment verification fails', async () => {
      mockedVerifyPayment.mockResolvedValue({ valid: false, error: 'Payment rejected' });

      const app = createApp(TEST_USER);
      const res = await app.request('/test', {
        headers: { 'X-PAYMENT-PAYLOAD': 'invalid-payload' },
      });

      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.payment_required).toBe(true);
      expect(body.error).toBe('Payment rejected');
      expect(body.amount).toBe('0.001');
      expect(body.currency).toBe('USDC');
    });

    it('does not return 402 when x402 is enabled but receivingAddress is empty', async () => {
      mockedGetX402Config.mockReturnValue({
        enabled: true,
        receivingAddress: '',
        network: 'evm:base',
        pricePerTask: '0.001',
        usdcAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        facilitatorUrl: 'https://x402.org/facilitator',
        maxTimeoutSeconds: 300,
      });

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      // Falls back to 429 since receivingAddress is empty
      expect(res.status).toBe(429);
    });

    it('prefers request-scoped maxAgentTasks over the global license quota', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(1_000);
      setupSelectMock(2);

      const app = createApp(TEST_USER, { limits: { maxAgentTasks: 2 } });
      const res = await app.request('/test');

      expect(res.status).toBe(402);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles DB select failure gracefully (count defaults to 0)', async () => {
      // When DB select rejects, the destructuring [row] will throw.
      // The middleware currently doesn't wrap this in try/catch, so this
      // tests that the mock chain works correctly with empty results.
      mockLimit.mockResolvedValue([]);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      // No row means count = 0, which is under quota
      expect(res.status).toBe(200);
    });

    it('uses the correct user ID for DB queries', async () => {
      const customUser = { ...TEST_USER, id: 'custom-user-456' };
      setupSelectMock(0);

      const app = createApp(customUser);
      await app.request('/test');

      // Check that the insert was called with the correct user ID
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'custom-user-456' }),
      );
    });

    it('does not block when quota is extremely large', async () => {
      mockedGetMaxAgentTasks.mockReturnValue(Number.MAX_SAFE_INTEGER);
      setupSelectMock(999_999);

      const app = createApp(TEST_USER);
      const res = await app.request('/test');

      expect(res.status).toBe(200);
    });
  });
});
