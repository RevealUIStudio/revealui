/**
 * Unit tests for the Stripe mode classification + coherence rule
 * (packages/services/src/stripe/mode.ts) — the single source of truth shared by
 * the runtime money-boundary guard (getStripe) and the boot-time env validator
 * (apps/server validate-startup). Pure functions, no mocks.
 */

import { describe, expect, it } from 'vitest';
import {
  checkStripeModeCoherence,
  classifyStripePublishableKey,
  classifyStripeSecretKey,
} from '../src/stripe/mode.js';

describe('classifyStripeSecretKey', () => {
  it('classifies full live + test secret keys', () => {
    expect(classifyStripeSecretKey('sk_live_abc')).toBe('live');
    expect(classifyStripeSecretKey('sk_test_abc')).toBe('test');
  });

  it('classifies restricted (rk_) live + test keys', () => {
    expect(classifyStripeSecretKey('rk_live_abc')).toBe('live');
    expect(classifyStripeSecretKey('rk_test_abc')).toBe('test');
  });

  it('returns unknown for empty, publishable, or malformed keys', () => {
    expect(classifyStripeSecretKey('')).toBe('unknown');
    expect(classifyStripeSecretKey('pk_live_abc')).toBe('unknown');
    expect(classifyStripeSecretKey('whsec_abc')).toBe('unknown');
    expect(classifyStripeSecretKey('not-a-key')).toBe('unknown');
  });
});

describe('classifyStripePublishableKey', () => {
  it('classifies live + test publishable keys', () => {
    expect(classifyStripePublishableKey('pk_live_abc')).toBe('live');
    expect(classifyStripePublishableKey('pk_test_abc')).toBe('test');
  });

  it('returns unknown for empty, secret, or malformed keys', () => {
    expect(classifyStripePublishableKey('')).toBe('unknown');
    expect(classifyStripePublishableKey('sk_live_abc')).toBe('unknown');
    expect(classifyStripePublishableKey('garbage')).toBe('unknown');
  });
});

describe('checkStripeModeCoherence', () => {
  it('accepts a live key in live mode', () => {
    const r = checkStripeModeCoherence('sk_live_abc', true);
    expect(r.ok).toBe(true);
    expect(r.keyMode).toBe('live');
    expect(r.liveMode).toBe(true);
    expect(r.message).toBeUndefined();
  });

  it('accepts a test key in test mode', () => {
    const r = checkStripeModeCoherence('sk_test_abc', false);
    expect(r.ok).toBe(true);
    expect(r.keyMode).toBe('test');
  });

  it('rejects a live key when live mode is off (the production split state)', () => {
    const r = checkStripeModeCoherence('sk_live_realmoney', false);
    expect(r.ok).toBe(false);
    expect(r.keyMode).toBe('live');
    expect(r.message).toContain('MODE MISMATCH');
    expect(r.message).toContain('STRIPE_LIVE_MODE');
    // names the downstream symptom so the operator connects this to the bug
    expect(r.message).toContain('StripeInvalidRequestError');
  });

  it('rejects a test key when live mode is on', () => {
    const r = checkStripeModeCoherence('sk_test_abc', true);
    expect(r.ok).toBe(false);
    expect(r.keyMode).toBe('test');
    expect(r.message).toContain('MODE MISMATCH');
    expect(r.message).toContain('test key');
  });

  it('rejects a restricted live key when live mode is off', () => {
    const r = checkStripeModeCoherence('rk_live_abc', false);
    expect(r.ok).toBe(false);
    expect(r.keyMode).toBe('live');
  });

  it('tolerates an unclassifiable key in either mode (defers to Stripe)', () => {
    expect(checkStripeModeCoherence('garbage', true).ok).toBe(true);
    expect(checkStripeModeCoherence('garbage', false).ok).toBe(true);
    expect(checkStripeModeCoherence('garbage', true).keyMode).toBe('unknown');
  });
});
