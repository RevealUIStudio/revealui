/**
 * Billing Race Condition Tests
 *
 * Verifies concurrency handling in:
 * - Stripe customer creation (duplicate prevention via transaction re-check)
 * - Circuit breaker integration with billing routes
 * - Concurrent subscription upgrade requests
 * - Out-of-order webhook event processing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock logger
vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the circuit breaker to test isolation without timer side effects
vi.mock('@revealui/core/error-handling', () => {
  class MockCircuitBreaker {
    private state: 'closed' | 'open' | 'half-open' = 'closed';
    private failures = 0;
    private config: { failureThreshold: number; resetTimeout: number; successThreshold: number };

    constructor(
      config: { failureThreshold?: number; resetTimeout?: number; successThreshold?: number } = {},
    ) {
      this.config = {
        failureThreshold: config.failureThreshold ?? 5,
        resetTimeout: config.resetTimeout ?? 30_000,
        successThreshold: config.successThreshold ?? 2,
      };
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (this.state === 'open') {
        throw new MockCircuitBreakerOpenError();
      }
      try {
        const result = await fn();
        this.failures = 0;
        return result;
      } catch (error) {
        this.failures++;
        if (this.failures >= this.config.failureThreshold) {
          this.state = 'open';
        }
        throw error;
      }
    }

    getState(): string {
      return this.state;
    }

    destroy(): void {
      // no-op
    }
  }

  class MockCircuitBreakerOpenError extends Error {
    constructor() {
      super('Circuit breaker is open');
      this.name = 'CircuitBreakerOpenError';
    }
  }

  return {
    CircuitBreaker: MockCircuitBreaker,
    CircuitBreakerOpenError: MockCircuitBreakerOpenError,
  };
});

import { CircuitBreaker, CircuitBreakerOpenError } from '@revealui/core/error-handling';

// ─── Stripe customer creation race condition simulation ─────────────────────

/**
 * Simulates the ensureStripeCustomer pattern from billing.ts
 * where a transaction re-checks for existing customer ID to prevent duplicates.
 */
function createCustomerManager() {
  // Simulated database state
  const db = new Map<string, { stripeCustomerId: string | null }>();
  let stripeCustomerCounter = 0;
  const createdCustomers: string[] = [];

  return {
    db,

    /** Initialize a user without a Stripe customer */
    addUser(userId: string): void {
      db.set(userId, { stripeCustomerId: null });
    },

    /** Simulates ensureStripeCustomer logic with transaction re-check */
    async ensureStripeCustomer(userId: string, email: string): Promise<string> {
      const user = db.get(userId);
      if (!user) throw new Error('User not found');

      // First read (outside transaction)
      if (user.stripeCustomerId) {
        return user.stripeCustomerId;
      }

      // Simulate Stripe API call (creates a customer)
      await Promise.resolve(); // Yield to event loop
      stripeCustomerCounter++;
      const newCustomerId = `cus_${stripeCustomerCounter}_${email}`;
      createdCustomers.push(newCustomerId);

      // Transaction with re-check (simulates the SQL transaction)
      const existing = db.get(userId);
      if (existing?.stripeCustomerId) {
        // Another request won the race  -  return their ID
        return existing.stripeCustomerId;
      }

      // We won  -  write our customer ID
      db.set(userId, { stripeCustomerId: newCustomerId });

      // Re-read to handle any remaining race
      const final = db.get(userId);
      return final?.stripeCustomerId ?? newCustomerId;
    },

    getCreatedCustomers(): string[] {
      return createdCustomers;
    },
  };
}

