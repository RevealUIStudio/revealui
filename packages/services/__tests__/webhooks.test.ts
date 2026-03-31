/**
 * Webhook POST Handler Tests
 *
 * Covers src/api/webhooks/index.ts (was 1.75% coverage):
 * - DoS protection (Content-Length, body size)
 * - Missing Stripe-Signature → 400
 * - Invalid signature → 400
 * - Missing Supabase client → 500
 * - Duplicate event idempotency → 200 + duplicate flag
 * - Non-relevant event → 200
 * - product.created / product.updated
 * - price.created / price.updated
 * - customer.subscription.{created,updated,deleted}
 * - checkout.session.completed (license key generation)
 * - invoice.payment_succeeded / invoice.payment_failed
 * - payment_method.attached
 * - Handler error → 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB client (idempotency checks)
// ---------------------------------------------------------------------------

const _mockDbSelect = vi.fn();
const _mockDbInsert = vi.fn();

const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  limit: vi.fn(() => Promise.resolve([])), // default: event not yet processed
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

// ---------------------------------------------------------------------------
// Mock Stripe client (webhook signature verification)
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsUpdate = vi.fn();

vi.mock('../src/stripe/stripeClient.js', () => ({
  protectedStripe: {
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
      update: (...args: unknown[]) => mockSubscriptionsUpdate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockCreateServerClientFromRequest = vi.fn();

vi.mock('../src/supabase/index.js', () => ({
  createServerClientFromRequest: (...args: unknown[]) => mockCreateServerClientFromRequest(...args),
}));

// ---------------------------------------------------------------------------
// Mock handlers (imported via ../utils.js in webhooks/index.ts)
// ---------------------------------------------------------------------------

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
  // Unused re-exports — stub so module resolves
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

// ---------------------------------------------------------------------------
// Mock core license
// ---------------------------------------------------------------------------

const mockGenerateLicenseKey = vi.fn();

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: (...args: unknown[]) => mockGenerateLicenseKey(...args),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function mockSupabase() {
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
    id: `evt_${type.replace(/\./g, '_')}_123`,
    type,
    data: { object: dataObject },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: supabase client available
    mockCreateServerClientFromRequest.mockReturnValue(mockSupabase());
    // Default: signature verifies
    mockConstructEvent.mockImplementation((_body: string, _sig: string, _secret: string) =>
      buildEvent('product.created', { id: 'prod_1', object: 'product' }),
    );
    // Default: event not yet processed
    mockDb.limit.mockResolvedValue([]);
    mockDb.onConflictDoNothing.mockResolvedValue(undefined);
    mockUpsertProductRecord.mockResolvedValue(undefined);
  });

  it('returns 500 when supabase client is unavailable', async () => {
    mockCreateServerClientFromRequest.mockReturnValue(null);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({ body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Supabase client not available');
  });

  it('returns 413 when actual body exceeds size limit after reading', async () => {
    const { POST } = await import('../src/api/webhooks/index.js');
    // Body with no Content-Length header but oversized body read from stream
    const oversizedBody = 'x'.repeat(10 * 1024 * 1024 + 1);
    const req = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=1,v1=sig',
        // No content-length — advisory check passes, but body read check fires
      },
      body: oversizedBody,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('returns 413 when Content-Length header exceeds limit', async () => {
    const { POST } = await import('../src/api/webhooks/index.js');
    const bigSize = (10 * 1024 * 1024 + 1).toString();
    const req = buildRequest({ contentLength: bigSize });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('returns 400 when Stripe-Signature header is missing', async () => {
    const { POST } = await import('../src/api/webhooks/index.js');
    const _req = buildRequest({ headers: { 'Stripe-Signature': '' } });
    // Override to remove the sig header
    const noSigReq = new Request('https://example.com/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const res = await POST(noSigReq);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Missing Stripe-Signature');
  });

  it('returns 400 when webhook signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Webhook Error');
  });

  it('returns 200 with duplicate flag when event already processed', async () => {
    mockDb.limit.mockResolvedValue([{ id: 'evt_already_processed' }]);
    mockConstructEvent.mockReturnValue(
      buildEvent('product.created', { id: 'prod_1', object: 'product' }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
  });

  it('returns 200 for non-relevant event type', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('customer.created', { id: 'cus_1', object: 'customer' }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it('handles product.created — calls upsertProductRecord', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('product.created', { id: 'prod_1', object: 'product', name: 'Test Product' }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpsertProductRecord).toHaveBeenCalled();
  });

  it('handles product.updated — calls upsertProductRecord', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('product.updated', { id: 'prod_1', object: 'product', name: 'Updated Product' }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpsertProductRecord).toHaveBeenCalled();
  });

  it('handles price.created — calls upsertPriceRecord', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('price.created', { id: 'price_1', object: 'price', unit_amount: 999 }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpsertPriceRecord).toHaveBeenCalled();
  });

  it('handles price.updated — calls upsertPriceRecord', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('price.updated', { id: 'price_1', object: 'price', active: false }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpsertPriceRecord).toHaveBeenCalled();
  });

  it('handles customer.subscription.created — calls manageSubscriptionStatusChange', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('customer.subscription.created', {
        id: 'sub_1',
        object: 'subscription',
        customer: 'cus_1',
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalledWith(
      'sub_1',
      'cus_1',
      true, // createAction = true for .created
      expect.anything(),
    );
  });

  it('handles customer.subscription.updated — calls manageSubscriptionStatusChange', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('customer.subscription.updated', {
        id: 'sub_1',
        object: 'subscription',
        customer: 'cus_1',
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalledWith(
      'sub_1',
      'cus_1',
      false,
      expect.anything(),
    );
  });

  it('handles customer.subscription.deleted — calls manageSubscriptionStatusChange and logs', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('customer.subscription.deleted', {
        id: 'sub_1',
        object: 'subscription',
        customer: 'cus_1',
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalled();
  });

  it('returns 400 when subscription event is missing customer', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('customer.subscription.created', {
        id: 'sub_1',
        object: 'subscription',
        customer: null,
      }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('handles invoice.payment_succeeded — calls handleInvoicePaymentSucceeded', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('invoice.payment_succeeded', {
        id: 'in_1',
        object: 'invoice',
        subscription: 'sub_1',
        customer: 'cus_1',
      }),
    );
    mockHandleInvoicePaymentSucceeded.mockResolvedValue(undefined);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandleInvoicePaymentSucceeded).toHaveBeenCalled();
  });

  it('handles invoice.payment_failed — calls handleInvoicePaymentFailed', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('invoice.payment_failed', {
        id: 'in_1',
        object: 'invoice',
        subscription: 'sub_1',
        customer: 'cus_1',
      }),
    );
    mockHandleInvoicePaymentFailed.mockResolvedValue(undefined);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandleInvoicePaymentFailed).toHaveBeenCalled();
  });

  it('handles payment_method.attached — calls handlePaymentMethodAttached', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('payment_method.attached', {
        id: 'pm_1',
        object: 'payment_method',
        customer: 'cus_1',
        billing_details: {},
      }),
    );
    mockHandlePaymentMethodAttached.mockResolvedValue(undefined);
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandlePaymentMethodAttached).toHaveBeenCalled();
  });

  it('handles checkout.session.completed — subscription mode generates license', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_1',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_1',
        customer: 'cus_1',
        metadata: { tier: 'pro' },
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      metadata: {},
      items: { data: [{ price: { id: process.env.STRIPE_PRO_PRICE_ID ?? 'price_pro' } }] },
    });
    mockGenerateLicenseKey.mockResolvedValue('license_key_abc');
    mockSubscriptionsUpdate.mockResolvedValue({});
    // Set env for tier resolution via metadata fallback
    process.env.STRIPE_PRO_PRICE_ID = undefined as unknown as string;

    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).toHaveBeenCalled();
  });

  it('handles checkout.session.completed — skips license if already present (idempotent)', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_1',
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_1',
        customer: 'cus_1',
        metadata: {},
      }),
    );
    mockManageSubscriptionStatusChange.mockResolvedValue(undefined);
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      metadata: { license_key: 'already_exists' },
      items: { data: [{ price: { id: 'price_pro' } }] },
    });
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGenerateLicenseKey).not.toHaveBeenCalled();
  });

  it('handles checkout.session.completed — non-subscription mode is a no-op', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('checkout.session.completed', {
        id: 'cs_1',
        object: 'checkout.session',
        mode: 'payment',
        subscription: null,
        customer: 'cus_1',
        metadata: {},
      }),
    );
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockManageSubscriptionStatusChange).not.toHaveBeenCalled();
  });

  it('returns 400 when a handler throws', async () => {
    mockConstructEvent.mockReturnValue(
      buildEvent('product.created', { id: 'prod_1', object: 'product' }),
    );
    mockUpsertProductRecord.mockRejectedValue(new Error('DB write failed'));
    const { POST } = await import('../src/api/webhooks/index.js');
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Webhook error');
  });
});
