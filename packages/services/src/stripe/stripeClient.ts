// Import config module (ESM)
// Config uses proxy for lazy loading, so import is safe - validation only happens on property access
import configModule from '@revealui/config';
import { createLogger } from '@revealui/core/observability/logger';
import Stripe from 'stripe';
import { DbCircuitBreaker } from './db-circuit-breaker.js';

const logger = createLogger({ service: 'Stripe' });

// Lazy initialization to handle missing env vars during build
let _stripe: Stripe | null = null;

/**
 * Get or create Stripe client instance (production use)
 */
function getStripe(): Stripe {
  // Use cached instance if available
  if (_stripe) return _stripe;

  // Try to get from config module, fallback to process.env for backward compatibility
  let secretKey: string | undefined;

  try {
    // Accessing config.stripe.secretKey triggers lazy validation via proxy
    // Type assertion needed because Proxy type inference fails for nested properties
    // Config is a Proxy, so we need to access properties directly
    secretKey = (configModule as unknown as { stripe?: { secretKey?: string } }).stripe?.secretKey;
  } catch {
    // Config validation failed or module unavailable - will use process.env fallback
    secretKey = undefined;
  }

  secretKey = secretKey ?? process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY environment variable is required. Use @revealui/config or set STRIPE_SECRET_KEY.',
    );
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: '2026-03-25.dahlia',
  });
  return _stripe;
}

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // Open circuit after 5 failures
  resetTimeout: 30000, // 30 seconds before half-open
  successThreshold: 2, // Need 2 successes to close from half-open
};

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: [100, 200, 400], // Exponential backoff in milliseconds
  timeout: 10000, // 10 second timeout
};

/**
 * Shared DB-backed circuit breaker for all Stripe operations.
 * State is persisted to NeonDB so all API instances share the same view.
 * Local 5-second cache keeps the read path fast.
 */
const stripeCircuitBreaker = new DbCircuitBreaker('stripe', {
  failureThreshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
  successThreshold: CIRCUIT_BREAKER_CONFIG.successThreshold,
  resetTimeout: CIRCUIT_BREAKER_CONFIG.resetTimeout,
});

/**
 * Sleep helper for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper for promises
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

/**
 * Factory function to create protected Stripe client with dependency injection
 * @param stripeInstance - Stripe instance to use (for testing) or undefined to use getStripe()
 */
