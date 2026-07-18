import { BlockSchema } from '@revealui/contracts/content';
import { describe, expect, it } from 'vitest';
import { HOME_DEMO, HOME_FAQ, HOME_GET_STARTED } from '../content/home';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../content/primitives';
import { PRODUCTS_CTA_SECTION, PRODUCTS_FLAGSHIP, PRODUCTS_PAGE_HERO } from '../content/products';
import { METRICS } from '../content/site';
import {
  blocksMatchFallback,
  demoSlot,
  getStartedSlot,
  HOME_FALLBACK_BLOCKS,
  homeBlocks,
  PRODUCTS_FALLBACK_BLOCKS,
  primitivesSlot,
  productsBlocks,
  productsCtaSlot,
  productsFaqSlot,
  productsHeroSlot,
} from './page-blocks';
import { SUBSCRIPTION_PRICE_FALLBACKS } from './pricing-fallbacks';

/** Collect every string value reachable in a JSON-ish value. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

describe('page-blocks derivation', () => {
  it('produces schema-valid blocks for both pages', () => {
    for (const block of [...homeBlocks(), ...productsBlocks()]) {
      expect(BlockSchema.safeParse(block).success).toBe(true);
    }
  });

  it('derives the expected block types per page in order', () => {
    expect(homeBlocks().map((b) => b.type)).toEqual(['section', 'section', 'ctaSection']);
    expect(productsBlocks().map((b) => b.type)).toEqual(['hero', 'section', 'ctaSection']);
  });
});

describe('claims safety: prose is single-sourced, pinned values never enter blocks', () => {
  const strings = collectStrings([homeBlocks(), productsBlocks()]);
  const haystack = strings.join(' ');

  it('carries the copy sentences byte-identical to the content modules', () => {
    expect(strings).toContain(HOME_DEMO.heading);
    expect(strings).toContain(HOME_DEMO.body);
    for (const beat of HOME_DEMO.beats) {
      expect(strings).toContain(beat.title);
      expect(strings).toContain(beat.body);
    }
    expect(strings).toContain(HOME_PRIMITIVES_SECTION.heading);
    expect(strings).toContain(HOME_PRIMITIVES_SECTION.body);
    for (const primitive of HOME_PRIMITIVES) {
      expect(strings).toContain(primitive.label);
      expect(strings).toContain(primitive.body);
    }
    expect(strings).toContain(HOME_GET_STARTED.heading);
    expect(strings).toContain(HOME_GET_STARTED.body);
    expect(strings).toContain(HOME_GET_STARTED.cli.caption);
    expect(strings).toContain(PRODUCTS_PAGE_HERO.h1);
    expect(strings).toContain(PRODUCTS_PAGE_HERO.subtitle);
    for (const item of HOME_FAQ.items) {
      expect(strings).toContain(item.question);
      expect(strings).toContain(item.answer);
    }
    expect(strings).toContain(PRODUCTS_CTA_SECTION.heading);
    expect(strings).toContain(PRODUCTS_CTA_SECTION.body);
  });

  it('never carries metric-derived numbers, prices, or product versions', () => {
    // Product version strings stay in the flagship card TSX, never in blocks.
    expect(haystack).not.toContain(PRODUCTS_FLAGSHIP.version);
    // The pro price lives only on the pricing surfaces, never in a block.
    expect(haystack).not.toContain(SUBSCRIPTION_PRICE_FALLBACKS.pro.price);
    // Metric counters are rendered from METRICS in TSX, never as block prose.
    for (const metric of [METRICS.packages, METRICS.dbTables, METRICS.mcpServers]) {
      expect(strings).not.toContain(String(metric));
    }
    // Primitive colors + icon paths are structural, never block prose.
    for (const primitive of HOME_PRIMITIVES) {
      expect(strings).not.toContain(primitive.iconPath);
    }
  });
});

describe('reverse mappers round-trip the derivation losslessly', () => {
  it('reconstructs the demo data byte-identical to HOME_DEMO', () => {
    const slot = demoSlot(homeBlocks());
    expect(slot.path).toBe('blocks.0');
    expect(slot.data.eyebrow).toBe(HOME_DEMO.eyebrow);
    expect(slot.data.heading).toBe(HOME_DEMO.heading);
    expect(slot.data.body).toBe(HOME_DEMO.body);
    expect(slot.data.beats).toEqual(
      HOME_DEMO.beats.map((b) => ({ n: b.n, title: b.title, body: b.body })),
    );
  });

  it('reconstructs the primitives data byte-identical to its content modules', () => {
    const slot = primitivesSlot(homeBlocks());
    expect(slot.path).toBe('blocks.1');
    expect(slot.data.eyebrow).toBe(HOME_PRIMITIVES_SECTION.eyebrow);
    expect(slot.data.heading).toBe(HOME_PRIMITIVES_SECTION.heading);
    expect(slot.data.body).toBe(HOME_PRIMITIVES_SECTION.body);
    expect(slot.data.items).toEqual(HOME_PRIMITIVES.map((p) => ({ label: p.label, body: p.body })));
  });

  it('reconstructs the get-started data byte-identical to HOME_GET_STARTED', () => {
    const slot = getStartedSlot(homeBlocks());
    expect(slot.path).toBe('blocks.2');
    expect(slot.data.heading).toBe(HOME_GET_STARTED.heading);
    expect(slot.data.body).toBe(HOME_GET_STARTED.body);
    expect(slot.data.cta.primary).toEqual({
      label: HOME_GET_STARTED.cta.primary.label,
      href: HOME_GET_STARTED.cta.primary.href,
    });
    expect(slot.data.cta.secondary).toEqual({
      label: HOME_GET_STARTED.cta.secondary.label,
      href: HOME_GET_STARTED.cta.secondary.href,
    });
    expect(slot.data.cli.command).toEqual([...HOME_GET_STARTED.cli.command]);
    expect(slot.data.cli.caption).toBe(HOME_GET_STARTED.cli.caption);
    expect(slot.data.newsletter).toEqual(HOME_GET_STARTED.newsletter);
  });

  it('reconstructs the products hero, faq, and cta byte-identical to their modules', () => {
    const hero = productsHeroSlot(productsBlocks());
    expect(hero.path).toBe('blocks.0');
    expect(hero.data.h1).toBe(PRODUCTS_PAGE_HERO.h1);
    expect(hero.data.subtitle).toBe(PRODUCTS_PAGE_HERO.subtitle);

    const faq = productsFaqSlot(productsBlocks());
    expect(faq.path).toBe('blocks.1');
    expect(faq.data.eyebrow).toBe(HOME_FAQ.eyebrow);
    expect(faq.data.heading).toBe(HOME_FAQ.heading);
    expect(faq.data.items).toEqual(
      HOME_FAQ.items.map((i) => ({ question: i.question, answer: i.answer })),
    );

    const cta = productsCtaSlot(productsBlocks());
    expect(cta.path).toBe('blocks.2');
    expect(cta.data.heading).toBe(PRODUCTS_CTA_SECTION.heading);
    expect(cta.data.body).toBe(PRODUCTS_CTA_SECTION.body);
    expect(cta.data.cliSnippet).toBe(PRODUCTS_CTA_SECTION.cliSnippet);
    expect(cta.data.cta.docs).toEqual({
      label: PRODUCTS_CTA_SECTION.cta.docs.label,
      href: PRODUCTS_CTA_SECTION.cta.docs.href,
    });
    expect(cta.data.cta.pricing).toEqual({
      label: PRODUCTS_CTA_SECTION.cta.pricing.label,
      href: PRODUCTS_CTA_SECTION.cta.pricing.href,
    });
  });
});

describe('blocksMatchFallback shape guard', () => {
  it('accepts an array with matching length + per-position types', () => {
    expect(blocksMatchFallback(homeBlocks(), HOME_FALLBACK_BLOCKS)).toBe(true);
    expect(blocksMatchFallback(productsBlocks(), PRODUCTS_FALLBACK_BLOCKS)).toBe(true);
  });

  it('rejects empty, wrong-length, and wrong-type arrays', () => {
    expect(blocksMatchFallback([], HOME_FALLBACK_BLOCKS)).toBe(false);
    expect(blocksMatchFallback(homeBlocks().slice(0, 1), HOME_FALLBACK_BLOCKS)).toBe(false);
    // Same length (3), wrong type at position 0 (hero where a section is expected).
    const swapped = [...productsBlocks().slice(0, 1), ...homeBlocks().slice(1, 3)];
    expect(blocksMatchFallback(swapped, HOME_FALLBACK_BLOCKS)).toBe(false);
  });
});