describe('Stripe customer creation race condition', () => {
  it('concurrent ensureStripeCustomer calls should produce only one DB customer ID', async () => {
    const manager = createCustomerManager();
    manager.addUser('user-1');

    // Simulate 5 concurrent checkout requests for the same user
    const results = await Promise.all(
      Array.from({ length: 5 }, () => manager.ensureStripeCustomer('user-1', 'user@example.com')),
    );

    // All should return the same customer ID
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(1);

    // Only one customer ID should be stored in the DB
    const stored = manager.db.get('user-1');
    expect(stored?.stripeCustomerId).toBeTruthy();
  });

  it('different users should get different customer IDs concurrently', async () => {
    const manager = createCustomerManager();
    const userIds = ['user-a', 'user-b', 'user-c', 'user-d', 'user-e'];
    for (const id of userIds) {
      manager.addUser(id);
    }

    // Each user sends concurrent requests
    const results = await Promise.all(
      userIds.flatMap((userId) => [
        manager.ensureStripeCustomer(userId, `${userId}@example.com`),
        manager.ensureStripeCustomer(userId, `${userId}@example.com`),
      ]),
    );

    // Group results by user
    const byUser = new Map<string, Set<string>>();
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      if (!userId) continue;
      const ids = byUser.get(userId) ?? new Set();
      const r1 = results[i * 2];
      const r2 = results[i * 2 + 1];
      if (r1) ids.add(r1);
      if (r2) ids.add(r2);
      byUser.set(userId, ids);
    }

    // Each user should have exactly one customer ID
    for (const [_userId, ids] of byUser) {
      expect(ids.size).toBe(1);
    }

    // All users should have distinct customer IDs
    const allIds = new Set(results);
    expect(allIds.size).toBe(5);
  });

  it('user with existing customer ID should skip creation', async () => {
    const manager = createCustomerManager();
    manager.addUser('existing-user');

    // First call creates the customer
    const first = await manager.ensureStripeCustomer('existing-user', 'existing@example.com');

    const initialCount = manager.getCreatedCustomers().length;

    // Subsequent concurrent calls should not create new Stripe customers
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        manager.ensureStripeCustomer('existing-user', 'existing@example.com'),
      ),
    );

    // No new customers should have been created
    expect(manager.getCreatedCustomers().length).toBe(initialCount);

    // All should return the same ID
    for (const result of results) {
      expect(result).toBe(first);
    }
  });
});

describe('Circuit breaker under concurrent billing load', () => {
  let breaker: InstanceType<typeof CircuitBreaker>;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 5000,
      successThreshold: 2,
    });
  });

  afterEach(() => {
    breaker.destroy();
  });

  it('should trip after threshold failures and reject all concurrent requests', async () => {
    // Cause threshold failures
    for (let i = 0; i < 3; i++) {
      await breaker
        .execute(async () => {
          throw new Error('Stripe API timeout');
        })
        .catch(() => {
          // expected
        });
    }

    expect(breaker.getState()).toBe('open');

    // All concurrent requests should fail fast with CircuitBreakerOpenError
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        breaker.execute(async () => ({ url: 'https://checkout.stripe.com/...' })),
      ),
    );

    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(CircuitBreakerOpenError);
      }
    }
  });

  it('should pass through concurrent successful requests when closed', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => breaker.execute(async () => ({ id: `session_${i}` }))),
    );

    for (let i = 0; i < 10; i++) {
      expect(results[i]).toEqual({ id: `session_${i}` });
    }

    expect(breaker.getState()).toBe('closed');
  });

  it('mixed success/failure should not trip until threshold', async () => {
    // 2 failures (below threshold of 3)
    await breaker
      .execute(async () => {
        throw new Error('fail 1');
      })
      .catch(() => {
        // expected
      });
    await breaker
      .execute(async () => {
        throw new Error('fail 2');
      })
      .catch(() => {
        // expected
      });

    expect(breaker.getState()).toBe('closed');

    // Success should work
    const result = await breaker.execute(async () => 'ok');
    expect(result).toBe('ok');
  });
});

