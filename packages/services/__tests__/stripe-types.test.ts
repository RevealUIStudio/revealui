/**
 * Stripe Type Guards & Utilities Tests
 *
 * Covers src/api/types/stripe.ts:
 * - isStripeCustomer
 * - isStripePaymentMethod
 * - isStripeSubscription
 * - isStripeCheckoutSession
 * - extractCustomerId
 */

import { describe, expect, it } from 'vitest';
import {
  extractCustomerId,
  isStripeCheckoutSession,
  isStripeCustomer,
  isStripePaymentMethod,
  isStripeSubscription,
} from '../src/api/types/stripe.js';

// ---------------------------------------------------------------------------
// isStripeCustomer
// ---------------------------------------------------------------------------

describe('isStripeCustomer', () => {
  it('returns true for a customer-shaped object', () => {
    expect(isStripeCustomer({ id: 'cus_123', object: 'customer' })).toBe(true);
  });

  it('returns false for non-customer object type', () => {
    expect(isStripeCustomer({ id: 'pm_123', object: 'payment_method' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isStripeCustomer(null)).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isStripeCustomer('cus_123')).toBe(false);
  });

  it('returns false for object missing id', () => {
    expect(isStripeCustomer({ object: 'customer' })).toBe(false);
  });

  it('returns false for object missing object field', () => {
    expect(isStripeCustomer({ id: 'cus_123' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isStripePaymentMethod
// ---------------------------------------------------------------------------

describe('isStripePaymentMethod', () => {
  it('returns true for a payment_method-shaped object', () => {
    expect(isStripePaymentMethod({ id: 'pm_123', object: 'payment_method' })).toBe(true);
  });

  it('returns false for wrong object type', () => {
    expect(isStripePaymentMethod({ id: 'cus_123', object: 'customer' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isStripePaymentMethod(null)).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isStripePaymentMethod(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isStripeSubscription
// ---------------------------------------------------------------------------

describe('isStripeSubscription', () => {
  it('returns true for a subscription-shaped object', () => {
    expect(isStripeSubscription({ id: 'sub_123', object: 'subscription' })).toBe(true);
  });

  it('returns false for wrong object type', () => {
    expect(isStripeSubscription({ id: 'pm_123', object: 'payment_method' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isStripeSubscription(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isStripeCheckoutSession
// ---------------------------------------------------------------------------

describe('isStripeCheckoutSession', () => {
  it('returns true for a checkout.session-shaped object', () => {
    expect(isStripeCheckoutSession({ id: 'cs_123', object: 'checkout.session' })).toBe(true);
  });

  it('returns false for wrong object type', () => {
    expect(isStripeCheckoutSession({ id: 'sub_123', object: 'subscription' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isStripeCheckoutSession(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractCustomerId
// ---------------------------------------------------------------------------

describe('extractCustomerId', () => {
  it('returns a string directly', () => {
    expect(extractCustomerId('cus_abc')).toBe('cus_abc');
  });

  it('returns null for null', () => {
    expect(extractCustomerId(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(extractCustomerId(undefined)).toBeNull();
  });

  it('extracts id from a plain object with id field', () => {
    expect(extractCustomerId({ id: 'cus_abc' })).toBe('cus_abc');
  });

  it('extracts customer string from an object with customer field', () => {
    const paymentMethod = { id: 'pm_123', customer: 'cus_abc' };
    expect(extractCustomerId(paymentMethod as Parameters<typeof extractCustomerId>[0])).toBe(
      'cus_abc',
    );
  });

  it('extracts customer id from a nested customer object', () => {
    const subscription = { id: 'sub_123', customer: { id: 'cus_nested' } };
    expect(extractCustomerId(subscription as Parameters<typeof extractCustomerId>[0])).toBe(
      'cus_nested',
    );
  });

  it('extracts id from a DeletedCustomer (has deleted: true)', () => {
    const deleted = { id: 'cus_deleted', deleted: true };
    // When passed as a customer directly, it has an id
    expect(extractCustomerId(deleted as Parameters<typeof extractCustomerId>[0])).toBe(
      'cus_deleted',
    );
  });

  it('falls back to outer object id when nested customer id is not a string', () => {
    // customer.id is non-string, so the customer branch doesn't match,
    // and the function falls through to return the outer object's id
    const obj = { id: 'x', customer: { id: 123 } };
    expect(extractCustomerId(obj as Parameters<typeof extractCustomerId>[0])).toBe('x');
  });
});
