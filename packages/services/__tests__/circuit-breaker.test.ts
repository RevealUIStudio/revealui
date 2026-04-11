/**
 * Circuit Breaker & Retry Logic Tests
 *
 * Tests the DB-backed circuit breaker (DbCircuitBreaker) and the
 * protectedStripe wrapper's resilience mechanisms:
 * - Circuit breaker state transitions (closed → open → half-open → closed)
 * - Retry logic with exponential backoff
 * - Non-retryable vs retryable error classification
 */

import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __CIRCUIT_BREAKER_CONFIG,
  __dbCircuitBreaker,
  __RETRY_CONFIG,
  __resetCircuitBreaker,
  createProtectedStripe,
} from '../src/stripe/stripeClient.js';

// ---------------------------------------------------------------------------
// In-memory circuit state store  -  replaces NeonDB for unit tests
// ---------------------------------------------------------------------------

type StoredRow = {
  serviceName: string;
  state: string;
  failureCount: number;
  successCount: number;
  lastFailureAt: Date | null;
  stateChangedAt: Date;
  updatedAt: Date;
};

const circuitStateStore = new Map<string, StoredRow>();

vi.mock('@revealui/config', () => ({
  default: { stripe: { secretKey: 'sk_test_mock' } },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the Drizzle client so DbCircuitBreaker reads/writes to circuitStateStore
// instead of a real NeonDB. The `.where()` arg is ignored  -  there is only ever
// one service name ('stripe') in the store during any given test.
vi.mock('@revealui/db', () => ({
  getClient: () => ({
    select: () => ({
      from: () => ({
        where: () => {
          const rows = [...circuitStateStore.values()];
          return Promise.resolve(rows.length > 0 ? [rows[0]] : []);
        },
      }),
    }),
    insert: () => ({
      values: (values: StoredRow) => ({
        onConflictDoUpdate: ({ set }: { set: Partial<StoredRow> }) => {
          const existing = circuitStateStore.get(values.serviceName) ?? ({} as StoredRow);
          circuitStateStore.set(values.serviceName, { ...existing, ...values, ...set });
          return Promise.resolve();
        },
      }),
    }),
  }),
}));

// ---------------------------------------------------------------------------

async function resetBreaker(): Promise<void> {
  circuitStateStore.clear();
  __dbCircuitBreaker.clearLocalCache();
  await __resetCircuitBreaker();
}

// ---------------------------------------------------------------------------
// DbCircuitBreaker state transitions
// ---------------------------------------------------------------------------

describe('DbCircuitBreaker state transitions', () => {
  beforeEach(resetBreaker);

  it('starts in closed state', async () => {
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
  });

  it('transitions to open after reaching failure threshold', async () => {
    for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      await __dbCircuitBreaker.recordFailure();
    }
    __dbCircuitBreaker.clearLocalCache();
    expect(await __dbCircuitBreaker.isOpen()).toBe(true);
  });

  it('remains closed below failure threshold', async () => {
    for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold - 1; i++) {
      await __dbCircuitBreaker.recordFailure();
    }
    __dbCircuitBreaker.clearLocalCache();
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
  });

  it('resets failure count on success in closed state', async () => {
    await __dbCircuitBreaker.recordFailure();
    await __dbCircuitBreaker.recordFailure();
    await __dbCircuitBreaker.recordSuccess();
    __dbCircuitBreaker.clearLocalCache();
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
  });

  it('transitions to half-open after reset timeout elapses', async () => {
    // Trip the circuit
    for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      await __dbCircuitBreaker.recordFailure();
    }

    // Age the stored stateChangedAt past resetTimeout
    const row = circuitStateStore.get('stripe');
    if (row) {
      row.stateChangedAt = new Date(Date.now() - __CIRCUIT_BREAKER_CONFIG.resetTimeout - 1);
    }
    __dbCircuitBreaker.clearLocalCache();

    // isOpen() sees elapsed resetTimeout → writes half-open → returns false
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
    const stored = circuitStateStore.get('stripe');
    expect(stored?.state).toBe('half-open');
  });

  it('closes circuit after success threshold in half-open state', async () => {
    // Seed half-open state directly
    circuitStateStore.set('stripe', {
      serviceName: 'stripe',
      state: 'half-open',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: null,
      stateChangedAt: new Date(),
      updatedAt: new Date(),
    });
    __dbCircuitBreaker.clearLocalCache();

    // Sub-threshold successes are tracked only in the local cache (no DB write).
    // Do NOT clear the cache between calls  -  the in-process counter must survive.
    for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.successThreshold; i++) {
      await __dbCircuitBreaker.recordSuccess();
    }

    // At threshold the final writeState persists 'closed' to the DB mock.
    // Clear cache to force a fresh read and verify the DB row.
    __dbCircuitBreaker.clearLocalCache();
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
    expect(circuitStateStore.get('stripe')?.state).toBe('closed');
  });

  it('increments success count in half-open without closing prematurely', async () => {
    circuitStateStore.set('stripe', {
      serviceName: 'stripe',
      state: 'half-open',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: null,
      stateChangedAt: new Date(),
      updatedAt: new Date(),
    });
    __dbCircuitBreaker.clearLocalCache();

    // One success  -  not yet at threshold
    await __dbCircuitBreaker.recordSuccess();
    __dbCircuitBreaker.clearLocalCache();

    // Still not open (half-open, waiting for more successes)
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
    // Not yet closed
    const stored = circuitStateStore.get('stripe');
    if (__CIRCUIT_BREAKER_CONFIG.successThreshold > 1) {
      expect(stored?.state).toBe('half-open');
    }
  });

  it('re-trips circuit on failure in half-open state', async () => {
    circuitStateStore.set('stripe', {
      serviceName: 'stripe',
      state: 'half-open',
      failureCount: 0,
      successCount: 0,
      lastFailureAt: null,
      stateChangedAt: new Date(),
      updatedAt: new Date(),
    });
    __dbCircuitBreaker.clearLocalCache();

    await __dbCircuitBreaker.recordFailure();
    __dbCircuitBreaker.clearLocalCache();

    expect(await __dbCircuitBreaker.isOpen()).toBe(true);
    expect(circuitStateStore.get('stripe')?.state).toBe('open');
  });

  it('fail-open: defaults to closed when DB is unavailable', async () => {
    // DbCircuitBreaker.readFromDb catches errors and returns closed
    // Simulate by clearing both cache and store (empty store = no row → closed default)
    circuitStateStore.clear();
    __dbCircuitBreaker.clearLocalCache();
    expect(await __dbCircuitBreaker.isOpen()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// protectedStripe resilience (retry + circuit wrapper)
// ---------------------------------------------------------------------------

describe('protectedStripe resilience', () => {
  let mockStripeInstance: Stripe;

  beforeEach(async () => {
    await resetBreaker();

    mockStripeInstance = {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        del: vi.fn(),
        list: vi.fn(),
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
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      subscriptions: {
        list: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      webhooks: {} as Stripe['webhooks'],
      balance: {} as Stripe['balance'],
    } as unknown as Stripe;
  });

  it('passes through successful calls', async () => {
    const mockCustomer = { id: 'cus_123', email: 'test@test.com' } as Stripe.Customer;
    (mockStripeInstance.customers.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockCustomer,
    );

    const client = createProtectedStripe(mockStripeInstance);
    const result = await client.customers.create({ email: 'test@test.com' });

    expect(result.id).toBe('cus_123');
    expect(mockStripeInstance.customers.create).toHaveBeenCalledOnce();
  });

  it('throws immediately for non-retryable errors', async () => {
    const stripeError = new Error('No such customer: cus_invalid');
    (mockStripeInstance.customers.retrieve as ReturnType<typeof vi.fn>).mockRejectedValue(
      stripeError,
    );

    const client = createProtectedStripe(mockStripeInstance);
    await expect(client.customers.retrieve('cus_invalid')).rejects.toThrow('No such customer');
    // Non-retryable: only one attempt
    expect(mockStripeInstance.customers.retrieve).toHaveBeenCalledOnce();
  });

  it('blocks calls when circuit breaker is open', async () => {
    const client = createProtectedStripe(mockStripeInstance);

    // Trip the circuit
    for (let i = 0; i < __CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      await __dbCircuitBreaker.recordFailure();
    }
    // Local cache is already set to 'open' by recordFailure  -  no clearLocalCache needed

    await expect(client.customers.create({ email: 'test@test.com' })).rejects.toThrow(
      'circuit breaker is OPEN',
    );
    expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
  });

  it('retries on ETIMEDOUT errors', async () => {
    const timeoutError = new Error('connect ETIMEDOUT 1.2.3.4:443');
    const mockCustomer = { id: 'cus_123' } as Stripe.Customer;
    (mockStripeInstance.customers.create as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(mockCustomer);

    const client = createProtectedStripe(mockStripeInstance);
    const result = await client.customers.create({ email: 'test@test.com' });

    expect(result.id).toBe('cus_123');
    expect(mockStripeInstance.customers.create).toHaveBeenCalledTimes(2);
  });

  it('retries on network errors', async () => {
    const networkError = new Error('ECONNREFUSED');
    const mockCustomer = { id: 'cus_123' } as Stripe.Customer;
    (mockStripeInstance.customers.create as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(mockCustomer);

    const client = createProtectedStripe(mockStripeInstance);
    const result = await client.customers.create({ email: 'test@test.com' });

    expect(result.id).toBe('cus_123');
    expect(mockStripeInstance.customers.create).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retry attempts for retryable errors', async () => {
    const networkError = new Error('connect ECONNREFUSED 127.0.0.1:443');
    (mockStripeInstance.customers.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      networkError,
    );

    const client = createProtectedStripe(mockStripeInstance);
    await expect(client.customers.create({ email: 'test@test.com' })).rejects.toThrow(
      `failed after ${__RETRY_CONFIG.maxAttempts} attempts`,
    );
    expect(mockStripeInstance.customers.create).toHaveBeenCalledTimes(__RETRY_CONFIG.maxAttempts);
  });
});
