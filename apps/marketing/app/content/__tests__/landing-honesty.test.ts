import { describe, expect, it } from 'vitest';
import { HOME_HERO, HOME_PROBLEM } from '../home';
import { PRICING_TEASER_LINKS, PRICING_TEASER_TIERS } from '../pricing-teaser';
import { HOME_PRIMITIVES } from '../primitives';

describe('landing payment and Enterprise honesty', () => {
  it('qualifies Payments as test-mode checkout, not live take-money', () => {
    const payments = HOME_PRIMITIVES.find((item) => item.label === 'Payments');
    expect(payments).toBeDefined();
    const body = payments?.body.toLowerCase() ?? '';
    expect(body.includes('test-mode')).toBe(true);
    expect(body.includes('go live')).toBe(true);
    expect(body.includes('accept payments today')).toBe(false);
    expect(Object.hasOwn(payments ?? {}, 'color')).toBe(false);
  });

  it('qualifies the problem-matrix Billing cell the same way', () => {
    const billing = HOME_PROBLEM.rows.find((row) => row.capability === 'Billing');
    expect(billing).toBeDefined();
    const revealui = billing?.revealui.toLowerCase() ?? '';
    expect(revealui.includes('test-mode')).toBe(true);
    expect(revealui.includes('accept payments today')).toBe(false);
  });

  it('scopes Enterprise on the teaser to sales, without a Buy or trial CTA', () => {
    const enterprise = PRICING_TEASER_LINKS.find((link) => link.id === 'enterprise');
    expect(enterprise?.description).toBe('Enterprise is scoped with sales.');
    expect(enterprise?.href).toBe('/pricing');
    expect(enterprise?.description.toLowerCase().includes('buy')).toBe(false);
    expect(enterprise?.description.toLowerCase().includes('trial')).toBe(false);
  });

  it('keeps Start free and Pro checkout doors on the homepage teaser', () => {
    expect(HOME_HERO.cta.primary.label).toBe('Start free');
    expect(PRICING_TEASER_TIERS.find((tier) => tier.id === 'free')?.cta).toBe('Start free');
    expect(PRICING_TEASER_TIERS.find((tier) => tier.id === 'pro')?.href).toBe('/pricing');
  });
});
