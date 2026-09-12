import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PRICE_FALLBACKS } from '../../lib/pricing-fallbacks';
import { HOME_DEMO, HOME_FAQ, HOME_HERO, HOME_HERO_FOUNDATION, HOME_PROBLEM } from '../home';
import {
  PRICING_TEASER_LINKS,
  PRICING_TEASER_SECTION,
  PRICING_TEASER_TIERS,
} from '../pricing-teaser';
import { HOME_PRIMITIVES } from '../primitives';
import { PRODUCTS_PAGE_HERO } from '../products';
import { RECEIPT_HERO_CAPTION } from '../receipt';

const MARKETING_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const INDEX_HTML = readFileSync(join(MARKETING_ROOT, 'index.html'), 'utf8');

const LIVE_PRODUCT_BLOB = [
  HOME_HERO.h1,
  HOME_HERO.subtitle.sentence1,
  HOME_HERO.subtitle.sentence2,
  HOME_HERO.subtitle.support,
  HOME_HERO_FOUNDATION.h1,
  HOME_PROBLEM.heading,
  HOME_PROBLEM.body,
  HOME_DEMO.eyebrow,
  HOME_DEMO.heading,
  HOME_DEMO.body,
  ...HOME_DEMO.beats.map((beat) => `${beat.title} ${beat.body}`),
  HOME_FAQ.heading,
  ...HOME_FAQ.items.map((item) => `${item.question} ${item.answer}`),
  PRICING_TEASER_SECTION.heading,
  PRICING_TEASER_SECTION.body,
  PRODUCTS_PAGE_HERO.h1,
  PRODUCTS_PAGE_HERO.subtitle,
  INDEX_HTML,
].join('\n');

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

  it('does not sell RevKit, RevForge, or Fleet as a Max or catalog path', () => {
    const blob = [...PRICING_TEASER_TIERS, ...PRICING_TEASER_LINKS]
      .map((item) => `${item.name} ${item.description}`)
      .join(' ');
    expect(blob.includes('RevKit')).toBe(false);
    expect(blob.includes('RevForge')).toBe(false);
    expect(blob.includes('RevDev')).toBe(false);
    expect(blob.includes('Fleet kit')).toBe(false);
    const max = PRICING_TEASER_LINKS.find((link) => link.id === 'max');
    expect(max?.description).toBe('Max adds unattended inference and higher limits.');
  });

  it('keeps Start free and Pro checkout doors on the homepage teaser', () => {
    expect(HOME_HERO.cta.primary.label).toBe('Start free');
    expect(PRICING_TEASER_TIERS.find((tier) => tier.id === 'free')?.cta).toBe('Start free');
    expect(PRICING_TEASER_TIERS.find((tier) => tier.id === 'pro')?.href).toBe('/pricing');
  });
});

describe('Auditor voice and live-hero honesty', () => {
  it('uses the locked self-hosted runtime H1 and concrete subtitle', () => {
    expect(HOME_HERO.h1).toBe(
      'One self-hosted runtime for your business and the agents that run it.',
    );
    expect(HOME_HERO.subtitle.sentence1).toBe(
      'Your business and the agents that run it share the same data, sign-in, and plan rules on infrastructure you own.',
    );
    expect(HOME_HERO.subtitle.sentence2).toBe(
      'Every agent is a governed and audited user that lives on your infrastructure.',
    );
    expect(HOME_HERO.subtitle.support).toBe('It runs on any AI provider you choose.');
  });

  it('keeps the locked problem heading', () => {
    expect(HOME_PROBLEM.heading).toBe(
      'Tired of tools that don’t talk — and agents you can’t audit?',
    );
  });

  it('keeps receipt honesty on the hero foil', () => {
    expect(RECEIPT_HERO_CAPTION.text).toBe("If an agent did it, there's a receipt.");
  });

  it('replaces the foundation A/B with a distinct entitlement/receipt line', () => {
    expect(HOME_HERO_FOUNDATION.h1).toBe(
      'Plan rules and a receipt still apply when an agent acts.',
    );
    expect(HOME_HERO_FOUNDATION.h1).not.toBe(HOME_HERO.h1);
    expect(HOME_HERO_FOUNDATION.h1.toLowerCase().includes('foundation')).toBe(false);
  });

  it('uses concrete demo beats instead of parallel slogan cadence', () => {
    expect(HOME_DEMO.eyebrow).toBe('See a local stack');
    expect(HOME_DEMO.heading).toBe(
      'Install locally. Test checkout. Point an agent at the same data.',
    );
    expect(HOME_DEMO.body.toLowerCase().includes('minute')).toBe(true);
    expect(HOME_DEMO.beats[0]?.title).toBe('Install locally.');
    expect(HOME_DEMO.beats[1]?.title).toBe('Run a test checkout.');
    expect(HOME_DEMO.beats[2]?.title).toBe('Point an agent at the same data.');
  });

  it('states Postgres and deploy ownership without the prison metaphor', () => {
    expect(HOME_FAQ.heading).toBe('Questions');
    expect(HOME_FAQ.items[0]?.answer).toBe(
      'Your data stays in Postgres you control. Your deploy stays on infra you choose. Your code stays in your repo. Details live in the docs.',
    );
  });

  it('names Pro extras instead of Pay when you scale', () => {
    expect(PRICING_TEASER_SECTION.heading).toBe('Start free. Pro adds agents, MCP, and receipts.');
  });

  it('keeps the products hero as licenses, not invented SKUs', () => {
    expect(PRODUCTS_PAGE_HERO.h1.toLowerCase().includes('license')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('Free')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('Pro')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('Max')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.toLowerCase().includes('zero paying')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('RevDev')).toBe(false);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('RevForge')).toBe(false);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('RevKit')).toBe(false);
  });

  it('bans stock metaphors and anti-avatar claims on live product heroes', () => {
    expect(LIVE_PRODUCT_BLOB.includes('under one roof')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('not the prison')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('Watch it work')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('Pay when you scale')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('The foundation your business runs on.')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('Maryville')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('Jobber')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('QuickBooks')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('hosted chatbot')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('SOC 2 this quarter')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('SOC2-this-quarter')).toBe(false);
  });

  it('keeps Max at $99 and does not invent $299', () => {
    expect(SUBSCRIPTION_PRICE_FALLBACKS.max.price).toBe('$99');
    expect(LIVE_PRODUCT_BLOB.includes('$299')).toBe(false);
  });
});
