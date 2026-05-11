/**
 * K-1 — Marketplace invoke X402_ENABLED kill switch tests
 *
 * Verifies that the marketplace invoke route returns 503 when X402_ENABLED
 * is not 'true', and that no Stripe calls or DB writes occur.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const {
  mockGetX402Config,
  mockDbSelect,
  mockStripeTransfersCreate,
  mockVerifyPayment,
  mockBuildPaymentRequired,
} = vi.hoisted(() => ({
  mockGetX402Config: vi.fn(),
  mockDbSelect: vi.fn(),
  mockStripeTransfersCreate: vi.fn(),
  mockVerifyPayment: vi.fn(),
  mockBuildPaymentRequired: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/core/observability/metrics', () => ({
  trackX402PaymentRequired: vi.fn(),
}));

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: vi.fn(
    (_opts?: unknown) => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock('../../middleware/x402.js', () => ({
  getX402Config: mockGetX402Config,
  buildPaymentRequired: mockBuildPaymentRequired,
  encodePaymentRequired: vi.fn(() => 'encoded'),
  getAdvertisedCurrencyLabel: () => 'usdc-only',
  verifyPayment: mockVerifyPayment,
}));

vi.mock('../../lib/services-loader.js', () => ({
  getServices: vi.fn().mockResolvedValue({
    stripe: {
      transfers: { create: mockStripeTransfersCreate },
    },
  }),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    transfers: { create: mockStripeTransfersCreate },
  },
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      transfers = { create: mockStripeTransfersCreate };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

const mockSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({ select: mockDbSelect })),
}));

vi.mock('@revealui/db/schema', () => ({
  marketplaceServers: { id: 'marketplaceServers.id', status: 'marketplaceServers.status' },
  marketplaceTransactions: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_c, _v) => 'eq'),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  asc: vi.fn(() => 'asc'),
  sql: vi.fn(() => 'sql'),
}));

import marketplaceApp from '../marketplace.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.route('/', marketplaceApp);
  return app;
}

// Valid marketplace ID: 'mcp_' + exactly 12 word chars (matches route param schema)
const VALID_SERVER_ID = 'mcp_abc123def456';

function invokeRequest(id: string = VALID_SERVER_ID): Request {
  return new Request(`http://localhost/servers/${id}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'tools/list', params: {} }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('K-1 — Marketplace X402_ENABLED kill switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockResolvedValue([]);
    mockDbSelect.mockReturnValue(mockSelectChain);
  });

  describe('X402_ENABLED=false (or unset) — invoke returns 503', () => {
    it('returns 503 when enabled=false', async () => {
      mockGetX402Config.mockReturnValue({ enabled: false });

      const app = createApp();
      const res = await app.request(invokeRequest());

      expect(res.status).toBe(503);
    });

    it('returns 503 when X402_ENABLED is unset (kill-by-default)', async () => {
      mockGetX402Config.mockReturnValue({ enabled: false });

      const app = createApp();
      const res = await app.request(invokeRequest());

      expect(res.status).toBe(503);
    });

    it('does not call the database when disabled', async () => {
      mockGetX402Config.mockReturnValue({ enabled: false });

      const app = createApp();
      await app.request(invokeRequest());

      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('does not call Stripe when disabled', async () => {
      mockGetX402Config.mockReturnValue({ enabled: false });

      const app = createApp();
      await app.request(invokeRequest());

      expect(mockStripeTransfersCreate).not.toHaveBeenCalled();
    });

    it('does not call verifyPayment when disabled', async () => {
      mockGetX402Config.mockReturnValue({ enabled: false });

      const app = createApp();
      await app.request(invokeRequest());

      expect(mockVerifyPayment).not.toHaveBeenCalled();
    });
  });

  describe('X402_ENABLED=true — invoke proceeds to normal x402 gate', () => {
    it('does not return 503 when enabled=true', async () => {
      mockGetX402Config.mockReturnValue({
        enabled: true,
        receivingAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        pricePerTask: '0.001',
        network: 'evm:base',
        usdcAsset: '0xUSDs',
        facilitatorUrl: 'https://facilitator.example.com',
        maxTimeoutSeconds: 300,
        rvuiEnabled: false,
        rvuiReceivingAddress: '',
        rvuiNetwork: 'solana:devnet',
        rvuiAsset: '',
      });

      // Server exists with a price
      mockSelectChain.limit.mockResolvedValueOnce([
        {
          id: VALID_SERVER_ID,
          status: 'active',
          pricePerCallUsdc: '0.01',
          name: 'Test Server',
          description: 'A test server',
          endpointUrl: 'https://example.com',
          developerId: 'user_dev',
          stripeConnectAccountId: 'acct_test',
        },
      ]);

      mockBuildPaymentRequired.mockReturnValue({ accepts: [] });

      const app = createApp();
      const res = await app.request(invokeRequest());

      expect(res.status).not.toBe(503);
    });
  });
});
