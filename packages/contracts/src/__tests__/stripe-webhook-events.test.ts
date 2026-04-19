import { describe, expect, it } from 'vitest';
import {
  RELEVANT_STRIPE_WEBHOOK_EVENT_COUNT,
  RELEVANT_STRIPE_WEBHOOK_EVENTS,
  type RelevantStripeWebhookEvent,
} from '../stripe-webhook-events.js';

describe('stripe-webhook-events', () => {
  it('exposes exactly RELEVANT_STRIPE_WEBHOOK_EVENT_COUNT events', () => {
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toHaveLength(RELEVANT_STRIPE_WEBHOOK_EVENT_COUNT);
  });

  it('has no duplicates', () => {
    const set = new Set(RELEVANT_STRIPE_WEBHOOK_EVENTS);
    expect(set.size).toBe(RELEVANT_STRIPE_WEBHOOK_EVENTS.length);
  });

  it('every event name follows Stripe event-name dot-notation', () => {
    for (const event of RELEVANT_STRIPE_WEBHOOK_EVENTS) {
      // e.g. "customer.subscription.created" — at least one dot, lowercase
      expect(event).toMatch(/^[a-z][a-z_]*(\.[a-z_]+)+$/);
    }
  });

  it('covers the four required event categories', () => {
    // Checkout completion
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('checkout.session.completed');

    // Customer + subscription lifecycle
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('customer.deleted');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('customer.subscription.created');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('customer.subscription.updated');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('customer.subscription.deleted');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('customer.subscription.trial_will_end');

    // Invoice + payment intent (payment flow)
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('invoice.payment_succeeded');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('invoice.payment_failed');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('payment_intent.payment_failed');

    // Dispute + refund (reversals)
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('charge.dispute.created');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('charge.dispute.closed');
    expect(RELEVANT_STRIPE_WEBHOOK_EVENTS).toContain('charge.refunded');
  });

  it('RelevantStripeWebhookEvent type accepts canonical events (compile-time check)', () => {
    // This test doesn't run assertions at runtime; it fails at typecheck
    // if the type narrows incorrectly. The `as` casts here exercise the
    // union constraint on the expected narrowest values.
    const checkout: RelevantStripeWebhookEvent = 'checkout.session.completed';
    const refunded: RelevantStripeWebhookEvent = 'charge.refunded';
    expect(checkout).toBe('checkout.session.completed');
    expect(refunded).toBe('charge.refunded');
  });
});