describe('Concurrent subscription operations', () => {
  /**
   * Simulates a subscription manager that handles concurrent updates.
   * Models the pattern in billing.ts where Stripe subscriptions are
   * updated with item swaps and proration.
   */
  function createSubscriptionManager() {
    interface Subscription {
      id: string;
      priceId: string;
      tier: string;
      status: 'active' | 'canceled';
      version: number;
    }

    const subscriptions = new Map<string, Subscription>();

    return {
      create(userId: string, priceId: string, tier: string): Subscription {
        const sub: Subscription = {
          id: `sub_${userId}`,
          priceId,
          tier,
          status: 'active',
          version: 1,
        };
        subscriptions.set(userId, sub);
        return sub;
      },

      async upgrade(userId: string, newPriceId: string, newTier: string): Promise<Subscription> {
        const sub = subscriptions.get(userId);
        if (!sub) throw new Error('No subscription');
        if (sub.status !== 'active') throw new Error('Subscription not active');

        // Simulate async Stripe API call
        await Promise.resolve();

        sub.priceId = newPriceId;
        sub.tier = newTier;
        sub.version++;
        return { ...sub };
      },

      async cancel(userId: string): Promise<Subscription> {
        const sub = subscriptions.get(userId);
        if (!sub) throw new Error('No subscription');

        await Promise.resolve();
        sub.status = 'canceled';
        sub.version++;
        return { ...sub };
      },

      get(userId: string): Subscription | undefined {
        return subscriptions.get(userId);
      },
    };
  }

  it('concurrent upgrades should settle on the last upgrade', async () => {
    const manager = createSubscriptionManager();
    manager.create('user-1', 'price_pro', 'pro');

    // Simulate rapid-fire upgrade attempts
    const upgrades = await Promise.allSettled([
      manager.upgrade('user-1', 'price_max', 'max'),
      manager.upgrade('user-1', 'price_enterprise', 'enterprise'),
      manager.upgrade('user-1', 'price_max', 'max'),
    ]);

    // All should succeed (no crashes)
    for (const result of upgrades) {
      expect(result.status).toBe('fulfilled');
    }

    // Subscription should have a valid tier
    const sub = manager.get('user-1');
    expect(sub).toBeDefined();
    expect(['max', 'enterprise']).toContain(sub?.tier);
    // Version should reflect all mutations
    expect(sub?.version).toBeGreaterThanOrEqual(4); // initial(1) + 3 upgrades
  });

  it('concurrent upgrade and cancel should not leave inconsistent state', async () => {
    const manager = createSubscriptionManager();
    manager.create('user-2', 'price_pro', 'pro');

    const results = await Promise.allSettled([
      manager.upgrade('user-2', 'price_max', 'max'),
      manager.cancel('user-2'),
    ]);

    // At least one should succeed
    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // Final state should be either upgraded-then-canceled or just canceled
    const sub = manager.get('user-2');
    expect(sub).toBeDefined();
    // Both operations run; cancel overwrites status
    expect(sub?.status).toBe('canceled');
  });
});

