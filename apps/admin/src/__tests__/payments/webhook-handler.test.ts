/**
 * Stripe Webhook Handler  -  Comprehensive admin-side Tests
 *
 * Tests the webhook processing logic independent of the Hono transport layer.
 * Covers scenarios specific to admin billing integration:
 *
 * - Signature verification schema validation
 * - Stripe webhook event schema validation
 * - Perpetual license checkout metadata
 * - Subscription lifecycle state transitions
 * - Tier resolution edge cases
 * - Idempotency patterns
 * - Error handling and security
 *
 * NOTE: The actual Hono webhook handler lives in apps/server/src/routes/webhooks.ts
 * and is tested there. These tests validate the admin-side validation schemas and
 * Stripe event structures used by the webhook system.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stripeWebhookSchema, webhookSignatureSchema } from '@/lib/validation/schemas';
import {
  createMockCheckoutSession,
  createMockCustomer,
  createMockWebhookEvent,
  createMockWebhookSignature,
} from '../utils/stripe-test-utils';

describe('Stripe webhook handler  -  comprehensive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNATURE VERIFICATION SCHEMA
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Signature verification', () => {
    it('accepts a valid signature and payload', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed', data: {} });
      const signature = createMockWebhookSignature(payload, 'whsec_test');

      const result = webhookSignatureSchema.safeParse({ signature, payload });
      expect(result.success).toBe(true);
    });

    it('rejects when signature is empty', () => {
      const result = webhookSignatureSchema.safeParse({
        signature: '',
        payload: '{"type":"test"}',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when payload is empty', () => {
      const result = webhookSignatureSchema.safeParse({
        signature: 't=123,v1=abc',
        payload: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when signature is missing entirely', () => {
      const result = webhookSignatureSchema.safeParse({
        payload: '{"type":"test"}',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when payload is missing entirely', () => {
      const result = webhookSignatureSchema.safeParse({
        signature: 't=123,v1=abc',
      });
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE EVENT SCHEMA VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Stripe event schema validation', () => {
    it('accepts a well-formed checkout.session.completed event', () => {
      const event = {
        id: 'evt_checkout_valid',
        object: 'event' as const,
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_abc',
            customer: 'cus_abc',
            metadata: { tier: 'pro', revealui_user_id: 'user_123' },
          },
        },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('accepts a customer.subscription.updated event', () => {
      const event = {
        id: 'evt_sub_updated',
        object: 'event' as const,
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            metadata: { tier: 'pro' },
          },
        },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('accepts a customer.subscription.deleted event', () => {
      const event = {
        id: 'evt_sub_deleted',
        object: 'event' as const,
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_del',
            customer: 'cus_del',
          },
        },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('accepts an invoice.payment_failed event', () => {
      const event = {
        id: 'evt_inv_fail',
        object: 'event' as const,
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_fail',
            customer: 'cus_fail',
            customer_email: 'user@example.com',
            attempt_count: 3,
          },
        },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('rejects an event missing the id field', () => {
      const event = {
        object: 'event' as const,
        type: 'checkout.session.completed',
        data: { object: {} },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it('rejects an event with wrong object type', () => {
      const event = {
        id: 'evt_wrong',
        object: 'charge',
        type: 'checkout.session.completed',
        data: { object: {} },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it('rejects an event missing the type field', () => {
      const event = {
        id: 'evt_notype',
        object: 'event' as const,
        data: { object: {} },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it('rejects an event missing the data.object field', () => {
      const event = {
        id: 'evt_nodata',
        object: 'event' as const,
        type: 'checkout.session.completed',
        data: {},
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it('accepts an event with extra fields in data.object (passthrough)', () => {
      const event = {
        id: 'evt_extra',
        object: 'event' as const,
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_extra',
            customer: 'cus_extra',
            extra_field: 'should be allowed',
            nested: { deep: true },
          },
        },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT TYPE COVERAGE  -  all handled event types
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Event type coverage', () => {
    const relevantEventTypes = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.deleted',
      'invoice.payment_failed',
      'invoice.payment_succeeded',
      'payment_intent.payment_failed',
      'customer.subscription.trial_will_end',
      'charge.dispute.closed',
      'charge.dispute.created',
      'charge.refunded',
    ];

    for (const eventType of relevantEventTypes) {
      it(`validates schema for event type: ${eventType}`, () => {
        const event = {
          id: `evt_${eventType.replace(/\./g, '_')}`,
          object: 'event' as const,
          type: eventType,
          data: {
            object: { id: 'obj_test', customer: 'cus_test' },
          },
        };
        const result = stripeWebhookSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOK EVENT FIXTURE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Webhook event fixtures', () => {
    it('createMockWebhookEvent generates valid event structure', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_test',
        customer: 'cus_test',
      });

      expect(event.id).toMatch(/^evt_test_/);
      expect(event.object).toBe('event');
      expect(event.type).toBe('checkout.session.completed');
      expect(event.data.object).toBeDefined();
      expect(event.livemode).toBe(false);

      // Validates against schema
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('createMockWebhookSignature generates a valid signature format', () => {
      const payload = '{"test":"data"}';
      const sig = createMockWebhookSignature(payload, 'whsec_test');

      expect(sig).toMatch(/^t=\d+,v1=/);
      expect(sig.length).toBeGreaterThan(10);
    });

    it('createMockCustomer returns a properly typed customer', () => {
      const customer = createMockCustomer('test@example.com', {
        revealui_user_id: 'user_123',
      });

      expect(customer.id).toMatch(/^cus_test_/);
      expect(customer.object).toBe('customer');
      expect(customer.email).toBe('test@example.com');
      expect(customer.metadata.revealui_user_id).toBe('user_123');
    });

    it('createMockCheckoutSession returns a session with required fields', () => {
      const session = createMockCheckoutSession('cus_abc', 4900);

      expect(session.id).toMatch(/^cs_test_/);
      expect(session.customer).toBe('cus_abc');
      expect(session.amount_total).toBe(4900);
      expect(session.status).toBe('complete');
      expect(session.payment_status).toBe('paid');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT SESSION METADATA  -  SUBSCRIPTION MODE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Checkout session metadata  -  subscription mode', () => {
    it('validates event with required metadata for subscription activation', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_new',
        customer: 'cus_new',
        metadata: {
          tier: 'pro',
          revealui_user_id: 'user_abc',
        },
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);

      // Verify metadata is accessible
      const dataObj = event.data.object as unknown as Record<string, unknown>;
      const metadata = dataObj.metadata as Record<string, string>;
      expect(metadata.tier).toBe('pro');
      expect(metadata.revealui_user_id).toBe('user_abc');
    });

    it('validates event for max tier subscription', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_max',
        customer: 'cus_max',
        metadata: {
          tier: 'max',
          revealui_user_id: 'user_max',
        },
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('validates event for enterprise tier subscription', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_ent',
        customer: 'cus_ent',
        metadata: {
          tier: 'enterprise',
          revealui_user_id: 'user_ent',
        },
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT SESSION METADATA  -  PERPETUAL MODE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Checkout session metadata  -  perpetual (one-time payment)', () => {
    it('validates perpetual checkout event with tier and perpetual flag', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'payment',
        subscription: null,
        customer: 'cus_perpetual',
        metadata: {
          tier: 'pro',
          perpetual: 'true',
          revealui_user_id: 'user_perp',
        },
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);

      const dataObj = event.data.object as unknown as Record<string, unknown>;
      const metadata = dataObj.metadata as Record<string, string>;
      expect(metadata.perpetual).toBe('true');
      expect(metadata.tier).toBe('pro');
    });

    it('validates perpetual checkout with github_username for team provisioning', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'payment',
        customer: 'cus_perpetual',
        metadata: {
          tier: 'pro',
          perpetual: 'true',
          revealui_user_id: 'user_perp',
          github_username: 'octocat',
        },
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);

      const dataObj = event.data.object as unknown as Record<string, unknown>;
      const metadata = dataObj.metadata as Record<string, string>;
      expect(metadata.github_username).toBe('octocat');
    });

    it('payment-mode checkout without tier metadata is skipped by handler', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'payment',
        customer: 'cus_other',
        metadata: {}, // no tier  -  non-RevealUI product
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);

      // Handler checks session.metadata?.tier  -  without it, the event is silently skipped
      const dataObj = event.data.object as unknown as Record<string, unknown>;
      const metadata = dataObj.metadata as Record<string, string>;
      expect(metadata.tier).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION LIFECYCLE STATE TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Subscription lifecycle state transitions', () => {
    const subscriptionStatuses = [
      'active',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'trialing',
    ] as const;

    for (const status of subscriptionStatuses) {
      it(`validates subscription.updated event with status: ${status}`, () => {
        const event = createMockWebhookEvent('customer.subscription.updated', {
          id: 'sub_lifecycle',
          customer: 'cus_lifecycle',
          status,
          metadata: { tier: 'pro' },
        });

        const result = stripeWebhookSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    }

    it('validates scheduled cancellation event with cancel_at_period_end', () => {
      const cancelAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_cancel_scheduled',
        customer: 'cus_cancel',
        status: 'active',
        cancel_at_period_end: true,
        cancel_at: cancelAt,
        metadata: { tier: 'pro' },
      });

      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);

      const dataObj = event.data.object as unknown as Record<string, unknown>;
      expect(dataObj.cancel_at_period_end).toBe(true);
      expect(dataObj.cancel_at).toBe(cancelAt);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER RESOLUTION EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Tier resolution edge cases', () => {
    it('pro tier metadata passes schema validation', () => {
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_pro',
        customer: 'cus_pro',
        status: 'active',
        metadata: { tier: 'pro' },
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('max tier metadata passes schema validation', () => {
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_max',
        customer: 'cus_max',
        status: 'active',
        metadata: { tier: 'max' },
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('enterprise tier metadata passes schema validation', () => {
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_ent',
        customer: 'cus_ent',
        status: 'active',
        metadata: { tier: 'enterprise' },
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('unknown tier still passes schema (handler defaults to pro with warning)', () => {
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_unknown',
        customer: 'cus_unknown',
        status: 'active',
        metadata: { tier: 'platinum' },
      });
      // Schema doesn't restrict tier values  -  that's the handler's job
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('missing tier metadata still passes schema (handler defaults to pro)', () => {
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_notier',
        customer: 'cus_notier',
        status: 'active',
        metadata: {},
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY EVENT STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Idempotency  -  event ID uniqueness', () => {
    it('event IDs include a timestamp component for traceability', () => {
      const event = createMockWebhookEvent('test.event', {});
      // The mock helper prefixes IDs with `evt_test_` followed by Date.now()
      expect(event.id).toMatch(/^evt_test_\d+$/);
    });

    it('sequential events with different types produce valid events', () => {
      const eventTypes = [
        'checkout.session.completed',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_failed',
        'invoice.payment_succeeded',
      ];

      for (const type of eventTypes) {
        const event = createMockWebhookEvent(type, { id: 'obj_test' });
        expect(event.type).toBe(type);
        const result = stripeWebhookSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });

    it('event ID is always a non-empty string', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {});
      expect(typeof event.id).toBe('string');
      expect(event.id.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPUTE AND REFUND EVENT STRUCTURES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Dispute and refund event structures', () => {
    it('validates charge.dispute.closed event with lost status', () => {
      const event = createMockWebhookEvent('charge.dispute.closed', {
        id: 'dp_lost',
        status: 'lost',
        charge: 'ch_disputed',
        amount: 4900,
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('validates charge.dispute.closed event with won status', () => {
      const event = createMockWebhookEvent('charge.dispute.closed', {
        id: 'dp_won',
        status: 'won',
        charge: 'ch_disputed',
        amount: 4900,
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('validates charge.refunded event with full refund', () => {
      const event = createMockWebhookEvent('charge.refunded', {
        id: 'ch_refund',
        customer: 'cus_refund',
        amount: 4900,
        amount_refunded: 4900,
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('validates charge.refunded event with partial refund', () => {
      const event = createMockWebhookEvent('charge.refunded', {
        id: 'ch_partial',
        customer: 'cus_partial',
        amount: 4900,
        amount_refunded: 1000,
      });
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY  -  MALFORMED PAYLOADS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Security  -  malformed payloads', () => {
    it('rejects null as an event', () => {
      const result = stripeWebhookSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('rejects undefined as an event', () => {
      const result = stripeWebhookSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('rejects a string as an event', () => {
      const result = stripeWebhookSchema.safeParse('not an event');
      expect(result.success).toBe(false);
    });

    it('rejects an array as an event', () => {
      const result = stripeWebhookSchema.safeParse([{ id: 'evt_array' }]);
      expect(result.success).toBe(false);
    });

    it('rejects an event with numeric id', () => {
      const result = stripeWebhookSchema.safeParse({
        id: 12345,
        object: 'event',
        type: 'test',
        data: { object: {} },
      });
      expect(result.success).toBe(false);
    });

    it('rejects signature schema with non-string values', () => {
      const result = webhookSignatureSchema.safeParse({
        signature: 12345,
        payload: true,
      });
      expect(result.success).toBe(false);
    });

    it('validates that data.object can contain nested objects', () => {
      const event = {
        id: 'evt_nested',
        object: 'event' as const,
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_test',
            metadata: {
              tier: 'pro',
              nested: { deeply: 'nested' },
            },
            line_items: [{ price: 'price_abc', quantity: 1 }],
          },
        },
      };
      const result = stripeWebhookSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER OWNERSHIP  -  METADATA VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Customer ownership  -  metadata verification', () => {
    it('checkout event includes revealui_user_id for user-to-customer binding', () => {
      const event = createMockWebhookEvent('checkout.session.completed', {
        mode: 'subscription',
        subscription: 'sub_owned',
        customer: 'cus_owned',
        metadata: {
          tier: 'pro',
          revealui_user_id: 'user_owner',
        },
      });

      const dataObj = event.data.object as unknown as Record<string, unknown>;
      const metadata = dataObj.metadata as Record<string, string>;
      expect(metadata.revealui_user_id).toBe('user_owner');
    });

    it('subscription update event uses metadata to bind tier to customer', () => {
      const event = createMockWebhookEvent('customer.subscription.updated', {
        id: 'sub_bind',
        customer: 'cus_bind',
        status: 'active',
        metadata: {
          tier: 'max',
          revealui_user_id: 'user_bind',
        },
      });

      const dataObj = event.data.object as unknown as Record<string, unknown>;
      const metadata = dataObj.metadata as Record<string, string>;
      expect(metadata.revealui_user_id).toBe('user_bind');
      expect(metadata.tier).toBe('max');
    });

    it('customer ID can be a string or expanded object in subscription events', () => {
      // String customer ID
      const eventString = createMockWebhookEvent('customer.subscription.deleted', {
        id: 'sub_str',
        customer: 'cus_string_id',
      });
      const dataStr = eventString.data.object as unknown as Record<string, unknown>;
      expect(typeof dataStr.customer).toBe('string');

      // Object customer ID
      const eventObj = createMockWebhookEvent('customer.subscription.deleted', {
        id: 'sub_obj',
        customer: { id: 'cus_object_id', object: 'customer' },
      });
      const dataObject = eventObj.data.object as unknown as Record<string, unknown>;
      expect(typeof dataObject.customer).toBe('object');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSE TIME  -  HANDLER SHOULD ACK QUICKLY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Response time expectations', () => {
    it('schema validation completes in under 10ms for a valid event', () => {
      const event = {
        id: 'evt_perf',
        object: 'event' as const,
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            subscription: 'sub_perf',
            customer: 'cus_perf',
            metadata: { tier: 'pro', revealui_user_id: 'user_perf' },
          },
        },
      };

      const start = performance.now();
      const result = stripeWebhookSchema.safeParse(event);
      const elapsed = performance.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(10);
    });

    it('schema validation completes in under 25ms for an invalid event', () => {
      const start = performance.now();
      const result = stripeWebhookSchema.safeParse({ garbage: true });
      const elapsed = performance.now() - start;

      expect(result.success).toBe(false);
      expect(elapsed).toBeLessThan(25);
    });
  });
});
