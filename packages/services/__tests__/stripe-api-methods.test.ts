/**
 * Protected Stripe API Method Tests
 *
 * Covers the uncovered API wrapper methods in src/stripe/stripeClient.ts:
 * - products.{create,retrieve,update,list}
 * - prices.{create,retrieve,update,list}
 * - subscriptions.{list,retrieve,update,cancel}
 * - checkout.sessions.{create,retrieve}
 * - billingPortal.sessions.create
 * - webhooks getter
 * - balance getter
 *
 * Uses createProtectedStripe() DI to inject a mock Stripe instance.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProtectedStripe } from '../src/stripe/stripeClient.js';

vi.mock('@revealui/config', () => ({
  default: { stripe: { secretKey: 'sk_test_mock' } },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Prevent DbCircuitBreaker from hitting a real DB during unit tests.
// fail-open: readFromDb catch returns closed state; no DB needed for wrapper tests.
vi.mock('@revealui/db', () => ({
  getClient: () => {
    throw new Error('DB not available in unit tests');
  },
}));

// ---------------------------------------------------------------------------
// Minimal mock Stripe instance
// ---------------------------------------------------------------------------

function buildMockStripe() {
  return {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      del: vi.fn(),
      list: vi.fn(),
    },
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    products: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    },
    prices: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    },
    subscriptions: {
      list: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    charges: {
      retrieve: vi.fn(),
    },
    transfers: {
      create: vi.fn(),
    },
    accounts: {
      create: vi.fn(),
    },
    accountLinks: {
      create: vi.fn(),
    },
    events: {
      retrieve: vi.fn(),
    },
    billing: {
      meterEvents: {
        create: vi.fn(),
      },
    },
    webhooks: { constructEvent: vi.fn() },
    balance: { retrieve: vi.fn() },
  };
}

describe('createProtectedStripe  -  products', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('products.create delegates to stripe instance', async () => {
    const product = { id: 'prod_1', object: 'product', name: 'Test' };
    mockStripe.products.create.mockResolvedValue(product);
    const result = await client.products.create({ name: 'Test' });
    expect(result).toEqual(product);
    expect(mockStripe.products.create).toHaveBeenCalledWith({ name: 'Test' });
  });

  it('products.retrieve delegates to stripe instance', async () => {
    const product = { id: 'prod_1', object: 'product', name: 'Test' };
    mockStripe.products.retrieve.mockResolvedValue(product);
    const result = await client.products.retrieve('prod_1');
    expect(result).toEqual(product);
  });

  it('products.update delegates to stripe instance', async () => {
    const updated = { id: 'prod_1', object: 'product', name: 'Updated' };
    mockStripe.products.update.mockResolvedValue(updated);
    const result = await client.products.update('prod_1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('products.list delegates to stripe instance', async () => {
    const list = { data: [], has_more: false, object: 'list', url: '/products' };
    mockStripe.products.list.mockResolvedValue(list);
    const result = await client.products.list();
    expect(result).toEqual(list);
  });
});

describe('createProtectedStripe  -  prices', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('prices.create delegates to stripe instance', async () => {
    const price = { id: 'price_1', object: 'price', unit_amount: 999 };
    mockStripe.prices.create.mockResolvedValue(price);
    const result = await client.prices.create({
      currency: 'usd',
      unit_amount: 999,
      product: 'prod_1',
    });
    expect(result).toEqual(price);
  });

  it('prices.retrieve delegates to stripe instance', async () => {
    const price = { id: 'price_1', object: 'price' };
    mockStripe.prices.retrieve.mockResolvedValue(price);
    const result = await client.prices.retrieve('price_1');
    expect(result).toEqual(price);
  });

  it('prices.update delegates to stripe instance', async () => {
    const updated = { id: 'price_1', object: 'price', active: false };
    mockStripe.prices.update.mockResolvedValue(updated);
    const result = await client.prices.update('price_1', { active: false });
    expect(result).toEqual(updated);
  });

  it('prices.list delegates to stripe instance', async () => {
    const list = { data: [], has_more: false, object: 'list', url: '/prices' };
    mockStripe.prices.list.mockResolvedValue(list);
    const result = await client.prices.list({ product: 'prod_1' });
    expect(result).toEqual(list);
  });
});

describe('createProtectedStripe  -  subscriptions', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('subscriptions.list delegates to stripe instance', async () => {
    const list = { data: [], has_more: false, object: 'list', url: '/subscriptions' };
    mockStripe.subscriptions.list.mockResolvedValue(list);
    const result = await client.subscriptions.list({ customer: 'cus_1' });
    expect(result).toEqual(list);
  });

  it('subscriptions.retrieve delegates to stripe instance', async () => {
    const sub = { id: 'sub_1', object: 'subscription', status: 'active' };
    mockStripe.subscriptions.retrieve.mockResolvedValue(sub);
    const result = await client.subscriptions.retrieve('sub_1');
    expect(result).toEqual(sub);
  });

  it('subscriptions.update delegates to stripe instance', async () => {
    const updated = { id: 'sub_1', object: 'subscription', metadata: { key: 'val' } };
    mockStripe.subscriptions.update.mockResolvedValue(updated);
    const result = await client.subscriptions.update('sub_1', { metadata: { key: 'val' } });
    expect(result).toEqual(updated);
  });

  it('subscriptions.cancel delegates to stripe instance', async () => {
    const cancelled = { id: 'sub_1', object: 'subscription', status: 'canceled' };
    mockStripe.subscriptions.cancel.mockResolvedValue(cancelled);
    const result = await client.subscriptions.cancel('sub_1');
    expect(result).toEqual(cancelled);
  });
});

describe('createProtectedStripe  -  checkout.sessions', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('checkout.sessions.create delegates to stripe instance', async () => {
    const session = { id: 'cs_1', object: 'checkout.session', url: 'https://checkout.stripe.com' };
    mockStripe.checkout.sessions.create.mockResolvedValue(session);
    const result = await client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [],
      success_url: 'https://example.com/success',
    });
    expect(result).toEqual(session);
  });

  it('checkout.sessions.retrieve delegates to stripe instance', async () => {
    const session = { id: 'cs_1', object: 'checkout.session' };
    mockStripe.checkout.sessions.retrieve.mockResolvedValue(session);
    const result = await client.checkout.sessions.retrieve('cs_1');
    expect(result).toEqual(session);
  });
});

describe('createProtectedStripe  -  billingPortal.sessions', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('billingPortal.sessions.create delegates to stripe instance', async () => {
    const portalSession = { id: 'bps_1', url: 'https://billing.stripe.com' };
    mockStripe.billingPortal.sessions.create.mockResolvedValue(portalSession);
    const result = await client.billingPortal.sessions.create({
      customer: 'cus_1',
      return_url: 'https://example.com',
    });
    expect(result).toEqual(portalSession);
  });
});

describe('createProtectedStripe  -  webhooks and balance getters', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('webhooks getter returns the stripe webhooks object', () => {
    expect(client.webhooks).toBe(mockStripe.webhooks);
  });

  it('balance getter returns the stripe balance object', () => {
    expect(client.balance).toBe(mockStripe.balance);
  });
});

describe('createProtectedStripe  -  error propagation', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('propagates non-retryable errors from products.create', async () => {
    mockStripe.products.create.mockRejectedValue(new Error('Your card number is incorrect. [400]'));
    await expect(client.products.create({ name: 'Bad' })).rejects.toThrow();
  });

  it('propagates non-retryable errors from subscriptions.cancel', async () => {
    mockStripe.subscriptions.cancel.mockRejectedValue(new Error('No such subscription [404]'));
    await expect(client.subscriptions.cancel('sub_bad')).rejects.toThrow();
  });

  it('propagates non-retryable errors from prices.list', async () => {
    mockStripe.prices.list.mockRejectedValue(new Error('Invalid API key [401]'));
    await expect(client.prices.list()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GAP-131 — extended surface: charges, transfers, accounts, accountLinks,
// events, billing.meterEvents (consumed by webhooks, marketplace, crons,
// drain-unreconciled, billing.ts overage reporter)
// ---------------------------------------------------------------------------

describe('createProtectedStripe  -  charges', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('charges.retrieve delegates to stripe instance', async () => {
    const charge = { id: 'ch_1', object: 'charge', amount: 999 };
    mockStripe.charges.retrieve.mockResolvedValue(charge);
    const result = await client.charges.retrieve('ch_1');
    expect(result).toEqual(charge);
    expect(mockStripe.charges.retrieve).toHaveBeenCalledWith('ch_1');
  });
});

describe('createProtectedStripe  -  transfers', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('transfers.create delegates to stripe instance', async () => {
    const transfer = { id: 'tr_1', object: 'transfer', amount: 5000 };
    mockStripe.transfers.create.mockResolvedValue(transfer);
    const result = await client.transfers.create({
      amount: 5000,
      currency: 'usd',
      destination: 'acct_1',
    });
    expect(result).toEqual(transfer);
    expect(mockStripe.transfers.create).toHaveBeenCalledWith(
      { amount: 5000, currency: 'usd', destination: 'acct_1' },
      undefined,
    );
  });

  it('transfers.create propagates non-retryable errors', async () => {
    mockStripe.transfers.create.mockRejectedValue(
      new Error('Insufficient available balance [402]'),
    );
    await expect(
      client.transfers.create({ amount: 5000, currency: 'usd', destination: 'acct_1' }),
    ).rejects.toThrow();
  });
});

describe('createProtectedStripe  -  accounts and accountLinks', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('accounts.create delegates to stripe instance', async () => {
    const account = { id: 'acct_1', object: 'account', type: 'express' };
    mockStripe.accounts.create.mockResolvedValue(account);
    const result = await client.accounts.create({ type: 'express' });
    expect(result).toEqual(account);
    expect(mockStripe.accounts.create).toHaveBeenCalledWith({ type: 'express' }, undefined);
  });

  it('accountLinks.create delegates to stripe instance', async () => {
    const link = { object: 'account_link', url: 'https://connect.stripe.com/setup/...' };
    mockStripe.accountLinks.create.mockResolvedValue(link);
    const result = await client.accountLinks.create({
      account: 'acct_1',
      refresh_url: 'https://example.com/refresh',
      return_url: 'https://example.com/return',
      type: 'account_onboarding',
    });
    expect(result).toEqual(link);
  });
});

describe('createProtectedStripe  -  events', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('events.retrieve delegates to stripe instance', async () => {
    const event = { id: 'evt_1', object: 'event', type: 'customer.subscription.updated' };
    mockStripe.events.retrieve.mockResolvedValue(event);
    const result = await client.events.retrieve('evt_1');
    expect(result).toEqual(event);
    expect(mockStripe.events.retrieve).toHaveBeenCalledWith('evt_1');
  });
});

describe('createProtectedStripe  -  billing.meterEvents', () => {
  let mockStripe: ReturnType<typeof buildMockStripe>;
  let client: ReturnType<typeof createProtectedStripe>;

  beforeEach(() => {
    mockStripe = buildMockStripe();
    // biome-ignore lint/suspicious/noExplicitAny: test DI
    client = createProtectedStripe(mockStripe as any);
  });

  it('billing.meterEvents.create delegates to stripe instance with options', async () => {
    const event = { object: 'billing.meter_event', event_name: 'agent_task_overage' };
    mockStripe.billing.meterEvents.create.mockResolvedValue(event);
    const result = await client.billing.meterEvents.create(
      {
        event_name: 'agent_task_overage',
        payload: { stripe_customer_id: 'cus_1', value: '42' },
      },
      { idempotencyKey: 'overage-user-1' },
    );
    expect(result).toEqual(event);
    expect(mockStripe.billing.meterEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: 'agent_task_overage' }),
      { idempotencyKey: 'overage-user-1' },
    );
  });
});