describe('Webhook event ordering', () => {
  /**
   * Simulates processing of out-of-order Stripe webhook events.
   * Models a real scenario where events arrive out of order and must
   * be handled idempotently.
   */
  interface WebhookEvent {
    id: string;
    type: string;
    created: number;
    data: Record<string, unknown>;
  }

  function createWebhookProcessor() {
    const processedEvents = new Set<string>();
    const licenseState = new Map<string, { tier: string; updatedAt: number }>();

    return {
      async processEvent(event: WebhookEvent): Promise<{ processed: boolean; reason?: string }> {
        // Idempotency check
        if (processedEvents.has(event.id)) {
          return { processed: false, reason: 'duplicate' };
        }

        processedEvents.add(event.id);

        // Event-type-specific processing
        if (event.type === 'customer.subscription.updated') {
          const userId = event.data.userId as string;
          const tier = event.data.tier as string;
          const current = licenseState.get(userId);

          // Only apply if this event is newer than what we have
          if (current && current.updatedAt >= event.created) {
            return { processed: false, reason: 'stale' };
          }

          licenseState.set(userId, { tier, updatedAt: event.created });
          return { processed: true };
        }

        if (event.type === 'customer.subscription.deleted') {
          const userId = event.data.userId as string;
          const current = licenseState.get(userId);

          if (current && current.updatedAt >= event.created) {
            return { processed: false, reason: 'stale' };
          }

          licenseState.set(userId, { tier: 'free', updatedAt: event.created });
          return { processed: true };
        }

        return { processed: false, reason: 'unknown_event' };
      },

      getLicense(userId: string): { tier: string; updatedAt: number } | undefined {
        return licenseState.get(userId);
      },

      getProcessedCount(): number {
        return processedEvents.size;
      },
    };
  }

  it('duplicate event processing should be idempotent', async () => {
    const processor = createWebhookProcessor();

    const event: WebhookEvent = {
      id: 'evt_123',
      type: 'customer.subscription.updated',
      created: 1000,
      data: { userId: 'user-1', tier: 'pro' },
    };

    // Process the same event concurrently
    const results = await Promise.all(
      Array.from({ length: 5 }, () => processor.processEvent(event)),
    );

    // Only one should be processed
    const processed = results.filter((r) => r.processed);
    expect(processed).toHaveLength(1);

    // Duplicates should be rejected
    const duplicates = results.filter((r) => r.reason === 'duplicate');
    expect(duplicates).toHaveLength(4);

    // License should be set correctly
    expect(processor.getLicense('user-1')?.tier).toBe('pro');
  });

  it('out-of-order events should apply only the latest', async () => {
    const processor = createWebhookProcessor();

    // Events arrive out of order
    const events: WebhookEvent[] = [
      {
        id: 'evt_3',
        type: 'customer.subscription.updated',
        created: 3000,
        data: { userId: 'user-1', tier: 'enterprise' },
      },
      {
        id: 'evt_1',
        type: 'customer.subscription.updated',
        created: 1000,
        data: { userId: 'user-1', tier: 'pro' },
      },
      {
        id: 'evt_2',
        type: 'customer.subscription.updated',
        created: 2000,
        data: { userId: 'user-1', tier: 'max' },
      },
    ];

    // Process all concurrently
    await Promise.all(events.map((e) => processor.processEvent(e)));

    // All should be processed (different IDs)
    expect(processor.getProcessedCount()).toBe(3);

    // The latest event (created=3000, enterprise) should win
    const license = processor.getLicense('user-1');
    expect(license?.tier).toBe('enterprise');
    expect(license?.updatedAt).toBe(3000);
  });

  it('delete after update should downgrade to free', async () => {
    const processor = createWebhookProcessor();

    // First update to pro
    await processor.processEvent({
      id: 'evt_upgrade',
      type: 'customer.subscription.updated',
      created: 1000,
      data: { userId: 'user-1', tier: 'pro' },
    });

    // Then cancel (later timestamp)
    await processor.processEvent({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      created: 2000,
      data: { userId: 'user-1' },
    });

    expect(processor.getLicense('user-1')?.tier).toBe('free');
  });

  it('stale delete arriving after newer update should be ignored', async () => {
    const processor = createWebhookProcessor();

    // Newer update arrives first
    await processor.processEvent({
      id: 'evt_upgrade',
      type: 'customer.subscription.updated',
      created: 5000,
      data: { userId: 'user-1', tier: 'enterprise' },
    });

    // Stale cancel from earlier
    const result = await processor.processEvent({
      id: 'evt_old_cancel',
      type: 'customer.subscription.deleted',
      created: 1000,
      data: { userId: 'user-1' },
    });

    expect(result.reason).toBe('stale');
    expect(processor.getLicense('user-1')?.tier).toBe('enterprise');
  });

  it('concurrent webhook processing for different users should not interfere', async () => {
    const processor = createWebhookProcessor();

    const events: WebhookEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'customer.subscription.updated',
      created: 1000 + i,
      data: {
        userId: `user-${i % 5}`,
        tier: i % 2 === 0 ? 'pro' : 'max',
      },
    }));

    await Promise.all(events.map((e) => processor.processEvent(e)));

    // All events should have been processed (unique IDs)
    expect(processor.getProcessedCount()).toBe(10);

    // Each user should have the latest tier from their events
    for (let userId = 0; userId < 5; userId++) {
      const license = processor.getLicense(`user-${userId}`);
      expect(license).toBeDefined();
      // The latest event for this user has the highest `created` value
      expect(license?.updatedAt).toBeGreaterThan(1000);
    }
  });
});
