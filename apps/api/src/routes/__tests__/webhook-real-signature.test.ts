/**
 * Real Stripe Signature Verification Tests (T-09)
 *
 * Unlike other webhook tests that mock constructEventAsync,
 * these tests use the REAL Stripe SDK signature verification
 * to ensure our integration is correct end-to-end.
 */

import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';

const TEST_SECRET = 'whsec_test_real_signature_verification_secret';

describe('Stripe webhook — real signature verification', () => {
  const stripe = new Stripe('sk_test_dummy', { apiVersion: '2025-03-31.basil' });

  it('verifies a correctly signed payload', () => {
    const payload = JSON.stringify({
      id: 'evt_real_sig',
      type: 'checkout.session.completed',
      data: { object: {} },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    });

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_SECRET,
    });

    const event = stripe.webhooks.constructEvent(payload, header, TEST_SECRET);
    expect(event.id).toBe('evt_real_sig');
    expect(event.type).toBe('checkout.session.completed');
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({
      id: 'evt_tampered',
      type: 'test.event',
      data: { object: {} },
    });

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_SECRET,
    });

    // Tamper with the payload after signing
    const tampered = payload.replace('evt_tampered', 'evt_malicious');

    expect(() => stripe.webhooks.constructEvent(tampered, header, TEST_SECRET)).toThrow(
      /signature/i,
    );
  });

  it('rejects with wrong webhook secret', () => {
    const payload = JSON.stringify({
      id: 'evt_wrong_secret',
      type: 'test.event',
      data: { object: {} },
    });

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_SECRET,
    });

    expect(() => stripe.webhooks.constructEvent(payload, header, 'whsec_wrong_secret')).toThrow(
      /signature/i,
    );
  });

  it('rejects an expired timestamp', () => {
    const payload = JSON.stringify({
      id: 'evt_expired',
      type: 'test.event',
      data: { object: {} },
    });

    // Generate signature with a timestamp 10 minutes in the past
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 600,
    });

    // Stripe SDK default tolerance is 300s
    expect(() => stripe.webhooks.constructEvent(payload, header, TEST_SECRET)).toThrow(
      /timestamp/i,
    );
  });

  it('accepts a recent timestamp within tolerance', () => {
    const payload = JSON.stringify({
      id: 'evt_recent',
      type: 'test.event',
      data: { object: {} },
    });

    // 60 seconds ago — within the 300s tolerance
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 60,
    });

    const event = stripe.webhooks.constructEvent(payload, header, TEST_SECRET);
    expect(event.id).toBe('evt_recent');
  });

  it('rejects a completely missing signature', () => {
    const payload = JSON.stringify({
      id: 'evt_no_sig',
      type: 'test.event',
      data: { object: {} },
    });

    expect(() => stripe.webhooks.constructEvent(payload, '', TEST_SECRET)).toThrow();
  });

  it('rejects a malformed signature header', () => {
    const payload = JSON.stringify({
      id: 'evt_bad_header',
      type: 'test.event',
      data: { object: {} },
    });

    expect(() =>
      stripe.webhooks.constructEvent(payload, 'not-a-valid-signature', TEST_SECRET),
    ).toThrow();
  });

  it('signature is computed from raw body bytes', () => {
    // Unicode payload to test byte-level signing
    const payload = JSON.stringify({
      id: 'evt_unicode',
      type: 'test.event',
      data: { object: { name: 'テスト' } },
    });

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_SECRET,
    });

    const event = stripe.webhooks.constructEvent(payload, header, TEST_SECRET);
    expect(event.id).toBe('evt_unicode');
  });
});
