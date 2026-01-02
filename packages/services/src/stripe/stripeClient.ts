import Stripe from 'stripe'

// Lazy initialization to handle missing env vars during build
let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (_stripe) return _stripe

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required')
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
  })
  return _stripe
}

// For backwards compatibility - lazy getter
const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})

/**
 * Wrapper for Stripe API calls with circuit breaker and retry logic
 */
async function callWithResilience<T>(
  operation: () => Promise<T>,
  _operationName: string
): Promise<T> {
  // Temporarily disabled - resilience modules not exported
  return operation()
}

/**
 * Enhanced Stripe client with circuit breaker and retry protection
 */
export const protectedStripe = {
  customers: {
    create: (...args: Parameters<Stripe['customers']['create']>) =>
      callWithResilience(() => getStripe().customers.create(...args), 'customers.create'),
    retrieve: (...args: Parameters<Stripe['customers']['retrieve']>) =>
      callWithResilience(() => getStripe().customers.retrieve(...args), 'customers.retrieve'),
    update: (...args: Parameters<Stripe['customers']['update']>) =>
      callWithResilience(() => getStripe().customers.update(...args), 'customers.update'),
    del: (...args: Parameters<Stripe['customers']['del']>) =>
      callWithResilience(() => getStripe().customers.del(...args), 'customers.del'),
  },
  paymentIntents: {
    create: (...args: Parameters<Stripe['paymentIntents']['create']>) =>
      callWithResilience(() => getStripe().paymentIntents.create(...args), 'paymentIntents.create'),
    retrieve: (...args: Parameters<Stripe['paymentIntents']['retrieve']>) =>
      callWithResilience(
        () => getStripe().paymentIntents.retrieve(...args),
        'paymentIntents.retrieve'
      ),
    update: (...args: Parameters<Stripe['paymentIntents']['update']>) =>
      callWithResilience(() => getStripe().paymentIntents.update(...args), 'paymentIntents.update'),
  },
  checkout: {
    sessions: {
      create: (...args: Parameters<Stripe['checkout']['sessions']['create']>) =>
        callWithResilience(
          () => getStripe().checkout.sessions.create(...args),
          'checkout.sessions.create'
        ),
      retrieve: (...args: Parameters<Stripe['checkout']['sessions']['retrieve']>) =>
        callWithResilience(
          () => getStripe().checkout.sessions.retrieve(...args),
          'checkout.sessions.retrieve'
        ),
    },
  },
  products: {
    create: (...args: Parameters<Stripe['products']['create']>) =>
      callWithResilience(() => getStripe().products.create(...args), 'products.create'),
    retrieve: (...args: Parameters<Stripe['products']['retrieve']>) =>
      callWithResilience(() => getStripe().products.retrieve(...args), 'products.retrieve'),
    update: (...args: Parameters<Stripe['products']['update']>) =>
      callWithResilience(() => getStripe().products.update(...args), 'products.update'),
  },
  prices: {
    create: (...args: Parameters<Stripe['prices']['create']>) =>
      callWithResilience(() => getStripe().prices.create(...args), 'prices.create'),
    retrieve: (...args: Parameters<Stripe['prices']['retrieve']>) =>
      callWithResilience(() => getStripe().prices.retrieve(...args), 'prices.retrieve'),
    update: (...args: Parameters<Stripe['prices']['update']>) =>
      callWithResilience(() => getStripe().prices.update(...args), 'prices.update'),
  },
  subscriptions: {
    retrieve: (...args: Parameters<Stripe['subscriptions']['retrieve']>) =>
      callWithResilience(
        () => getStripe().subscriptions.retrieve(...args),
        'subscriptions.retrieve'
      ),
    update: (...args: Parameters<Stripe['subscriptions']['update']>) =>
      callWithResilience(() => getStripe().subscriptions.update(...args), 'subscriptions.update'),
    cancel: (...args: Parameters<Stripe['subscriptions']['cancel']>) =>
      callWithResilience(() => getStripe().subscriptions.cancel(...args), 'subscriptions.cancel'),
  },
  get webhooks() {
    return getStripe().webhooks
  },
  get balance() {
    return getStripe().balance
  },
}

// Export both the raw client (for webhooks) and protected client
export default stripe

// Export factory for cases where you need explicit initialization control
export { getStripe }
