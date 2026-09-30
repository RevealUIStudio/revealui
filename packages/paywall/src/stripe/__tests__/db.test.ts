import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ensureStripeCustomer,
  getHostedSubscriptionSnapshot,
  resolveCatalogPriceId,
  resolveHostedStripeCustomerId,
} from '../index.js';
import { PaywallBillingError, type PgPoolLike, type ProtectedStripe } from '../types.js';

const columns = vi.hoisted(() => ({
  billingCatalog: {
    stripePriceId: 'billingCatalog.stripePriceId',
    planId: 'billingCatalog.planId',
    tier: 'billingCatalog.tier',
    billingModel: 'billingCatalog.billingModel',
    mode: 'billingCatalog.mode',
    active: 'billingCatalog.active',
  },
  accountMemberships: {
    accountId: 'accountMemberships.accountId',
    userId: 'accountMemberships.userId',
    status: 'accountMemberships.status',
  },
  accountEntitlements: {
    tier: 'accountEntitlements.tier',
    status: 'accountEntitlements.status',
    graceUntil: 'accountEntitlements.graceUntil',
    accountId: 'accountEntitlements.accountId',
    mode: 'accountEntitlements.mode',
  },
  accountSubscriptions: {
    stripeCustomerId: 'accountSubscriptions.stripeCustomerId',
    accountId: 'accountSubscriptions.accountId',
  },
  users: {
    stripeCustomerId: 'users.stripeCustomerId',
    id: 'users.id',
    updatedAt: 'users.updatedAt',
  },
}));

const state = vi.hoisted(() => ({
  mode: 'test' as 'test' | 'live',
  eqCalls: [] as Array<{ left: unknown; right: unknown }>,
  isNullCalls: [] as unknown[],
}));

vi.mock('@revealui/config/stripe-mode', () => ({
  getConfiguredStripeMode: () => state.mode,
}));

vi.mock('@revealui/db/schema', () => columns);

vi.mock('drizzle-orm', () => ({
  and: (...parts: unknown[]) => ({ type: 'and', parts }),
  eq: (left: unknown, right: unknown) => {
    state.eqCalls.push({ left, right });
    return { type: 'eq', left, right };
  },
  isNull: (column: unknown) => {
    state.isNullCalls.push(column);
    return { type: 'isNull', column };
  },
}));

interface LimitableRows extends Promise<unknown[]> {
  limit: (count: number) => Promise<unknown[]>;
}

function queryResult(data: unknown[]): LimitableRows {
  const promise = Promise.resolve(data) as LimitableRows;
  promise.limit = () => promise;
  return promise;
}

