import { BlockSchema } from '@revealui/contracts/content';
import { describe, expect, it } from 'vitest';
import {
  FAIR_SOURCE_CLOCK_SECTION,
  FAIR_SOURCE_CONTRACT_CARDS,
  FAIR_SOURCE_CONTRACT_SECTION,
  FAIR_SOURCE_CTA,
  FAIR_SOURCE_FAQ_SECTION,
  FAIR_SOURCE_FAQS,
  FAIR_SOURCE_PACKAGES_SECTION,
  FAIR_SOURCE_PEERS,
  FAIR_SOURCE_PEERS_SECTION,
} from '../content/fair-source';
import {
  FO_MANAGED_HERO,
  FO_MANAGED_PREREQS,
  FO_MANAGED_STATUS,
  FO_MANAGED_TODAY,
  FO_MANAGED_WAITLIST,
  FO_MANAGED_WOULD_BE,
} from '../content/for-operators-managed';
import { HOME_DEMO, HOME_FAQ, HOME_GET_STARTED } from '../content/home';
import { LOCAL_AI_PAGE, LOCAL_AI_SECTION } from '../content/local-ai';
import { PHILOSOPHY } from '../content/philosophy';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../content/primitives';
import { PRODUCTS_CTA_SECTION, PRODUCTS_FLAGSHIP, PRODUCTS_PAGE_HERO } from '../content/products';
import { METRICS } from '../content/site';
import {
  blocksMatchFallback,
  demoSlot,
  FAIR_SOURCE_FALLBACK_BLOCKS,
  FO_MANAGED_FALLBACK_BLOCKS,
  fairSourceBlocks,
  fairSourceClockSlot,
  fairSourceContractSlot,
  fairSourceCtaSlot,
  fairSourceFaqSlot,
  fairSourcePackagesIntroSlot,
  fairSourcePeersSlot,
  foManagedBlocks,
  foManagedHeroSlot,
  foManagedPrereqsSlot,
  foManagedStatusSlot,
  foManagedTodaySlot,
  foManagedWaitlistSlot,
  foManagedWouldBeSlot,
  getStartedSlot,
  HOME_FALLBACK_BLOCKS,
  homeBlocks,
  LOCAL_AI_FALLBACK_BLOCKS,
  localAiBlocks,
  localAiCtaSlot,
  localAiHeroSlot,
  localAiMarketProofSlot,
  localAiNotesSlot,
  localAiPillarsSlot,
  PHILOSOPHY_FALLBACK_BLOCKS,
  PRODUCTS_FALLBACK_BLOCKS,
  philosophyBlocks,
  philosophyBodySlot,
  philosophyCtaSlot,
  philosophyHeroSlot,
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
  it('produces schema-valid blocks for home, products, philosophy, local-ai, fair-source, and fo-managed', () => {
    for (const block of [
      ...homeBlocks(),
      ...productsBlocks(),
      ...philosophyBlocks(),
      ...localAiBlocks(),
      ...fairSourceBlocks(),
      ...foManagedBlocks(),
    ]) {
      expect(BlockSchema.safeParse(block).success).toBe(true);
    }
  });

  it('derives the expected block types per page in order', () => {
    expect(homeBlocks().map((b) => b.type)).toEqual(['section', 'section', 'ctaSection']);
    expect(productsBlocks().map((b) => b.type)).toEqual(['hero', 'section', 'ctaSection']);
    expect(philosophyBlocks().map((b) => b.type)).toEqual(['hero', 'section', 'ctaSection']);
    expect(localAiBlocks().map((b) => b.type)).toEqual([
      'hero',
      'section',
      'section',
      'section',
      'ctaSection',
    ]);
    expect(fairSourceBlocks().map((b) => b.type)).toEqual([
      'section',
      'section',
      'section',
      'section',
      'section',
      'ctaSection',
    ]);
    expect(foManagedBlocks().map((b) => b.type)).toEqual([
      'hero',
      'section',
      'section',
      'section',
      'section',
      'section',
    ]);
  });

  it('round-trips philosophy slots against the static content module', () => {
    const blocks = PHILOSOPHY_FALLBACK_BLOCKS;
    expect(philosophyHeroSlot(blocks).data).toEqual({
      eyebrow: PHILOSOPHY.eyebrow,
      h1: PHILOSOPHY.h1,
    });
    expect(philosophyBodySlot(blocks).data.sections.map((s) => s.body)).toEqual(
      PHILOSOPHY.sections.map((s) => s.body),
    );
    expect(philosophyCtaSlot(blocks).data).toEqual(PHILOSOPHY.cta);
  });

  it('round-trips local-ai slots against the static content module', () => {
    const blocks = LOCAL_AI_FALLBACK_BLOCKS;
    expect(localAiHeroSlot(blocks).data).toEqual({
      eyebrow: LOCAL_AI_PAGE.eyebrow,
      h1: LOCAL_AI_PAGE.h1,
      lead: LOCAL_AI_PAGE.lead,
    });
    expect(localAiPillarsSlot(blocks).data.pillars).toEqual(
      LOCAL_AI_PAGE.pillars.map((p) => ({ title: p.title, body: p.body })),
    );
    expect(localAiMarketProofSlot(blocks).data).toEqual({
      eyebrow: LOCAL_AI_PAGE.marketProof.eyebrow,
      heading: LOCAL_AI_PAGE.marketProof.heading,
      body: LOCAL_AI_PAGE.marketProof.body,
      adopters: LOCAL_AI_PAGE.marketProof.adopters.map((a) => ({
        name: a.name,
        detail: a.detail,
        source: a.source,
      })),
      disclaimer: LOCAL_AI_PAGE.marketProof.disclaimer,
    });
    expect(localAiNotesSlot(blocks).data).toEqual({
      dogfood: LOCAL_AI_SECTION.dogfood,
      honesty: LOCAL_AI_PAGE.honesty,
      roadmapHeading: LOCAL_AI_PAGE.roadmap.heading,
      roadmapBody: LOCAL_AI_PAGE.roadmap.body,
      roadmapHref: LOCAL_AI_PAGE.roadmap.href,
      snippetCaption: LOCAL_AI_SECTION.snippet.caption,
    });
    expect(localAiCtaSlot(blocks).data).toEqual(LOCAL_AI_PAGE.cta);
  });

  it('round-trips fair-source slots against the static content module', () => {
    const blocks = FAIR_SOURCE_FALLBACK_BLOCKS;
    expect(fairSourceContractSlot(blocks).data).toEqual({
      eyebrow: FAIR_SOURCE_CONTRACT_SECTION.eyebrow,
      heading: FAIR_SOURCE_CONTRACT_SECTION.heading,
      cards: FAIR_SOURCE_CONTRACT_CARDS.map((c) => ({
        kind: c.kind,
        title: c.title,
        body: c.body,
      })),
    });
    const packagesIntro = fairSourcePackagesIntroSlot(blocks).data;
    expect(packagesIntro.eyebrow).toBe(FAIR_SOURCE_PACKAGES_SECTION.eyebrow);
    expect(packagesIntro.heading).toBe(FAIR_SOURCE_PACKAGES_SECTION.heading);
    expect(packagesIntro.body).toContain(FAIR_SOURCE_PACKAGES_SECTION.body.privatePackage);
    expect(packagesIntro.footerCommand).toBe(FAIR_SOURCE_PACKAGES_SECTION.footer.command);
    expect(fairSourceClockSlot(blocks).data).toEqual({
      eyebrow: FAIR_SOURCE_CLOCK_SECTION.eyebrow,
      heading: FAIR_SOURCE_CLOCK_SECTION.heading,
      body: FAIR_SOURCE_CLOCK_SECTION.body,
      steps: FAIR_SOURCE_CLOCK_SECTION.steps.map((s) => ({
        title: s.title,
        body: s.body,
        color: s.color,
      })),
    });
    expect(fairSourcePeersSlot(blocks).data).toEqual({
      eyebrow: FAIR_SOURCE_PEERS_SECTION.eyebrow,
      heading: FAIR_SOURCE_PEERS_SECTION.heading,
      peers: FAIR_SOURCE_PEERS.map((p) => ({ name: p.name, note: p.note, url: p.url })),
    });
    expect(fairSourceFaqSlot(blocks).data).toEqual({
      eyebrow: FAIR_SOURCE_FAQ_SECTION.eyebrow,
      heading: FAIR_SOURCE_FAQ_SECTION.heading,
      items: FAIR_SOURCE_FAQS.map((f) => ({ question: f.question, answer: f.answer })),
    });
    expect(fairSourceCtaSlot(blocks).data).toEqual({
      heading: FAIR_SOURCE_CTA.heading,
      body: FAIR_SOURCE_CTA.body,
      primary: { label: FAIR_SOURCE_CTA.primaryLabel, href: FAIR_SOURCE_CTA.primaryHref },
      secondary: { label: FAIR_SOURCE_CTA.secondaryLabel, href: FAIR_SOURCE_CTA.secondaryHref },
    });
  });

  it('round-trips fo-managed slots against for-operators-managed content', () => {
    const blocks = FO_MANAGED_FALLBACK_BLOCKS;
    expect(foManagedHeroSlot(blocks).data).toEqual({
      eyebrow: FO_MANAGED_HERO.eyebrow,
      h1Lines: [...FO_MANAGED_HERO.h1Lines],
      subtitle: FO_MANAGED_HERO.subtitle,
      backLink: FO_MANAGED_HERO.backLink,
    });
    expect(foManagedStatusSlot(blocks).data).toEqual({ ...FO_MANAGED_STATUS });
    expect(foManagedWouldBeSlot(blocks).data).toEqual({
      eyebrow: FO_MANAGED_WOULD_BE.eyebrow,
      heading: FO_MANAGED_WOULD_BE.heading,
      capabilities: FO_MANAGED_WOULD_BE.capabilities.map((c) => ({
        title: c.title,
        body: c.body,
      })),
      closing: FO_MANAGED_WOULD_BE.closing,
    });
    expect(foManagedPrereqsSlot(blocks).data).toEqual({
      eyebrow: FO_MANAGED_PREREQS.eyebrow,
      heading: FO_MANAGED_PREREQS.heading,
      intro: FO_MANAGED_PREREQS.intro,
      prerequisites: FO_MANAGED_PREREQS.prerequisites.map((p) => ({
        title: p.title,
        body: p.body,
      })),
      closing: FO_MANAGED_PREREQS.closing,
    });
    expect(foManagedTodaySlot(blocks).data).toEqual({
      eyebrow: FO_MANAGED_TODAY.eyebrow,
      heading: FO_MANAGED_TODAY.heading,
      body: FO_MANAGED_TODAY.body,
      primaryCta: FO_MANAGED_TODAY.primaryCta,
      detailLink: FO_MANAGED_TODAY.detailLink,
    });
    expect(foManagedWaitlistSlot(blocks).data).toEqual({
      eyebrow: FO_MANAGED_WAITLIST.eyebrow,
      heading: FO_MANAGED_WAITLIST.heading,
      body: FO_MANAGED_WAITLIST.body,
      inputPlaceholder: FO_MANAGED_WAITLIST.inputPlaceholder,
      buttonLabel: FO_MANAGED_WAITLIST.buttonLabel,
      buttonLabelLoading: FO_MANAGED_WAITLIST.buttonLabelLoading,
      successMessage: FO_MANAGED_WAITLIST.successMessage,
    });
    // product source tag never enters blocks
    expect(collectStrings(foManagedBlocks()).join(' ')).not.toContain('managed-cloud');
  });
});