function createProtectedStripe(stripeInstance?: Stripe) {
  // Use provided instance or get production instance
  const getStripeInstance = (): Stripe => {
    return stripeInstance ?? getStripe();
  };

  /**
   * Wrapper for Stripe API calls with circuit breaker and retry logic
   */
  async function callWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    // Check circuit breaker state (DB-backed, 5s local cache)
    if (await stripeCircuitBreaker.isOpen()) {
      logger.error(`Stripe circuit breaker is OPEN`, undefined, {
        operation: operationName,
        state: 'open',
      });
      throw new Error(
        'Stripe circuit breaker is OPEN. Service may be unavailable. Please try again later.',
      );
    }

    let lastError: unknown;

    // Retry with exponential backoff
    for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        // Execute operation with timeout
        const result = await withTimeout(operation(), RETRY_CONFIG.timeout);

        // Success - record it and return
        await stripeCircuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error;

        // Check if it's a timeout or network error (retryable)
        const isRetryable =
          error instanceof Error &&
          (error.message.includes('timeout') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('network'));

        // Don't retry non-retryable errors (e.g., validation errors from Stripe)
        if (!isRetryable) {
          await stripeCircuitBreaker.recordFailure();
          logger.error(
            `Operation ${operationName} failed (non-retryable)`,
            error instanceof Error ? error : new Error(String(error)),
            {
              operation: operationName,
              attempt: attempt + 1,
              maxAttempts: RETRY_CONFIG.maxAttempts,
            },
          );
          throw error;
        }

        // Log retryable error
        logger.warn(`Operation ${operationName} failed (retryable), retrying...`, {
          operation: operationName,
          attempt: attempt + 1,
          maxAttempts: RETRY_CONFIG.maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });

        // If this is the last attempt, don't wait
        if (attempt === RETRY_CONFIG.maxAttempts - 1) {
          break;
        }

        // Exponential backoff
        const backoffMs =
          RETRY_CONFIG.backoff[attempt] ??
          RETRY_CONFIG.backoff[RETRY_CONFIG.backoff.length - 1] ??
          1000;
        await sleep(backoffMs);
      }
    }

    // All retries failed
    await stripeCircuitBreaker.recordFailure();
    throw lastError instanceof Error
      ? new Error(
          `${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError.message}`,
        )
      : new Error(`${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts`);
  }

  // Return protected Stripe client using the provided or production Stripe instance
  return {
    billingPortal: {
      sessions: {
        create: (
          params: Stripe.BillingPortal.SessionCreateParams,
          options?: Stripe.RequestOptions,
        ): Promise<Stripe.BillingPortal.Session> =>
          callWithResilience(
            () => getStripeInstance().billingPortal.sessions.create(params, options),
            'billingPortal.sessions.create',
          ),
      },
    },
    customers: {
      create: (
        params: Stripe.CustomerCreateParams,
        options?: Stripe.RequestOptions,
      ): Promise<Stripe.Customer> =>
        callWithResilience(
          () => getStripeInstance().customers.create(params, options),
          'customers.create',
        ),
      retrieve: (
        ...args: Parameters<Stripe['customers']['retrieve']>
      ): Promise<Stripe.Customer | Stripe.DeletedCustomer> =>
        callWithResilience(
          () => getStripeInstance().customers.retrieve(...args),
          'customers.retrieve',
        ),
      update: (...args: Parameters<Stripe['customers']['update']>): Promise<Stripe.Customer> =>
        callWithResilience(() => getStripeInstance().customers.update(...args), 'customers.update'),
      del: (...args: Parameters<Stripe['customers']['del']>): Promise<Stripe.DeletedCustomer> =>
        callWithResilience(() => getStripeInstance().customers.del(...args), 'customers.del'),
      list: (
        params?: Stripe.CustomerListParams,
        options?: Stripe.RequestOptions,
      ): Promise<Stripe.ApiList<Stripe.Customer>> =>
        callWithResilience(
          () => getStripeInstance().customers.list(params, options),
          'customers.list',
        ),
    },
    paymentIntents: {
      create: (
        ...args: Parameters<Stripe['paymentIntents']['create']>
      ): Promise<Stripe.PaymentIntent> =>
        callWithResilience(
          () => getStripeInstance().paymentIntents.create(...args),
          'paymentIntents.create',
        ),
      retrieve: (
        ...args: Parameters<Stripe['paymentIntents']['retrieve']>
      ): Promise<Stripe.PaymentIntent> =>
        callWithResilience(
          () => getStripeInstance().paymentIntents.retrieve(...args),
          'paymentIntents.retrieve',
        ),
      update: (
        ...args: Parameters<Stripe['paymentIntents']['update']>
      ): Promise<Stripe.PaymentIntent> =>
        callWithResilience(
          () => getStripeInstance().paymentIntents.update(...args),
          'paymentIntents.update',
        ),
    },
    checkout: {
      sessions: {
        create: (
          params: Stripe.Checkout.SessionCreateParams,
          options?: Stripe.RequestOptions,
        ): Promise<Stripe.Checkout.Session> =>
          callWithResilience(
            () => getStripeInstance().checkout.sessions.create(params, options),
            'checkout.sessions.create',
          ),
        retrieve: (
          ...args: Parameters<Stripe['checkout']['sessions']['retrieve']>
        ): Promise<Stripe.Checkout.Session> =>
          callWithResilience(
            () => getStripeInstance().checkout.sessions.retrieve(...args),
            'checkout.sessions.retrieve',
          ),
      },
    },
    products: {
      create: (...args: Parameters<Stripe['products']['create']>): Promise<Stripe.Product> =>
        callWithResilience(() => getStripeInstance().products.create(...args), 'products.create'),
      retrieve: (...args: Parameters<Stripe['products']['retrieve']>): Promise<Stripe.Product> =>
        callWithResilience(
          () => getStripeInstance().products.retrieve(...args),
          'products.retrieve',
        ),
      update: (...args: Parameters<Stripe['products']['update']>): Promise<Stripe.Product> =>
        callWithResilience(() => getStripeInstance().products.update(...args), 'products.update'),
      list: (
        params?: Stripe.ProductListParams,
        options?: Stripe.RequestOptions,
      ): Promise<Stripe.ApiList<Stripe.Product>> =>
        callWithResilience(
          () => getStripeInstance().products.list(params, options),
          'products.list',
        ),
    },
    prices: {
      create: (...args: Parameters<Stripe['prices']['create']>): Promise<Stripe.Price> =>
        callWithResilience(() => getStripeInstance().prices.create(...args), 'prices.create'),
      retrieve: (...args: Parameters<Stripe['prices']['retrieve']>): Promise<Stripe.Price> =>
        callWithResilience(() => getStripeInstance().prices.retrieve(...args), 'prices.retrieve'),
      update: (...args: Parameters<Stripe['prices']['update']>): Promise<Stripe.Price> =>
        callWithResilience(() => getStripeInstance().prices.update(...args), 'prices.update'),
      list: (
        params?: Stripe.PriceListParams,
        options?: Stripe.RequestOptions,
      ): Promise<Stripe.ApiList<Stripe.Price>> =>
        callWithResilience(() => getStripeInstance().prices.list(params, options), 'prices.list'),
    },
    subscriptions: {
      list: (
        ...args: Parameters<Stripe['subscriptions']['list']>
      ): Promise<Stripe.ApiList<Stripe.Subscription>> =>
        callWithResilience(
          () => getStripeInstance().subscriptions.list(...args),
          'subscriptions.list',
        ),
      retrieve: (
        ...args: Parameters<Stripe['subscriptions']['retrieve']>
      ): Promise<Stripe.Subscription> =>
        callWithResilience(
          () => getStripeInstance().subscriptions.retrieve(...args),
          'subscriptions.retrieve',
        ),
      update: (
        ...args: Parameters<Stripe['subscriptions']['update']>
      ): Promise<Stripe.Subscription> =>
        callWithResilience(
          () => getStripeInstance().subscriptions.update(...args),
          'subscriptions.update',
        ),
      cancel: (
        ...args: Parameters<Stripe['subscriptions']['cancel']>
      ): Promise<Stripe.Subscription> =>
        callWithResilience(
          () => getStripeInstance().subscriptions.cancel(...args),
          'subscriptions.cancel',
        ),
    },
    billing: {
      meterEvents: {
        create: (
          params: Stripe.Billing.MeterEventCreateParams,
          options?: Stripe.RequestOptions,
        ): Promise<Stripe.Response<Stripe.Billing.MeterEvent>> =>
          callWithResilience(
            () => getStripeInstance().billing.meterEvents.create(params, options),
            'billing.meterEvents.create',
          ),
      },
    },
    get webhooks(): Stripe['webhooks'] {
      return getStripeInstance().webhooks;
    },
    get balance(): Stripe['balance'] {
      return getStripeInstance().balance;
    },
  };
}

/**
 * Enhanced Stripe client with circuit breaker and retry protection
 * Uses factory with production Stripe instance for backward compatibility
 */
export const protectedStripe = createProtectedStripe();

// Export factory for cases where you need explicit initialization control (e.g., testing)
export { createProtectedStripe, getStripe };

// Test-only exports (DO NOT USE IN PRODUCTION)
// These are exported with __ prefix to indicate they are internal and test-only
export const __dbCircuitBreaker = stripeCircuitBreaker;
export const __CIRCUIT_BREAKER_CONFIG = CIRCUIT_BREAKER_CONFIG;
export const __RETRY_CONFIG = RETRY_CONFIG;
/**
 * Reset the DB circuit breaker state and clear local cache (test-only).
 */
export const __resetCircuitBreaker = (): Promise<void> => stripeCircuitBreaker.reset();
/**
 * Reset the cached Stripe instance (test-only)
 * This allows tests to reset the production Stripe cache
 */
export const __resetStripe = (): void => {
  _stripe = null;
};
