import { describe, expect, it } from 'vitest';

import { createPaywall } from '../../core/paywall.js';
import { createNextGates } from '../next.js';

const paywall = createPaywall();
const { checkFeatureGate, checkTierGate } = createNextGates(paywall);

describe('checkFeatureGate', () => {
  it('returns null when feature is allowed', () => {
    expect(checkFeatureGate('ai', 'pro')).toBeNull();
    expect(checkFeatureGate('aiLocal', 'free')).toBeNull();
  });

  it('returns Response when feature is denied', async () => {
    const response = checkFeatureGate('ai', 'free');
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(403);

    const body = await response?.json();
    expect(body.error).toContain('AI Agents');
    expect(body.requiredTier).toBe('pro');
    expect(body.currentTier).toBe('free');
    expect(body.feature).toBe('ai');
    expect(body.upgradeUrl).toBe('/billing');
    expect(body.code).toBe('HTTP_403');
  });

  it('sets X-Paywall headers on denial', () => {
    const response = checkFeatureGate('ai', 'free');
    expect(response?.headers.get('X-Paywall-Feature')).toBe('ai');
    expect(response?.headers.get('X-Paywall-Required-Tier')).toBe('pro');
  });

  it('supports 402 status code override', () => {
    const response = checkFeatureGate('ai', 'free', { statusCode: 402 });
    expect(response?.status).toBe(402);
  });

  it('supports custom upgrade URL', async () => {
    const response = checkFeatureGate('ai', 'free', { upgradeUrl: '/pricing' });
    const body = await response?.json();
    expect(body.upgradeUrl).toBe('/pricing');
  });
});

describe('checkTierGate', () => {
  it('returns null when tier meets requirement', () => {
    expect(checkTierGate('pro', 'pro')).toBeNull();
    expect(checkTierGate('pro', 'enterprise')).toBeNull();
  });

  it('returns Response when tier is too low', async () => {
    const response = checkTierGate('pro', 'free');
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(403);

    const body = await response?.json();
    expect(body.requiredTier).toBe('pro');
    expect(body.currentTier).toBe('free');
  });

  it('does not set X-Paywall-Feature header on tier denials', () => {
    const response = checkTierGate('pro', 'free');
    expect(response?.headers.get('X-Paywall-Feature')).toBeNull();
    expect(response?.headers.get('X-Paywall-Required-Tier')).toBe('pro');
  });
});