describe('claims safety: prose is single-sourced, pinned values never enter blocks', () => {
  const strings = collectStrings([
    homeBlocks(),
    productsBlocks(),
    philosophyBlocks(),
    localAiBlocks(),
    fairSourceBlocks(),
    foManagedBlocks(),
  ]);
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
    expect(strings).toContain(PHILOSOPHY.eyebrow);
    expect(strings).toContain(PHILOSOPHY.h1);
    for (const section of PHILOSOPHY.sections) {
      expect(strings).toContain(section.body);
    }
    expect(strings).toContain(PHILOSOPHY.cta.primary.label);
    expect(strings).toContain(PHILOSOPHY.cta.secondary.label);
    expect(strings).toContain(LOCAL_AI_PAGE.h1);
    expect(strings).toContain(LOCAL_AI_PAGE.lead);
    for (const pillar of LOCAL_AI_PAGE.pillars) {
      expect(strings).toContain(pillar.title);
      expect(strings).toContain(pillar.body);
    }
    expect(strings).toContain(LOCAL_AI_PAGE.marketProof.heading);
    expect(strings).toContain(LOCAL_AI_SECTION.snippet.caption);
    expect(strings).toContain(FAIR_SOURCE_CONTRACT_SECTION.heading);
    for (const card of FAIR_SOURCE_CONTRACT_CARDS) {
      expect(strings).toContain(card.title);
      expect(strings).toContain(card.body);
    }
    expect(strings).toContain(FAIR_SOURCE_CTA.heading);
    expect(strings).toContain(FAIR_SOURCE_CTA.body);
    expect(strings).toContain(FO_MANAGED_HERO.subtitle);
    expect(strings).toContain(FO_MANAGED_STATUS.heading);
    expect(strings).toContain(FO_MANAGED_WAITLIST.heading);
    // Env-code lines stay out of blocks (grep-accurate, component-local).
    expect(strings).not.toContain('LLM_PROVIDER=inference-snaps');
    expect(strings).not.toContain('LLM_PROVIDER=ollama');
  });

  it('never carries metric-derived numbers, prices, or product versions', () => {
    // Product version strings stay in the flagship card TSX, never in blocks.
    expect(haystack).not.toContain(PRODUCTS_FLAGSHIP.version);
    // The pro price lives only on the pricing surfaces, never in a block.
    expect(haystack).not.toContain(SUBSCRIPTION_PRICE_FALLBACKS.pro.price);
    // Metric counters are rendered from METRICS in TSX, never as block prose.
    // Fair-source hero (which interpolates METRICS) is intentionally not in blocks.
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
    expect(slot.path).toBe('blocks.0.data');
    expect(slot.data.eyebrow).toBe(HOME_DEMO.eyebrow);
    expect(slot.data.heading).toBe(HOME_DEMO.heading);
    expect(slot.data.body).toBe(HOME_DEMO.body);
    expect(slot.data.beats).toEqual(
      HOME_DEMO.beats.map((b) => ({ n: b.n, title: b.title, body: b.body })),
    );
  });

  it('reconstructs the primitives data byte-identical to its content modules', () => {
    const slot = primitivesSlot(homeBlocks());
    expect(slot.path).toBe('blocks.1.data');
    expect(slot.data.eyebrow).toBe(HOME_PRIMITIVES_SECTION.eyebrow);
    expect(slot.data.heading).toBe(HOME_PRIMITIVES_SECTION.heading);
    expect(slot.data.body).toBe(HOME_PRIMITIVES_SECTION.body);
    expect(slot.data.items).toEqual(HOME_PRIMITIVES.map((p) => ({ label: p.label, body: p.body })));
  });

  it('reconstructs the get-started data byte-identical to HOME_GET_STARTED', () => {
    const slot = getStartedSlot(homeBlocks());
    expect(slot.path).toBe('blocks.2.data');
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
    expect(hero.path).toBe('blocks.0.data');
    expect(hero.data.h1).toBe(PRODUCTS_PAGE_HERO.h1);
    expect(hero.data.subtitle).toBe(PRODUCTS_PAGE_HERO.subtitle);

    const faq = productsFaqSlot(productsBlocks());
    expect(faq.path).toBe('blocks.1.data');
    expect(faq.data.eyebrow).toBe(HOME_FAQ.eyebrow);
    expect(faq.data.heading).toBe(HOME_FAQ.heading);
    expect(faq.data.items).toEqual(
      HOME_FAQ.items.map((i) => ({ question: i.question, answer: i.answer })),
    );

    const cta = productsCtaSlot(productsBlocks());
    expect(cta.path).toBe('blocks.2.data');
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
    expect(blocksMatchFallback(philosophyBlocks(), PHILOSOPHY_FALLBACK_BLOCKS)).toBe(true);
    expect(blocksMatchFallback(fairSourceBlocks(), FAIR_SOURCE_FALLBACK_BLOCKS)).toBe(true);
  });

  it('rejects empty, wrong-length, and wrong-type arrays', () => {
    expect(blocksMatchFallback([], HOME_FALLBACK_BLOCKS)).toBe(false);
    expect(blocksMatchFallback(homeBlocks().slice(0, 1), HOME_FALLBACK_BLOCKS)).toBe(false);
    // Same length (3), wrong type at position 0 (hero where a section is expected).
    const swapped = [...productsBlocks().slice(0, 1), ...homeBlocks().slice(1, 3)];
    expect(blocksMatchFallback(swapped, HOME_FALLBACK_BLOCKS)).toBe(false);
  });
});
