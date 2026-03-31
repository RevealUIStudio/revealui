import type { Stripe } from 'stripe';

/**
 * Typed Stripe webhook event helper
 * Ensures type safety when accessing event.data.object
 */
export type StripeWebhookEvent<T extends Stripe.Event.Type> = Stripe.Event & {
  type: T;
  data: {
    object: T extends keyof Stripe.Event.Data.Object ? Stripe.Event.Data.Object[T] : unknown;
  };
};

/**
 * Extended webhook event type for events not in standard Stripe.Event.Type
 * Used for payment_method and setup_intent events
 */
export type ExtendedStripeWebhookEvent<T extends string> = Omit<Stripe.Event, 'type' | 'data'> & {
  type: T;
  data: {
    object: unknown;
  };
};

/**
 * Type guard to check if an object is a Stripe Customer
 */
export function isStripeCustomer(obj: unknown): obj is Stripe.Customer {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'object' in obj &&
    (obj as { object: string }).object === 'customer'
  );
}

/**
 * Type guard to check if an object is a Stripe PaymentMethod
 */
export function isStripePaymentMethod(obj: unknown): obj is Stripe.PaymentMethod {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'object' in obj &&
    (obj as { object: string }).object === 'payment_method'
  );
}

/**
 * Type guard to check if an object is a Stripe Subscription
 */
export function isStripeSubscription(obj: unknown): obj is Stripe.Subscription {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'object' in obj &&
    (obj as { object: string }).object === 'subscription'
  );
}

/**
 * Type guard to check if an object is a Stripe CheckoutSession
 */
export function isStripeCheckoutSession(obj: unknown): obj is Stripe.Checkout.Session {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'object' in obj &&
    (obj as { object: string }).object === 'checkout.session'
  );
}

/**
 * Helper to safely extract customer ID from various Stripe objects
 */
export function extractCustomerId(
  obj:
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.PaymentMethod
    | Stripe.Subscription
    | Stripe.Checkout.Session
    | string
    | null
    | undefined,
): string | null {
  if (typeof obj === 'string') {
    return obj;
  }
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj === 'object' && 'customer' in obj) {
    const customer = obj.customer;
    if (typeof customer === 'string') {
      return customer;
    }
    if (typeof customer === 'object' && customer !== null) {
      // Handle both Customer and DeletedCustomer
      if ('id' in customer && typeof customer.id === 'string') {
        return customer.id;
      }
      // DeletedCustomer has 'deleted' property
      if ('deleted' in customer && customer.deleted === true && 'id' in customer) {
        return typeof customer.id === 'string' ? customer.id : null;
      }
    }
  }
  if (typeof obj === 'object' && 'id' in obj && typeof obj.id === 'string') {
    return obj.id;
  }
  return null;
}
