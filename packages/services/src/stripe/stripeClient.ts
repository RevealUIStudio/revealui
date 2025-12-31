import Stripe from "stripe";

// TODO: Re-enable when resilience modules are exported from reveal package
// import { withCircuitBreaker } from "reveal/core/resilience/circuit-breaker"
// import { retry } from "reveal/core/resilience/retry"

const stripe: Stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
	apiVersion: "2025-11-17.clover",
});

/**
 * Wrapper for Stripe API calls with circuit breaker and retry logic
 * TODO: Re-enable when resilience modules are exported from reveal package
 */
async function callWithResilience<T>(
	operation: () => Promise<T>,
	operationName: string,
): Promise<T> {
	// Temporarily disabled - resilience modules not exported
	// TODO: Re-enable when reveal/core/resilience modules are exported
	return operation();

	/* Original implementation (disabled):
  // Wrap with circuit breaker
  const protectedOperation = withCircuitBreaker(
    `stripe.${operationName}`,
    async () => {
      // Wrap with retry logic
      return retry(operation, {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
      })
    },
    {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
    }
  )

  return protectedOperation()
  */
}

/**
 * Enhanced Stripe client with circuit breaker and retry protection
 */
export const protectedStripe = {
	customers: {
		create: (...args: Parameters<typeof stripe.customers.create>) =>
			callWithResilience(
				() => stripe.customers.create(...args),
				"customers.create",
			),
		retrieve: (...args: Parameters<typeof stripe.customers.retrieve>) =>
			callWithResilience(
				() => stripe.customers.retrieve(...args),
				"customers.retrieve",
			),
		update: (...args: Parameters<typeof stripe.customers.update>) =>
			callWithResilience(
				() => stripe.customers.update(...args),
				"customers.update",
			),
		del: (...args: Parameters<typeof stripe.customers.del>) =>
			callWithResilience(() => stripe.customers.del(...args), "customers.del"),
	},
	paymentIntents: {
		create: (...args: Parameters<typeof stripe.paymentIntents.create>) =>
			callWithResilience(
				() => stripe.paymentIntents.create(...args),
				"paymentIntents.create",
			),
		retrieve: (...args: Parameters<typeof stripe.paymentIntents.retrieve>) =>
			callWithResilience(
				() => stripe.paymentIntents.retrieve(...args),
				"paymentIntents.retrieve",
			),
		update: (...args: Parameters<typeof stripe.paymentIntents.update>) =>
			callWithResilience(
				() => stripe.paymentIntents.update(...args),
				"paymentIntents.update",
			),
	},
	checkout: {
		sessions: {
			create: (...args: Parameters<typeof stripe.checkout.sessions.create>) =>
				callWithResilience(
					() => stripe.checkout.sessions.create(...args),
					"checkout.sessions.create",
				),
			retrieve: (
				...args: Parameters<typeof stripe.checkout.sessions.retrieve>
			) =>
				callWithResilience(
					() => stripe.checkout.sessions.retrieve(...args),
					"checkout.sessions.retrieve",
				),
		},
	},
	products: {
		create: (...args: Parameters<typeof stripe.products.create>) =>
			callWithResilience(
				() => stripe.products.create(...args),
				"products.create",
			),
		retrieve: (...args: Parameters<typeof stripe.products.retrieve>) =>
			callWithResilience(
				() => stripe.products.retrieve(...args),
				"products.retrieve",
			),
		update: (...args: Parameters<typeof stripe.products.update>) =>
			callWithResilience(
				() => stripe.products.update(...args),
				"products.update",
			),
	},
	prices: {
		create: (...args: Parameters<typeof stripe.prices.create>) =>
			callWithResilience(() => stripe.prices.create(...args), "prices.create"),
		retrieve: (...args: Parameters<typeof stripe.prices.retrieve>) =>
			callWithResilience(
				() => stripe.prices.retrieve(...args),
				"prices.retrieve",
			),
		update: (...args: Parameters<typeof stripe.prices.update>) =>
			callWithResilience(() => stripe.prices.update(...args), "prices.update"),
	},
	subscriptions: {
		retrieve: (...args: Parameters<typeof stripe.subscriptions.retrieve>) =>
			callWithResilience(
				() => stripe.subscriptions.retrieve(...args),
				"subscriptions.retrieve",
			),
		update: (...args: Parameters<typeof stripe.subscriptions.update>) =>
			callWithResilience(
				() => stripe.subscriptions.update(...args),
				"subscriptions.update",
			),
		cancel: (...args: Parameters<typeof stripe.subscriptions.cancel>) =>
			callWithResilience(
				() => stripe.subscriptions.cancel(...args),
				"subscriptions.cancel",
			),
	},
	webhooks: stripe.webhooks,
	balance: stripe.balance,
};

// Export both the raw client (for webhooks) and protected client
export default stripe;
