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
  FOR_OPERATORS_CLOSING,
  FOR_OPERATORS_DISCOVERY,
  FOR_OPERATORS_HERO,
  FOR_OPERATORS_HOW_WE_DELIVER,
  FOR_OPERATORS_PRICING,
  FOR_OPERATORS_PROOF,
  FOR_OPERATORS_WHAT_YOU_GET,
} from '../content/for-operators';
import {
  FO_HIW_CLOSING,
  FO_HIW_FEAR,
  FO_HIW_HERO,
  FO_HIW_OWNERSHIP,
  FO_HIW_STEPS,
  FO_HIW_TIMELINE,
} from '../content/for-operators-how-it-works';
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
  FO_HIW_FALLBACK_BLOCKS,
  fairSourceBlocks,
  fairSourceClockSlot,
  fairSourceContractSlot,
  fairSourceCtaSlot,
  fairSourceFaqSlot,
  fairSourcePackagesIntroSlot,
  fairSourcePeersSlot,
  foHiwBlocks,
  foHiwCtaSlot,
  foHiwFearSlot,
  foHiwHeroSlot,
  foHiwOwnershipSlot,
  foHiwStepsSlot,
  foHiwTimelineSlot,
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
  SERVICES_FALLBACK_BLOCKS,
  servicesBlocks,
  servicesCtaSlot,
  servicesDiscoverySlot,
  servicesHeroSlot,
  servicesHowWeDeliverSlot,
  servicesPricingIntroSlot,
  servicesProofSlot,
  servicesWhatYouGetSlot,
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
  it('produces schema-valid blocks for home, products, philosophy, local-ai, fair-source, services, and fo-hiw', () => {
    for (const block of [
      ...homeBlocks(),
      ...productsBlocks(),
      ...philosophyBlocks(),
      ...localAiBlocks(),
      ...fairSourceBlocks(),
      ...servicesBlocks(),
      ...foHiwBlocks(),
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
    expect(servicesBlocks().map((b) => b.type)).toEqual([
      'hero',
      'section',
      'section',
      'section',
      'section',
      'section',
      'ctaSection',
    ]);
    expect(foHiwBlocks().map((b) => b.type)).toEqual([
      'hero',
      'section',
      'section',
      'section',
      'section',
      'ctaSection',
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

  it('round-trips services slots against the for-operators content module', () => {
    const blocks = SERVICES_FALLBACK_BLOCKS;
    expect(servicesHeroSlot(blocks).data).toEqual({
      eyebrow: FOR_OPERATORS_HERO.eyebrow,
      h1Lines: [...FOR_OPERATORS_HERO.h1Lines],
      subtitle: FOR_OPERATORS_HERO.subtitle,
      primaryCta: {
        label: FOR_OPERATORS_HERO.primaryCta.label,
        href: FOR_OPERATORS_HERO.primaryCta.href,
        external: true,
      },
      reverseLink: {
        label: FOR_OPERATORS_HERO.reverseLink.label,
        href: FOR_OPERATORS_HERO.reverseLink.href,
      },
    });
    expect(servicesWhatYouGetSlot(blocks).data).toEqual({
      eyebrow: FOR_OPERATORS_WHAT_YOU_GET.eyebrow,
      heading: FOR_OPERATORS_WHAT_YOU_GET.heading,
      body: FOR_OPERATORS_WHAT_YOU_GET.body,
      cards: FOR_OPERATORS_WHAT_YOU_GET.cards.map((c) => ({ title: c.title, body: c.body })),
    });
    expect(servicesHowWeDeliverSlot(blocks).data).toEqual(FOR_OPERATORS_HOW_WE_DELIVER);
    expect(servicesPricingIntroSlot(blocks).data).toEqual({
      eyebrow: FOR_OPERATORS_PRICING.eyebrow,
      heading: FOR_OPERATORS_PRICING.heading,
      body: FOR_OPERATORS_PRICING.body,
    });
    expect(servicesDiscoverySlot(blocks).data).toEqual({
      eyebrow: FOR_OPERATORS_DISCOVERY.eyebrow,
      heading: FOR_OPERATORS_DISCOVERY.heading,
      body: FOR_OPERATORS_DISCOVERY.body,
      link: {
        label: FOR_OPERATORS_DISCOVERY.link.label,
        href: FOR_OPERATORS_DISCOVERY.link.href,
      },
    });
    expect(servicesProofSlot(blocks).data).toEqual({
      eyebrow: FOR_OPERATORS_PROOF.eyebrow,
      heading: FOR_OPERATORS_PROOF.heading,
      body: FOR_OPERATORS_PROOF.body,
      bulletIntro: FOR_OPERATORS_PROOF.bulletIntro,
      bullets: [...FOR_OPERATORS_PROOF.bullets],
      links: FOR_OPERATORS_PROOF.links.map((l) => ({
        label: l.label,
        href: l.href,
        ...(l.external ? { external: true } : {}),
      })),
    });
    expect(servicesCtaSlot(blocks).data).toEqual({
      heading: FOR_OPERATORS_CLOSING.heading,
      body: FOR_OPERATORS_CLOSING.body,
      primaryCta: {
        label: FOR_OPERATORS_CLOSING.primaryCta.label,
        href: FOR_OPERATORS_CLOSING.primaryCta.href,
        external: true,
      },
      emailFallback: { ...FOR_OPERATORS_CLOSING.emailFallback },
    });
    expect(blocksMatchFallback(servicesBlocks(), SERVICES_FALLBACK_BLOCKS)).toBe(true);
  });

  it('round-trips fo-hiw slots against the for-operators-how-it-works content module', () => {
    const blocks = FO_HIW_FALLBACK_BLOCKS;
    expect(foHiwHeroSlot(blocks).data).toEqual({
      eyebrow: FO_HIW_HERO.eyebrow,
      h1Lines: [...FO_HIW_HERO.h1Lines],
      subtitle: FO_HIW_HERO.subtitle,
      primaryCta: {
        label: FO_HIW_HERO.primaryCta.label,
        href: FO_HIW_HERO.primaryCta.href,
        external: true,
      },
      backLink: {
        label: FO_HIW_HERO.backLink.label,
        href: FO_HIW_HERO.backLink.href,
      },
    });
    expect(foHiwStepsSlot(blocks).data).toEqual({
      eyebrow: FO_HIW_STEPS.eyebrow,
      heading: FO_HIW_STEPS.heading,
      steps: FO_HIW_STEPS.steps.map((s) => ({
        number: s.number,
        title: s.title,
        body: s.body,
      })),
    });
    expect(foHiwFearSlot(blocks).data).toEqual({
      eyebrow: FO_HIW_FEAR.eyebrow,
      heading: FO_HIW_FEAR.heading,
      paragraph1: FO_HIW_FEAR.paragraph1,
      paragraph2: FO_HIW_FEAR.paragraph2,
      options: FO_HIW_FEAR.options.map((o) => ({ title: o.title, body: o.body })),
      closing: FO_HIW_FEAR.closing,
    });
    expect(foHiwOwnershipSlot(blocks).data).toEqual({
      eyebrow: FO_HIW_OWNERSHIP.eyebrow,
      heading: FO_HIW_OWNERSHIP.heading,
      intro: FO_HIW_OWNERSHIP.intro,
      claims: FO_HIW_OWNERSHIP.claims.map((c) => ({ title: c.title, body: c.body })),
      differentiator: FO_HIW_OWNERSHIP.differentiator,
    });
    expect(foHiwTimelineSlot(blocks).data).toEqual({
      eyebrow: FO_HIW_TIMELINE.eyebrow,
      heading: FO_HIW_TIMELINE.heading,
      paragraph1: FO_HIW_TIMELINE.paragraph1,
      paragraph2: FO_HIW_TIMELINE.paragraph2,
    });
    expect(foHiwCtaSlot(blocks).data).toEqual({
      heading: FO_HIW_CLOSING.heading,
      body: FO_HIW_CLOSING.body,
      primaryCta: {
        label: FO_HIW_CLOSING.primaryCta.label,
        href: FO_HIW_CLOSING.primaryCta.href,
        external: true,
      },
      backLink: {
        label: FO_HIW_CLOSING.backLink.label,
        href: FO_HIW_CLOSING.backLink.href,
      },
    });
    expect(blocksMatchFallback(foHiwBlocks(), FO_HIW_FALLBACK_BLOCKS)).toBe(true);
  });
});

describe('claims safety: prose is single-sourced, pinned values never enter blocks', () => {
  const strings = collectStrings([
    homeBlocks(),
    productsBlocks(),
    philosophyBlocks(),
    localAiBlocks(),
    fairSourceBlocks(),
    servicesBlocks(),
    foHiwBlocks(),
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
    expect(strings).toContain(FOR_OPERATORS_HERO.subtitle);
    expect(strings).toContain(FOR_OPERATORS_WHAT_YOU_GET.heading);
    expect(strings).toContain(FOR_OPERATORS_PRICING.heading);
    expect(strings).toContain(FOR_OPERATORS_CLOSING.heading);
    // Env-code lines stay out of blocks (grep-accurate, component-local).
    expect(strings).not.toContain('LLM_PROVIDER=inference-snaps');
    expect(strings).not.toContain('LLM_PROVIDER=ollama');
  });

  it('never carries metric-derived numbers, prices, or product versions', () => {
    // Product version strings stay in the flagship card TSX, never in blocks.
    expect(haystack).not.toContain(PRODUCTS_FLAGSHIP.version);
    // The pro price lives only on the pricing surfaces, never in a block.
    expect(haystack).not.toContain(SUBSCRIPTION_PRICE_FALLBACKS.pro.price);
    // Services engagement ladder rungs stay component-local: pricing intro is
    // header-only (FAQ prose may still mention dollar anchors).
    const pricingIntro = servicesBlocks().find((b) => b.id === 'services-pricing-intro');
    expect(pricingIntro?.type).toBe('section');
    if (pricingIntro?.type === 'section') {
      expect(pricingIntro.data.items ?? []).toHaveLength(0);
      for (const rung of FOR_OPERATORS_PRICING.rungs) {
        expect(pricingIntro.data.body ?? '').not.toContain(rung.price);
      }
    }
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
