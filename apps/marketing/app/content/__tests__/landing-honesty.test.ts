import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PRICE_FALLBACKS } from '../../lib/pricing-fallbacks';
import { HOME_DEMO, HOME_FAQ, HOME_HERO, HOME_HERO_FOUNDATION, HOME_PROBLEM } from '../home';
import { PRICING_HERO, PRICING_HIGHLIGHTED_BADGE } from '../pricing';
import {
  PRICING_TEASER_LINKS,
  PRICING_TEASER_SECTION,
  PRICING_TEASER_TIERS,
} from '../pricing-teaser';
import { HOME_PRIMITIVES } from '../primitives';
import { PRODUCTS_PAGE_HERO } from '../products';
import { QUOTE_CALCULATOR } from '../quote-calculator';
import { RECEIPT_HERO_CAPTION, RECEIPT_HERO_TITLE } from '../receipt';

const MARKETING_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const INDEX_HTML = readFileSync(join(MARKETING_ROOT, 'index.html'), 'utf8');
const LLMS_TXT = readFileSync(join(MARKETING_ROOT, 'public/llms.txt'), 'utf8');
const EM_DASH = String.fromCodePoint(0x2014);

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
  it('uses the locked known-for H1 and concrete subtitle', () => {
    expect(HOME_HERO.h1).toBe('The agentic business runtime startups operate on their own domain.');
    expect(HOME_HERO.subtitle.sentence1).toBe(
      'Technical founders and small agencies who already run agents. Existing tools report in, you keep the stack.',
    );
    expect(HOME_HERO.subtitle.sentence2).toBe(
      'Powerful and safe: PROOF is a receipted action when it matters, and the catalog matches checkout (Free / Pro $49 / Max $99/mo · $799/yr).',
    );
    expect(HOME_HERO.subtitle.support).toBe(
      'BYOK / open-weight default. Same plan rules for humans and agents.',
    );
    expect(HOME_HERO.subtitle.sentence2.includes('PROOF')).toBe(true);
    expect(HOME_HERO.subtitle.sentence2.includes('receipted action')).toBe(true);
    expect(INDEX_HTML.includes(HOME_HERO.subtitle.sentence2)).toBe(true);
  });

  it('keeps the locked problem heading', () => {
    expect(HOME_PROBLEM.heading).toBe(
      'Tired of tools that don’t talk, and agents you can’t audit?',
    );
  });

  it('keeps the governed-action receipt on the marketing home foil', () => {
    expect(RECEIPT_HERO_TITLE).toBe('Governed action, on record');
    expect(RECEIPT_HERO_CAPTION.text).toBe("If an agent did it, there's a receipt.");
    expect(RECEIPT_HERO_CAPTION.link.href).toBe(
      'https://docs.revealui.com/security/audit-receipts',
    );
    expect(RECEIPT_HERO_CAPTION.link.label).toBe('Audit receipts docs →');
  });

  it('replaces the foundation A/B with a distinct keep-the-stack line', () => {
    expect(HOME_HERO_FOUNDATION.h1).toBe('Existing tools report in. You keep the stack.');
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

  it('names Pro extras as agents with shared plan rules, not add agents', () => {
    expect(PRICING_TEASER_SECTION.heading).toBe(
      'Start free. Pro: agents with shared plan rules, MCP, and receipts (PROOF). Max is $99/mo.',
    );
    expect(PRICING_TEASER_SECTION.heading.includes('Pro adds agents')).toBe(false);
  });

  it('keeps the pricing H1 problem/PROOF-led with catalog in the sub', () => {
    expect(PRICING_HERO.eyebrow).toBe('Pricing');
    expect(PRICING_HERO.title).toBe('Tired of tools that don’t talk, and agents with no PROOF?');
    expect(PRICING_HERO.subtitle).toBe(
      'Self-host the agentic business runtime. Catalog: Free / Pro $49 / Max $99/mo · $799/yr. Studio work invoices on revealuistudio.com.',
    );
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
    expect(LIVE_PRODUCT_BLOB.includes('outcome validation')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('proof of work')).toBe(false);
    expect(LIVE_PRODUCT_BLOB.includes('proof-of-work')).toBe(false);
  });

  it('keeps Max at $99 and does not invent $299', () => {
    expect(SUBSCRIPTION_PRICE_FALLBACKS.max.price).toBe('$99');
    expect(LIVE_PRODUCT_BLOB.includes('$299')).toBe(false);
  });

  it('names the Pro badge and Google Meet without an em dash', () => {
    expect(PRICING_HIGHLIGHTED_BADGE).toBe('Recommended: Pro');
    expect(QUOTE_CALCULATOR.introCta.note).toBe('Google Calendar / Google Meet.');
    expect(QUOTE_CALCULATOR.introCta.note.includes(' / Meet.')).toBe(false);
    const locked = [
      HOME_HERO.subtitle.sentence1,
      HOME_PROBLEM.heading,
      PRICING_HERO.title,
      PRICING_HIGHLIGHTED_BADGE,
      QUOTE_CALCULATOR.introCta.note,
      INDEX_HTML,
      LLMS_TXT,
    ].join('\n');
    expect(locked.includes(EM_DASH)).toBe(false);
    expect(locked.includes('&mdash;')).toBe(false);
  });

  it('describes agent payment rails as code-present and flag-off, not unfinished', () => {
    const payments = HOME_FAQ.items.find((item) => item.question === 'How do agent payments work?');
    expect(payments?.answer.includes('X402_ENABLED')).toBe(true);
    expect(payments?.answer.includes('in development')).toBe(false);
    expect(payments?.answer.includes('unfinished')).toBe(false);
    expect(payments?.answer.includes('pricing page')).toBe(true);
  });
});
