/**
 * Coverage Gap Tests
 *
 * Fills specific coverage gaps across the services package:
 *
 * 1. src/index.ts — checkServicesLicense() (0% → covered)
 * 2. src/stripe/stripeClient.ts — getStripe() lazy init, config proxy fallback,
 *    missing key error, caching, __resetStripe
 * 3. src/api/webhooks/index.ts — signature verification edge cases,
 *    checkout.session.completed edge cases (missing private key, license gen failure),
 *    resolveTierFromMetadata price-ID branches, subscription customer as object
 * 4. src/api/handlers/payment-handlers.ts — handlePaymentMethodDetached happy + error paths
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Shared logger mock
// ============================================================================

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('@revealui/core/observability/logger', () => ({
  logger: mockLogger,
  createLogger: () => mockLogger,
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: mockLogger,
}));

// Mock heavy sub-modules re-exported from src/index.ts to avoid CI timeout
// (@solana/kit import graph is large and exceeds the 5s default timeout in CI)
vi.mock('@solana/kit', () => ({
  address: vi.fn((v: unknown) => v),
  createSolanaRpc: vi.fn(),
  signature: vi.fn((v: unknown) => v),
}));

vi.mock('@revealui/contracts', () => ({
  RVUI_MINT_ADDRESSES: { mainnet: 'mock', devnet: 'mock' },
  RVUI_TOKEN_CONFIG: { decimals: 9, symbol: 'RVUI' },
  RVUI_TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
}));

// ============================================================================
// 1. checkServicesLicense()
// ============================================================================

const mockIsFeatureEnabled = vi.fn();

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
}));

describe('checkServicesLicense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when payments feature is enabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    const { checkServicesLicense } = await import('../src/index.js');
    expect(checkServicesLicense()).toBe(true);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('payments');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('returns false and logs warning when payments feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    const { checkServicesLicense } = await import('../src/index.js');
    expect(checkServicesLicense()).toBe(false);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('payments');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Pro or Enterprise license'),
    );
  });
});

// ============================================================================
// Mock Stripe SDK as a class (used by both stripeClient and webhooks)
// ============================================================================

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsUpdate = vi.fn();

class MockStripe {
  customers = { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), del: vi.fn(), list: vi.fn() };
  products = { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), list: vi.fn() };
  prices = { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), list: vi.fn() };
  paymentIntents = { create: vi.fn(), retrieve: vi.fn(), update: vi.fn() };
  subscriptions = {
    list: vi.fn(),
    retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
    update: (...args: unknown[]) => mockSubscriptionsUpdate(...args),
    cancel: vi.fn(),
  };
  checkout = { sessions: { create: vi.fn(), retrieve: vi.fn() } };
  billingPortal = { sessions: { create: vi.fn() } };
  webhooks = { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) };
  balance = { retrieve: vi.fn() };
}

vi.mock('stripe', () => ({
  default: MockStripe,
}));

// Mock DB circuit breaker as a proper class
vi.mock('../src/stripe/db-circuit-breaker.js', () => ({
  DbCircuitBreaker: class MockDbCircuitBreaker {
    isOpen = vi.fn().mockResolvedValue(false);
    recordSuccess = vi.fn().mockResolvedValue(undefined);
    recordFailure = vi.fn().mockResolvedValue(undefined);
    reset = vi.fn().mockResolvedValue(undefined);
  },
}));

// Config mock — mutable per test
const mockConfigState = { secretKey: undefined as string | undefined };

vi.mock('@revealui/config', () => ({
  default: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'stripe') {
          return { secretKey: mockConfigState.secretKey };
        }
        return undefined;
      },
    },
  ),
}));

// ============================================================================
// 2. stripeClient.ts — getStripe()
// ============================================================================

describe('stripeClient — getStripe()', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockConfigState.secretKey = undefined;
    delete process.env.STRIPE_SECRET_KEY;
    // Reset the cached Stripe instance
    const mod = await import('../src/stripe/stripeClient.js');
    mod.__resetStripe();
  });

  it('uses config module secretKey when available', async () => {
    mockConfigState.secretKey = 'sk_test_from_config';
    const mod = await import('../src/stripe/stripeClient.js');
    const stripe = mod.getStripe();
    expect(stripe).toBeDefined();
    expect(stripe).toBeInstanceOf(MockStripe);
  });

  it('falls back to process.env.STRIPE_SECRET_KEY when config has no key', async () => {
    mockConfigState.secretKey = undefined;
    process.env.STRIPE_SECRET_KEY = 'sk_test_from_env';
    const mod = await import('../src/stripe/stripeClient.js');
    const stripe = mod.getStripe();
    expect(stripe).toBeDefined();
    expect(stripe).toBeInstanceOf(MockStripe);
  });

  it('throws when neither config nor process.env has a secret key', async () => {
    mockConfigState.secretKey = undefined;
    delete process.env.STRIPE_SECRET_KEY;
    const mod = await import('../src/stripe/stripeClient.js');
    expect(() => mod.getStripe()).toThrow('STRIPE_SECRET_KEY environment variable is required');
  });

  it('returns cached instance on subsequent calls', async () => {
    mockConfigState.secretKey = 'sk_test_cached';
    const mod = await import('../src/stripe/stripeClient.js');
    const first = mod.getStripe();
    const second = mod.getStripe();
    expect(first).toBe(second);
  });

  it('__resetStripe clears the cache so next call creates a new instance', async () => {
    mockConfigState.secretKey = 'sk_test_reset';
    const mod = await import('../src/stripe/stripeClient.js');
    const first = mod.getStripe();
    mod.__resetStripe();
    const second = mod.getStripe();
    // Both valid but different instances (reset clears cache)
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('exports createProtectedStripe factory', async () => {
    const mod = await import('../src/stripe/stripeClient.js');
    expect(mod.protectedStripe).toBeDefined();
    expect(mod.createProtectedStripe).toBeDefined();
    expect(typeof mod.createProtectedStripe).toBe('function');
  });
});

// ============================================================================
// 3. webhooks/index.ts — additional branch coverage
//
// The webhook module imports protectedStripe from stripeClient, which uses
// our MockStripe class. We control webhook behavior through mockConstructEvent,
// mockSubscriptionsRetrieve, and mockSubscriptionsUpdate.
// ============================================================================

const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  limit: vi.fn(() => Promise.resolve([])),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  onConflictDoNothing: vi.fn(() => Promise.resolve()),
};

vi.mock('@revealui/db/client', () => ({
  getClient: () => mockDb,
}));

vi.mock('@revealui/db/schema', () => ({
  processedWebhookEvents: { id: 'id', eventType: 'eventType' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _col, val })),
}));

const mockCreateServerClientFromRequest = vi.fn();

vi.mock('../src/supabase/index.js', () => ({
  createServerClientFromRequest: (...args: unknown[]) => mockCreateServerClientFromRequest(...args),
}));

const mockUpsertProductRecord = vi.fn();
const mockUpsertPriceRecord = vi.fn();
const mockManageSubscriptionStatusChange = vi.fn();
const mockHandleInvoicePaymentSucceeded = vi.fn();
const mockHandleInvoicePaymentFailed = vi.fn();
const mockHandlePaymentMethodAttached = vi.fn();

vi.mock('../src/api/utils.js', () => ({
  upsertProductRecord: (...args: unknown[]) => mockUpsertProductRecord(...args),
  upsertPriceRecord: (...args: unknown[]) => mockUpsertPriceRecord(...args),
  manageSubscriptionStatusChange: (...args: unknown[]) =>
    mockManageSubscriptionStatusChange(...args),
  handleInvoicePaymentSucceeded: (...args: unknown[]) => mockHandleInvoicePaymentSucceeded(...args),
  handleInvoicePaymentFailed: (...args: unknown[]) => mockHandleInvoicePaymentFailed(...args),
  handlePaymentMethodAttached: (...args: unknown[]) => mockHandlePaymentMethodAttached(...args),
  copyBillingDetailsToCustomer: vi.fn(),
  createOrRetrieveCustomer: vi.fn(),
  createPaymentIntent: vi.fn(),
  handleCheckoutSessionCompleted: vi.fn(),
  handleCustomerCreated: vi.fn(),
  handleCustomerSubscriptionCreated: vi.fn(),
  handleCustomerSubscriptionDeleted: vi.fn(),
  handleCustomerSubscriptionUpdated: vi.fn(),
  handleCustomerUpdated: vi.fn(),
  handlePaymentMethodCreated: vi.fn(),
  handlePaymentMethodDetached: vi.fn(),
  handlePaymentMethodUpdated: vi.fn(),
  handleSetupIntentFailed: vi.fn(),
  handleSetupIntentSucceeded: vi.fn(),
  handleSupabaseError: vi.fn(),
  toDateTime: vi.fn(),
  upsertRecord: vi.fn(),
  createClient: vi.fn(),
  getURL: vi.fn(),
  createStripeCustomer: vi.fn(),
}));

const mockGenerateLicenseKey = vi.fn();

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: (...args: unknown[]) => mockGenerateLicenseKey(...args),
}));

// --- Webhook test helpers ---

function buildRequest(overrides: {
  body?: string;
  headers?: Record<string, string>;
  contentLength?: string | null;
}): Request {
  const { body = '{}', headers = {}, contentLength } = overrides;
  const headersObj: Record<string, string> = {
    'Stripe-Signature': 't=1,v1=sig',
    'Content-Type': 'application/json',
    ...headers,
  };
  if (contentLength !== undefined) {
    if (contentLength === null) {
      delete headersObj['content-length'];
    } else {
      headersObj['content-length'] = contentLength;
    }
  }
  return new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    headers: headersObj,
    body,
  });
}

function createMockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'user_1' }, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
}

function buildEvent(type: string, dataObject: Record<string, unknown>): Record<string, unknown> {
  return {
    id: `evt_${type.replace(/\./g, '_')}_gap`,
    type,
    data: { object: dataObject },
  };
}

describe('webhooks — additional branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClientFromRequest.mockReturnValue(createMockSupabase());
    mockDb.limit.mockResolvedValue([]);
    mockDb.onConflictDoNothing.mockResolvedValue(undefined);
    // Ensure stripeClient can initialize for the webhook module
    mockConfigState.secretKey = 'sk_test_webhook';
  });

  it('returns 400 when constructEvent throws a non-Error value', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw 'raw string error';
    });
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Unknown error');
  });

  it('handles checkout.session.completed with customer as object', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_obj',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_obj',
        customer: { id: 'cus_obj', object: 'customer' },
        metadata: { tier: 'pro' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_obj',
      metadata: {},
      items: { data: [{ price: { id: 'price_pro' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_test');
    mockSubscriptionsUpdate.mockResolvedValue({});
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-private-key';

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalledWith(
      'sub_obj',
      'cus_obj',
      true,
      expect.anything(),
    );
  });

  it('logs critical error when REVEALUI_LICENSE_PRIVATE_KEY is not set', async () => {
    const savedKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_nokey',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_nokey',
        customer: 'cus_nokey',
        metadata: { tier: 'pro' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_nokey',
      metadata: {},
      items: { data: [{ price: { id: 'price_pro' } }] },
    });

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('REVEALUI_LICENSE_PRIVATE_KEY not set'),
      expect.objectContaining({ customerId: 'cus_nokey' }),
    );
    expect(mockGenerateLicenseKey).not.toHaveBeenCalled();

    if (savedKey) process.env.REVEALUI_LICENSE_PRIVATE_KEY = savedKey;
  });

  it('logs critical error when license generation throws', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_fail',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_fail',
        customer: 'cus_fail',
        metadata: { tier: 'enterprise' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_fail',
      metadata: {},
      items: { data: [{ price: { id: 'price_ent' } }] },
    });
    mockGenerateLicenseKey.mockRejectedValue(new Error('crypto failure'));

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('License generation failed'),
      expect.objectContaining({ error: 'crypto failure' }),
    );
  });

  it('resolves pro tier from STRIPE_PRO_PRICE_ID env var', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_env';

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_pro_env',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_pro_env',
        customer: 'cus_pro_env',
        metadata: {},
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_pro_env',
      metadata: {},
      items: { data: [{ price: { id: 'price_pro_env' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_pro');
    mockSubscriptionsUpdate.mockResolvedValue({});

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateLicenseKey).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'pro', customerId: 'cus_pro_env' }),
      'test-key',
    );

    delete process.env.STRIPE_PRO_PRICE_ID;
  });

  it('resolves max tier from STRIPE_MAX_PRICE_ID env var', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    process.env.STRIPE_MAX_PRICE_ID = 'price_max_env';

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_max_env',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_max_env',
        customer: 'cus_max_env',
        metadata: {},
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_max_env',
      metadata: {},
      items: { data: [{ price: { id: 'price_max_env' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_max');
    mockSubscriptionsUpdate.mockResolvedValue({});

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateLicenseKey).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'max' }),
      'test-key',
    );

    delete process.env.STRIPE_MAX_PRICE_ID;
  });

  it('resolves enterprise tier from STRIPE_ENTERPRISE_PRICE_ID env var', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_ent_env';

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_ent_env',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_ent_env',
        customer: 'cus_ent_env',
        metadata: {},
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_ent_env',
      metadata: {},
      items: { data: [{ price: { id: 'price_ent_env' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_ent');
    mockSubscriptionsUpdate.mockResolvedValue({});

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateLicenseKey).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'enterprise' }),
      'test-key',
    );

    delete process.env.STRIPE_ENTERPRISE_PRICE_ID;
  });

  it('resolves enterprise tier from metadata fallback', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_MAX_PRICE_ID;
    delete process.env.STRIPE_ENTERPRISE_PRICE_ID;

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_meta_ent',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_meta_ent',
        customer: 'cus_meta_ent',
        metadata: { tier: 'enterprise' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_meta_ent',
      metadata: {},
      items: { data: [{ price: { id: 'price_unknown' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_meta_ent');
    mockSubscriptionsUpdate.mockResolvedValue({});

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateLicenseKey).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'enterprise' }),
      'test-key',
    );
  });

  it('resolves max tier from metadata fallback', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_MAX_PRICE_ID;
    delete process.env.STRIPE_ENTERPRISE_PRICE_ID;

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_meta_max',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_meta_max',
        customer: 'cus_meta_max',
        metadata: { tier: 'max' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_meta_max',
      metadata: {},
      items: { data: [{ price: { id: 'price_unknown' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_meta_max');
    mockSubscriptionsUpdate.mockResolvedValue({});

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateLicenseKey).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'max' }),
      'test-key',
    );
  });

  it('returns 400 when tier cannot be resolved (unknown price, no metadata)', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_MAX_PRICE_ID;
    delete process.env.STRIPE_ENTERPRISE_PRICE_ID;

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_no_tier',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_no_tier',
        customer: 'cus_no_tier',
        metadata: {},
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_no_tier',
      metadata: {},
      items: { data: [{ price: { id: 'price_unknown' } }] },
    });

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Webhook error');
  });

  it('extracts customer id from object in subscription event', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('customer.subscription.created', {
        id: 'sub_cobj',
        object: 'subscription',
        customer: { id: 'cus_from_obj', object: 'customer' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalledWith(
      'sub_cobj',
      'cus_from_obj',
      true,
      expect.anything(),
    );
  });

  it('handles checkout.session.completed with subscription as object', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-key';
    delete process.env.STRIPE_PRO_PRICE_ID;

    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_subobj',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: { id: 'sub_as_obj' },
        customer: 'cus_subobj',
        metadata: { tier: 'pro' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_as_obj',
      metadata: {},
      items: { data: [{ price: { id: 'price_x' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('lk_subobj');
    mockSubscriptionsUpdate.mockResolvedValue({});

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalledWith(
      'sub_as_obj',
      'cus_subobj',
      true,
      expect.anything(),
    );
  });

  it('skips processing when checkout session has no customer', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_no_cust',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_nc',
        customer: null,
        metadata: {},
      }),
    );

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 4. payment-handlers.ts — handlePaymentMethodDetached + edge cases
// ============================================================================

describe('payment-handlers — handlePaymentMethodDetached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createHandlerSupabase(overrides: Record<string, unknown> = {}) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    return { from: vi.fn().mockReturnValue({ ...chain, ...overrides }) };
  }

  function buildPmEvent<T extends string>(
    type: T,
    paymentMethod: Record<string, unknown>,
  ): { type: T; data: { object: unknown } } {
    return { type, data: { object: paymentMethod } };
  }

  it('throws when data.object is not a payment method', async () => {
    const { handlePaymentMethodDetached } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPmEvent('payment_method.detached', {
      id: 'x',
      object: 'customer',
    });
    const supabase = createHandlerSupabase();

    await expect(handlePaymentMethodDetached(event as never, supabase as never)).rejects.toThrow(
      'Invalid payment method in event',
    );
  });

  it('throws when payment method has no customer', async () => {
    const { handlePaymentMethodDetached } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPmEvent('payment_method.detached', {
      id: 'pm_1',
      object: 'payment_method',
      customer: null,
      billing_details: {},
    });
    const supabase = createHandlerSupabase();

    await expect(handlePaymentMethodDetached(event as never, supabase as never)).rejects.toThrow(
      'Payment method missing customer',
    );
  });

  it('throws when user not found for customer', async () => {
    const { handlePaymentMethodDetached } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPmEvent('payment_method.detached', {
      id: 'pm_det',
      object: 'payment_method',
      customer: 'cus_det',
      billing_details: { name: null, phone: null, address: null },
    });
    const supabase = createHandlerSupabase({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(handlePaymentMethodDetached(event as never, supabase as never)).rejects.toThrow(
      'User not found for customer',
    );
  });

  it('completes when user found and billing details are empty', async () => {
    const { handlePaymentMethodDetached } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPmEvent('payment_method.detached', {
      id: 'pm_det_ok',
      object: 'payment_method',
      customer: 'cus_det_ok',
      billing_details: { name: null, phone: null, address: null },
    });
    const supabase = createHandlerSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_det' }, error: null }),
    });

    await expect(
      handlePaymentMethodDetached(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('completes with full billing details', async () => {
    const { handlePaymentMethodDetached } = await import('../src/api/handlers/payment-handlers.js');
    const event = buildPmEvent('payment_method.detached', {
      id: 'pm_det_full',
      object: 'payment_method',
      customer: 'cus_det_full',
      billing_details: {
        name: 'Test User',
        phone: '+1555000111',
        address: {
          city: 'Austin',
          country: 'US',
          line1: '123 Main',
          line2: null,
          postal_code: '78701',
          state: 'TX',
        },
      },
    });
    const supabase = createHandlerSupabase({
      single: vi.fn().mockResolvedValue({ data: { id: 'user_det_full' }, error: null }),
    });

    await expect(
      handlePaymentMethodDetached(event as never, supabase as never),
    ).resolves.toBeUndefined();
  });
});