function createDb(selects: unknown[][]) {
  const queue = [...selects];
  const updates: Array<Record<string, unknown>> = [];
  const wheres: unknown[] = [];
  const db = {
    select() {
      return {
        from() {
          return {
            where(clause: unknown) {
              wheres.push(clause);
              return queryResult(queue.shift() ?? []);
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          updates.push(values);
          return {
            where(clause: unknown) {
              wheres.push(clause);
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { db, updates, wheres };
}

type PaywallDb = Parameters<typeof resolveCatalogPriceId>[0];

function asDb(db: ReturnType<typeof createDb>['db']): PaywallDb {
  return db as unknown as PaywallDb;
}

function eqValues(column: string): unknown[] {
  return state.eqCalls.filter((call) => call.left === column).map((call) => call.right);
}

function createStripe(
  retrieve: ProtectedStripe['customers']['retrieve'] = async () => ({ id: 'cus_stored' }),
): ProtectedStripe {
  return {
    customers: {
      retrieve: vi.fn(retrieve),
      create: vi.fn(async () => ({ id: 'cus_created' })),
    },
    refunds: { create: vi.fn() },
    billing: { meterEvents: { create: vi.fn() } },
    subscriptions: { create: vi.fn() },
  };
}

interface QueryStep {
  match: (sql: string) => boolean;
  rows?: Array<Record<string, unknown>>;
  error?: Error;
}

function createPool(steps: QueryStep[]): {
  pool: PgPoolLike;
  calls: Array<{ sql: string; params?: unknown[] }>;
  released: () => number;
} {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let releases = 0;
  const client = {
    async query(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      const step = steps.find((item) => item.match(sql));
      if (!step) throw new Error(`unexpected query: ${sql}`);
      if (step.error) throw step.error;
      return { rows: step.rows ?? [] };
    },
    release() {
      releases += 1;
    },
  };
  return {
    pool: { connect: async () => client },
    calls,
    released: () => releases,
  };
}

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('resolveCatalogPriceId', () => {
  beforeEach(() => {
    state.mode = 'test';
    state.eqCalls.length = 0;
    state.isNullCalls.length = 0;
  });

  it('returns the catalog price for a monthly subscription', async () => {
    const { db } = createDb([[{ stripePriceId: 'price_pro_month' }]]);
    await expect(resolveCatalogPriceId(asDb(db), 'pro', 'subscription')).resolves.toBe(
      'price_pro_month',
    );
    expect(eqValues(columns.billingCatalog.planId)).toEqual(['subscription:pro']);
    expect(eqValues(columns.billingCatalog.tier)).toEqual(['pro']);
    expect(eqValues(columns.billingCatalog.billingModel)).toEqual(['subscription']);
    expect(eqValues(columns.billingCatalog.mode)).toEqual(['test']);
    expect(eqValues(columns.billingCatalog.active)).toEqual([true]);
  });

  it('uses a yearly plan id only for subscriptions', async () => {
    const yearly = createDb([[{ stripePriceId: 'price_pro_year' }]]);
    await expect(
      resolveCatalogPriceId(asDb(yearly.db), 'pro', 'subscription', undefined, 'year'),
    ).resolves.toBe('price_pro_year');
    expect(eqValues(columns.billingCatalog.planId)).toEqual(['subscription:pro:year']);

    state.eqCalls.length = 0;
    const credits = createDb([[{ stripePriceId: 'price_credits' }]]);
    await expect(
      resolveCatalogPriceId(asDb(credits.db), 'max', 'credits', undefined, 'year'),
    ).resolves.toBe('price_credits');
    expect(eqValues(columns.billingCatalog.planId)).toEqual(['credits:max']);
  });

  it('accepts a requested price that matches after trimming', async () => {
    const { db } = createDb([[{ stripePriceId: 'price_pro_month' }]]);
    await expect(
      resolveCatalogPriceId(asDb(db), 'pro', 'subscription', '  price_pro_month  '),
    ).resolves.toBe('price_pro_month');
  });

  it('ignores a blank requested price', async () => {
    const { db } = createDb([[{ stripePriceId: 'price_pro_month' }]]);
    await expect(resolveCatalogPriceId(asDb(db), 'pro', 'subscription', '   ')).resolves.toBe(
      'price_pro_month',
    );
  });

  it('rejects a requested price that does not match the catalog', async () => {
    const { db } = createDb([[{ stripePriceId: 'price_pro_month' }]]);
    await expect(
      resolveCatalogPriceId(asDb(db), 'pro', 'subscription', 'price_other'),
    ).rejects.toMatchObject({
      name: 'PaywallBillingError',
      status: 400,
      message: 'Requested price does not match the server billing catalog.',
    });
  });

  it('fails when the catalog row is missing for the configured mode', async () => {
    state.mode = 'live';
    const missing = createDb([[]]);
    await expect(resolveCatalogPriceId(asDb(missing.db), 'enterprise', 'renewal')).rejects.toEqual(
      expect.any(PaywallBillingError),
    );
    await expect(
      resolveCatalogPriceId(asDb(missing.db), 'enterprise', 'renewal'),
    ).rejects.toMatchObject({
      status: 500,
      message: 'Billing catalog is not configured for renewal enterprise (live mode)',
    });

    const blank = createDb([[{ stripePriceId: '' }]]);
    await expect(resolveCatalogPriceId(asDb(blank.db), 'pro', 'perpetual')).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe('getHostedSubscriptionSnapshot', () => {
  beforeEach(() => {
    state.mode = 'test';
    state.eqCalls.length = 0;
  });

  it('returns null when the buyer has no active membership', async () => {
    const empty = createDb([[]]);
    await expect(getHostedSubscriptionSnapshot(asDb(empty.db), 'buyer_1')).resolves.toBeNull();

    const blank = createDb([[{ accountId: '' }]]);
    await expect(getHostedSubscriptionSnapshot(asDb(blank.db), 'buyer_1')).resolves.toBeNull();
  });

  it('returns null when the account has no entitlement tier', async () => {
    const missing = createDb([[{ accountId: 'acct_1' }], []]);
    await expect(getHostedSubscriptionSnapshot(asDb(missing.db), 'buyer_1')).resolves.toBeNull();

    const untitled = createDb([[{ accountId: 'acct_1' }], [{ tier: '', status: 'active' }]]);
    await expect(getHostedSubscriptionSnapshot(asDb(untitled.db), 'buyer_1')).resolves.toBeNull();
  });

  it('returns the entitlement without opening a grace period for a healthy status', async () => {
    const { db } = createDb([
      [{ accountId: 'acct_1' }],
      [{ tier: 'pro', status: 'active', graceUntil: future }],
    ]);
    await expect(getHostedSubscriptionSnapshot(asDb(db), 'buyer_1')).resolves.toEqual({
      tier: 'pro',
      status: 'active',
      graceUntil: future.toISOString(),
    });
    expect(eqValues(columns.accountMemberships.userId)).toEqual(['buyer_1']);
    expect(eqValues(columns.accountMemberships.status)).toEqual(['active']);
    expect(eqValues(columns.accountEntitlements.mode)).toEqual(['test']);
  });

  it('returns a null grace timestamp when none is stored', async () => {
    const { db } = createDb([
      [{ accountId: 'acct_1' }],
      [{ tier: 'free', status: 'trialing', graceUntil: null }],
    ]);
    await expect(getHostedSubscriptionSnapshot(asDb(db), 'buyer_1')).resolves.toEqual({
      tier: 'free',
      status: 'trialing',
      graceUntil: null,
    });
  });

  it('promotes past-due, canceled, and revoked rows that are still inside grace', async () => {
    for (const status of ['past_due', 'canceled', 'revoked'] as const) {
      const { db } = createDb([
        [{ accountId: 'acct_1' }],
        [{ tier: 'max', status, graceUntil: future }],
      ]);
      await expect(getHostedSubscriptionSnapshot(asDb(db), 'buyer_1')).resolves.toMatchObject({
        tier: 'max',
        status: 'grace_period',
      });
    }
  });

  it('keeps an expired or missing grace window on the stored status', async () => {
    const expired = createDb([
      [{ accountId: 'acct_1' }],
      [{ tier: 'pro', status: 'past_due', graceUntil: past }],
    ]);
    await expect(getHostedSubscriptionSnapshot(asDb(expired.db), 'buyer_1')).resolves.toMatchObject(
      {
        status: 'past_due',
      },
    );

    const missingGrace = createDb([
      [{ accountId: 'acct_1' }],
      [{ tier: 'pro', status: 'canceled', graceUntil: null }],
    ]);
    await expect(
      getHostedSubscriptionSnapshot(asDb(missingGrace.db), 'buyer_1'),
    ).resolves.toMatchObject({
      status: 'canceled',
      graceUntil: null,
    });
  });
});

describe('resolveHostedStripeCustomerId', () => {
  beforeEach(() => {
    state.eqCalls.length = 0;
  });

  it('returns the subscription customer for an explicit account', async () => {
    const { db } = createDb([[{ stripeCustomerId: 'cus_account' }]]);
    await expect(resolveHostedStripeCustomerId(asDb(db), 'buyer_1', 'acct_1')).resolves.toBe(
      'cus_account',
    );
    expect(eqValues(columns.accountSubscriptions.accountId)).toEqual(['acct_1']);
  });

  it('falls back to the buyer row when the account subscription has no customer', async () => {
    const emptySub = createDb([[], [{ stripeCustomerId: 'cus_buyer' }]]);
    await expect(
      resolveHostedStripeCustomerId(asDb(emptySub.db), 'buyer_1', 'acct_1'),
    ).resolves.toBe('cus_buyer');

    const blankSub = createDb([[{ stripeCustomerId: '' }], [{ stripeCustomerId: 'cus_buyer' }]]);
    await expect(
      resolveHostedStripeCustomerId(asDb(blankSub.db), 'buyer_1', 'acct_1'),
    ).resolves.toBe('cus_buyer');
  });

  it('looks up the active membership when no account id is provided', async () => {
    const { db } = createDb([[{ accountId: 'acct_found' }], [{ stripeCustomerId: 'cus_member' }]]);
    await expect(resolveHostedStripeCustomerId(asDb(db), 'buyer_1', null)).resolves.toBe(
      'cus_member',
    );
    expect(eqValues(columns.accountMemberships.userId)).toEqual(['buyer_1']);
  });

  it('returns the buyer customer when membership lookup finds nothing', async () => {
    const { db } = createDb([[], [{ stripeCustomerId: 'cus_buyer' }]]);
    await expect(resolveHostedStripeCustomerId(asDb(db), 'buyer_1')).resolves.toBe('cus_buyer');
  });

  it('returns null when neither account nor buyer has a customer id', async () => {
    const none = createDb([[], []]);
    await expect(resolveHostedStripeCustomerId(asDb(none.db), 'buyer_1', '')).resolves.toBeNull();

    const nullId = createDb([
      [{ accountId: 'acct_1' }],
      [{ stripeCustomerId: null }],
      [{ stripeCustomerId: null }],
    ]);
    await expect(resolveHostedStripeCustomerId(asDb(nullId.db), 'buyer_1')).resolves.toBeNull();
  });
});

describe('ensureStripeCustomer', () => {
  beforeEach(() => {
    state.eqCalls.length = 0;
    state.isNullCalls.length = 0;
  });

  it('reuses a stored customer that the provider still accepts', async () => {
    const stripe = createStripe(async () => ({ id: 'cus_stored' }));
    const { db, updates } = createDb([[{ stripeCustomerId: 'cus_stored' }]]);
    await expect(
      ensureStripeCustomer(asDb(db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_stored');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(stripe.customers.retrieve).toHaveBeenCalledWith('cus_stored');
  });

  it('clears a deleted customer and creates a replacement without a pool', async () => {
    const stripe = createStripe(async () => ({ id: 'cus_old', deleted: true }));
    const { db, updates } = createDb([
      [{ stripeCustomerId: 'cus_old' }],
      [{ stripeCustomerId: 'cus_created' }],
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_created');
    expect(updates[0]?.stripeCustomerId).toBeNull();
    expect(updates[0]?.updatedAt).toBeInstanceOf(Date);
    expect(stripe.customers.create).toHaveBeenCalledWith(
      { email: 'buyer@example.com', metadata: { revealui_user_id: 'buyer_1' } },
      { idempotencyKey: 'create-customer-buyer_1' },
    );
    expect(state.isNullCalls).toContain(columns.users.stripeCustomerId);
  });

  it('treats a retrieve failure as an unusable customer', async () => {
    const stripe = createStripe(async () => {
      throw new Error('missing customer');
    });
    const { db, updates } = createDb([[{ stripeCustomerId: 'cus_gone' }], []]);
    await expect(
      ensureStripeCustomer(asDb(db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_created');
    expect(updates[0]?.stripeCustomerId).toBeNull();
  });

  it('creates a customer when none is stored and returns the id written back', async () => {
    const stripe = createStripe();
    const { db, updates } = createDb([[], [{ stripeCustomerId: 'cus_winner' }]]);
    await expect(
      ensureStripeCustomer(asDb(db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_winner');
    expect(updates[0]?.stripeCustomerId).toBe('cus_created');
  });

  it('returns the created id when the follow-up read is empty', async () => {
    const stripe = createStripe();
    const blank = createDb([[{ stripeCustomerId: '' }], []]);
    await expect(
      ensureStripeCustomer(asDb(blank.db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_created');

    const missingUser = createDb([[], [{ stripeCustomerId: null }]]);
    await expect(
      ensureStripeCustomer(asDb(missingUser.db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_created');
  });

  it('propagates a create failure before writing a customer id', async () => {
    const stripe = createStripe();
    vi.mocked(stripe.customers.create).mockRejectedValue(new Error('create failed'));
    const { db, updates } = createDb([[]]);
    await expect(
      ensureStripeCustomer(asDb(db), null, stripe, 'buyer_1', 'buyer@example.com'),
    ).rejects.toThrow('create failed');
    expect(updates).toHaveLength(0);
  });

  it('returns a customer another worker stored inside the lock', async () => {
    const stripe = createStripe();
    const { db } = createDb([[]]);
    const pool = createPool([
      { match: (sql) => sql === 'BEGIN' },
      { match: (sql) => sql.includes('pg_advisory_xact_lock') },
      {
        match: (sql) => sql.includes('SELECT stripe_customer_id'),
        rows: [{ stripe_customer_id: 'cus_locked' }],
      },
      { match: (sql) => sql === 'COMMIT' },
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), pool.pool, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_locked');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(pool.calls[1]?.params).toEqual(['stripe:ensure:buyer_1']);
    expect(pool.released()).toBe(1);
  });

  it('creates and stores a customer under the advisory lock', async () => {
    const stripe = createStripe();
    const { db } = createDb([[{ stripeCustomerId: null }]]);
    const pool = createPool([
      { match: (sql) => sql === 'BEGIN' },
      { match: (sql) => sql.includes('pg_advisory_xact_lock') },
      { match: (sql) => sql.includes('SELECT stripe_customer_id'), rows: [{}] },
      { match: (sql) => sql.includes('UPDATE users') },
      { match: (sql) => sql === 'COMMIT' },
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), pool.pool, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_created');
    const update = pool.calls.find((call) => call.sql.includes('UPDATE users'));
    expect(update?.params).toEqual(['cus_created', 'buyer_1']);
    expect(pool.released()).toBe(1);
  });

  it('creates when the locked row has an empty customer id', async () => {
    const stripe = createStripe();
    const { db } = createDb([[]]);
    const pool = createPool([
      { match: (sql) => sql === 'BEGIN' },
      { match: (sql) => sql.includes('pg_advisory_xact_lock') },
      {
        match: (sql) => sql.includes('SELECT stripe_customer_id'),
        rows: [{ stripe_customer_id: '' }],
      },
      { match: (sql) => sql.includes('UPDATE users') },
      { match: (sql) => sql === 'COMMIT' },
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), pool.pool, stripe, 'buyer_1', 'buyer@example.com'),
    ).resolves.toBe('cus_created');
  });

  it('rolls back and rethrows when customer creation fails inside the lock', async () => {
    const stripe = createStripe();
    vi.mocked(stripe.customers.create).mockRejectedValue(new Error('provider down'));
    const { db } = createDb([[]]);
    const pool = createPool([
      { match: (sql) => sql === 'BEGIN' },
      { match: (sql) => sql.includes('pg_advisory_xact_lock') },
      { match: (sql) => sql.includes('SELECT stripe_customer_id'), rows: [] },
      { match: (sql) => sql === 'ROLLBACK' },
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), pool.pool, stripe, 'buyer_1', 'buyer@example.com'),
    ).rejects.toThrow('provider down');
    expect(pool.calls.some((call) => call.sql === 'ROLLBACK')).toBe(true);
    expect(pool.released()).toBe(1);
  });

  it('still rethrows the original error when rollback fails', async () => {
    const stripe = createStripe();
    vi.mocked(stripe.customers.create).mockRejectedValue(new Error('provider down'));
    const { db } = createDb([[]]);
    const pool = createPool([
      { match: (sql) => sql === 'BEGIN' },
      { match: (sql) => sql.includes('pg_advisory_xact_lock') },
      { match: (sql) => sql.includes('SELECT stripe_customer_id'), rows: [] },
      { match: (sql) => sql === 'ROLLBACK', error: new Error('rollback failed') },
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), pool.pool, stripe, 'buyer_1', 'buyer@example.com'),
    ).rejects.toThrow('provider down');
    expect(pool.released()).toBe(1);
  });

  it('rolls back when the transaction cannot begin', async () => {
    const stripe = createStripe();
    const { db } = createDb([[]]);
    const pool = createPool([
      { match: (sql) => sql === 'BEGIN', error: new Error('begin failed') },
      { match: (sql) => sql === 'ROLLBACK' },
    ]);
    await expect(
      ensureStripeCustomer(asDb(db), pool.pool, stripe, 'buyer_1', 'buyer@example.com'),
    ).rejects.toThrow('begin failed');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(pool.released()).toBe(1);
  });
});
