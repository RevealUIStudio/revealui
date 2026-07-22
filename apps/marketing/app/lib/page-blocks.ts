/**
 * Static-first block derivation for marketing pages served from the CMS
 * (home, products, philosophy, local-ai, fair-source).
 *
 * The marketing content modules stay the single source of truth for every prose
 * string. This module derives the canonical `pages.blocks` array from those
 * modules with the `@revealui/contracts` factories — a PURE transform, so the
 * CMS block stream and the static fallback can never carry a different sentence
 * than the claim-covered modules do.
 *
 * The reverse mappers reconstruct each marketing component's own rich data shape
 * from a block, so the styled marketing components keep their look while their
 * prose can be overridden by the CMS. Only prose lives in blocks: metric-derived
 * numbers, prices, product versions, colors, and icon paths never leave the TSX.
 * Interactive widgets (ProviderSwitch, FrontierPathway) and env-code snippets
 * stay component-local so grep-accurate config lines never go through CMS.
 *
 * Fair Source hero stays component-local for the same reason: its headline,
 * subhead, and body interpolate METRICS license-split counts. The package
 * inventory table stays structural (name/license/repo/npm), while section
 * headers, contract cards, clock, peers, FAQ, and CTA ride the CMS.
 *
 * No React or network imports live here so `scripts/seed-fleet-marketing-site.ts`
 * can import the same derivation the runtime falls back to.
 */

import {
  type Block,
  type CtaSectionBlock,
  createCtaSectionBlock,
  createHeroBlock,
  createSectionBlock,
  type HeroBlock,
  type MarketingLink,
  type SectionBlock,
} from '@revealui/contracts/content';
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
import { HOME_DEMO, HOME_FAQ, HOME_GET_STARTED } from '../content/home';
import { LOCAL_AI_PAGE, LOCAL_AI_SECTION } from '../content/local-ai';
import { PHILOSOPHY } from '../content/philosophy';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../content/primitives';
import { PRODUCTS_CTA_SECTION, PRODUCTS_PAGE_HERO } from '../content/products';
import type { Cta } from '../content/types';

// ---------------------------------------------------------------------------
// Component data shapes (the rich props each styled marketing section renders)
// ---------------------------------------------------------------------------

export interface DemoBeatData {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

export interface DemoData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly beats: readonly DemoBeatData[];
}

export interface PrimitiveItemData {
  readonly label: string;
  readonly body: string;
}

export interface PrimitivesData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly items: readonly PrimitiveItemData[];
}

export interface GetStartedData {
  readonly heading: string;
  readonly body: string;
  readonly cta: { readonly primary: Cta; readonly secondary: Cta };
  readonly cli: { readonly command: readonly string[]; readonly caption: string };
  readonly newsletter: { readonly label: string };
}

export interface FaqItemData {
  readonly question: string;
  readonly answer: string;
}

export interface FaqData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly items: readonly FaqItemData[];
}

export interface ProductsHeroData {
  readonly h1: string;
  readonly subtitle: string;
}

export interface ProductsCtaData {
  readonly heading: string;
  readonly body: string;
  readonly cliSnippet: string;
  readonly cta: { readonly docs: Cta; readonly pricing: Cta };
}

export type PhilosophyParagraphRole = 'lead' | 'body' | 'footer';

export interface PhilosophyParagraphData {
  readonly role: PhilosophyParagraphRole;
  readonly body: string;
}

export interface PhilosophyHeroData {
  readonly eyebrow: string;
  readonly h1: string;
}

export interface PhilosophyBodyData {
  readonly sections: readonly PhilosophyParagraphData[];
}

export interface PhilosophyCtaData {
  readonly primary: Cta;
  readonly secondary: Cta;
}

export interface LocalAiHeroData {
  readonly eyebrow: string;
  readonly h1: string;
  readonly lead: string;
}

export interface LocalAiPillarData {
  readonly title: string;
  readonly body: string;
}

export interface LocalAiPillarsData {
  readonly pillars: readonly LocalAiPillarData[];
}

export interface LocalAiAdopterData {
  readonly name: string;
  readonly detail: string;
  readonly source: string;
}

export interface LocalAiMarketProofData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly adopters: readonly LocalAiAdopterData[];
  readonly disclaimer: string;
}

export interface LocalAiNotesData {
  readonly dogfood: string;
  readonly honesty: string;
  readonly roadmapHeading: string;
  readonly roadmapBody: string;
  readonly roadmapHref: string;
  readonly snippetCaption: string;
}

export interface LocalAiCtaData {
  readonly primary: Cta;
  readonly secondary: Cta;
}

export interface FairSourceContractCardData {
  readonly kind: 'yes' | 'no';
  readonly title: string;
  readonly body: string;
}

export interface FairSourceContractData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly cards: readonly FairSourceContractCardData[];
}

export interface FairSourcePackagesIntroData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly footer: string;
  readonly footerCommand: string;
}

export interface FairSourceClockStepData {
  readonly title: string;
  readonly body: string;
  readonly color: 'emerald' | 'amber';
}

export interface FairSourceClockData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly steps: readonly FairSourceClockStepData[];
}

export interface FairSourcePeerData {
  readonly name: string;
  readonly note: string;
  readonly url: string;
}

export interface FairSourcePeersData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly peers: readonly FairSourcePeerData[];
}

export interface FairSourceFaqData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly items: readonly FaqItemData[];
}

export interface FairSourceCtaData {
  readonly heading: string;
  readonly body: string;
  readonly primary: Cta;
  readonly secondary: Cta;
}

// ---------------------------------------------------------------------------
// Stable block ids + positions. Ids let the seed and fallback match, but the
// runtime routes each slot by array POSITION + type (the CMS assigns its own
// ids, and a page carries more than one `section` block).
// ---------------------------------------------------------------------------

export const HOME_DEMO_BLOCK_ID = 'home-demo';
export const HOME_PRIMITIVES_BLOCK_ID = 'home-primitives';
export const HOME_GET_STARTED_BLOCK_ID = 'home-get-started';
export const PRODUCTS_HERO_BLOCK_ID = 'products-hero';
export const PRODUCTS_FAQ_BLOCK_ID = 'products-faq';
export const PRODUCTS_CTA_BLOCK_ID = 'products-cta';
export const PHILOSOPHY_HERO_BLOCK_ID = 'philosophy-hero';
export const PHILOSOPHY_BODY_BLOCK_ID = 'philosophy-body';
export const PHILOSOPHY_CTA_BLOCK_ID = 'philosophy-cta';
export const LOCAL_AI_HERO_BLOCK_ID = 'local-ai-hero';
export const LOCAL_AI_PILLARS_BLOCK_ID = 'local-ai-pillars';
export const LOCAL_AI_MARKET_PROOF_BLOCK_ID = 'local-ai-market-proof';
export const LOCAL_AI_NOTES_BLOCK_ID = 'local-ai-notes';
export const LOCAL_AI_CTA_BLOCK_ID = 'local-ai-cta';
export const FAIR_SOURCE_CONTRACT_BLOCK_ID = 'fair-source-contract';
export const FAIR_SOURCE_PACKAGES_INTRO_BLOCK_ID = 'fair-source-packages-intro';
export const FAIR_SOURCE_CLOCK_BLOCK_ID = 'fair-source-clock';
export const FAIR_SOURCE_PEERS_BLOCK_ID = 'fair-source-peers';
export const FAIR_SOURCE_FAQ_BLOCK_ID = 'fair-source-faq';
export const FAIR_SOURCE_CTA_BLOCK_ID = 'fair-source-cta';

const HOME_DEMO_INDEX = 0;
const HOME_PRIMITIVES_INDEX = 1;
const HOME_GET_STARTED_INDEX = 2;
const PRODUCTS_HERO_INDEX = 0;
const PRODUCTS_FAQ_INDEX = 1;
const PRODUCTS_CTA_INDEX = 2;
const PHILOSOPHY_HERO_INDEX = 0;
const PHILOSOPHY_BODY_INDEX = 1;
const PHILOSOPHY_CTA_INDEX = 2;
const LOCAL_AI_HERO_INDEX = 0;
const LOCAL_AI_PILLARS_INDEX = 1;
const LOCAL_AI_MARKET_PROOF_INDEX = 2;
const LOCAL_AI_NOTES_INDEX = 3;
const LOCAL_AI_CTA_INDEX = 4;
const FAIR_SOURCE_CONTRACT_INDEX = 0;
const FAIR_SOURCE_PACKAGES_INTRO_INDEX = 1;
const FAIR_SOURCE_CLOCK_INDEX = 2;
const FAIR_SOURCE_PEERS_INDEX = 3;
const FAIR_SOURCE_FAQ_INDEX = 4;
const FAIR_SOURCE_CTA_INDEX = 5;

function ctaToLink(cta: Cta, variant: 'primary' | 'secondary'): MarketingLink {
  return { label: cta.label, href: cta.href, variant };
}

function linkToCta(link: MarketingLink): Cta {
  return { label: link.label, href: link.href };
}

// ---------------------------------------------------------------------------
// Forward transforms: content module const -> canonical block
// ---------------------------------------------------------------------------

function homeDemoBlock(): SectionBlock {
  return createSectionBlock(HOME_DEMO_BLOCK_ID, HOME_DEMO.heading, {
    eyebrow: HOME_DEMO.eyebrow,
    body: HOME_DEMO.body,
    items: HOME_DEMO.beats.map((beat) => ({
      label: beat.n,
      title: beat.title,
      body: beat.body,
    })),
  });
}

function homePrimitivesBlock(): SectionBlock {
  return createSectionBlock(HOME_PRIMITIVES_BLOCK_ID, HOME_PRIMITIVES_SECTION.heading, {
    eyebrow: HOME_PRIMITIVES_SECTION.eyebrow,
    body: HOME_PRIMITIVES_SECTION.body,
    items: HOME_PRIMITIVES.map((primitive) => ({
      label: primitive.label,
      body: primitive.body,
    })),
  });
}

function homeGetStartedBlock(): CtaSectionBlock {
  return createCtaSectionBlock(HOME_GET_STARTED_BLOCK_ID, HOME_GET_STARTED.heading, {
    body: HOME_GET_STARTED.body,
    links: [
      ctaToLink(HOME_GET_STARTED.cta.primary, 'primary'),
      ctaToLink(HOME_GET_STARTED.cta.secondary, 'secondary'),
    ],
    snippet: {
      lines: [HOME_GET_STARTED.cli.command.join(' ')],
      caption: HOME_GET_STARTED.cli.caption,
    },
  });
}

function productsHeroBlock(): HeroBlock {
  return createHeroBlock(PRODUCTS_HERO_BLOCK_ID, PRODUCTS_PAGE_HERO.h1, {
    subtitle: PRODUCTS_PAGE_HERO.subtitle,
  });
}

function productsFaqBlock(): SectionBlock {
  return createSectionBlock(PRODUCTS_FAQ_BLOCK_ID, HOME_FAQ.heading, {
    eyebrow: HOME_FAQ.eyebrow,
    items: HOME_FAQ.items.map((item) => ({
      label: item.question,
      body: item.answer,
    })),
  });
}

function productsCtaBlock(): CtaSectionBlock {
  return createCtaSectionBlock(PRODUCTS_CTA_BLOCK_ID, PRODUCTS_CTA_SECTION.heading, {
    body: PRODUCTS_CTA_SECTION.body,
    links: [
      ctaToLink(PRODUCTS_CTA_SECTION.cta.docs, 'primary'),
      ctaToLink(PRODUCTS_CTA_SECTION.cta.pricing, 'secondary'),
    ],
    snippet: { lines: [PRODUCTS_CTA_SECTION.cliSnippet] },
  });
}

function philosophyHeroBlock(): HeroBlock {
  return createHeroBlock(PHILOSOPHY_HERO_BLOCK_ID, PHILOSOPHY.h1, {
    eyebrow: PHILOSOPHY.eyebrow,
  });
}

function philosophyParagraphRole(
  section: (typeof PHILOSOPHY.sections)[number],
): PhilosophyParagraphRole {
  if ('lead' in section && section.lead) return 'lead';
  if ('footer' in section && section.footer) return 'footer';
  return 'body';
}

function philosophyBodyBlock(): SectionBlock {
  // Heading is structural (not rendered as a second H1); paragraphs carry the
  // manifesto copy. Role is stored in item.label so reverse-map can restore
  // lead/footer styling without inventing new block types.
  return createSectionBlock(PHILOSOPHY_BODY_BLOCK_ID, 'Manifesto', {
    items: PHILOSOPHY.sections.map((section) => ({
      label: philosophyParagraphRole(section),
      body: section.body,
    })),
  });
}

function philosophyCtaBlock(): CtaSectionBlock {
  return createCtaSectionBlock(PHILOSOPHY_CTA_BLOCK_ID, 'Next', {
    links: [
      ctaToLink(PHILOSOPHY.cta.primary, 'primary'),
      ctaToLink(PHILOSOPHY.cta.secondary, 'secondary'),
    ],
  });
}

function localAiHeroBlock(): HeroBlock {
  return createHeroBlock(LOCAL_AI_HERO_BLOCK_ID, LOCAL_AI_PAGE.h1, {
    eyebrow: LOCAL_AI_PAGE.eyebrow,
    subtitle: LOCAL_AI_PAGE.lead,
  });
}

function localAiPillarsBlock(): SectionBlock {
  // Structural heading (not rendered as a second H1 on the page).
  return createSectionBlock(LOCAL_AI_PILLARS_BLOCK_ID, 'Pillars', {
    items: LOCAL_AI_PAGE.pillars.map((pillar) => ({
      label: pillar.title,
      body: pillar.body,
    })),
  });
}

function localAiMarketProofBlock(): SectionBlock {
  return createSectionBlock(LOCAL_AI_MARKET_PROOF_BLOCK_ID, LOCAL_AI_PAGE.marketProof.heading, {
    eyebrow: LOCAL_AI_PAGE.marketProof.eyebrow,
    body: LOCAL_AI_PAGE.marketProof.body,
    items: [
      ...LOCAL_AI_PAGE.marketProof.adopters.map((adopter) => ({
        label: adopter.name,
        title: adopter.source,
        body: adopter.detail,
      })),
      {
        label: 'disclaimer',
        body: LOCAL_AI_PAGE.marketProof.disclaimer,
      },
    ],
  });
}

function localAiNotesBlock(): SectionBlock {
  // Dogfood, honesty, roadmap, and the snippet caption (prose only). Env-code
  // lines stay in LocalAiPage so they remain grep-accurate to packages/ai.
  return createSectionBlock(LOCAL_AI_NOTES_BLOCK_ID, 'Notes', {
    items: [
      { label: 'dogfood', body: LOCAL_AI_SECTION.dogfood },
      { label: 'honesty', body: LOCAL_AI_PAGE.honesty },
      {
        label: 'roadmap',
        title: LOCAL_AI_PAGE.roadmap.heading,
        body: LOCAL_AI_PAGE.roadmap.body,
      },
      { label: 'snippet-caption', body: LOCAL_AI_SECTION.snippet.caption },
    ],
  });
}

function localAiCtaBlock(): CtaSectionBlock {
  return createCtaSectionBlock(LOCAL_AI_CTA_BLOCK_ID, 'Next', {
    links: [
      ctaToLink(LOCAL_AI_PAGE.cta.primary, 'primary'),
      ctaToLink(LOCAL_AI_PAGE.cta.secondary, 'secondary'),
    ],
  });
}

function fairSourceContractBlock(): SectionBlock {
  return createSectionBlock(FAIR_SOURCE_CONTRACT_BLOCK_ID, FAIR_SOURCE_CONTRACT_SECTION.heading, {
    eyebrow: FAIR_SOURCE_CONTRACT_SECTION.eyebrow,
    items: FAIR_SOURCE_CONTRACT_CARDS.map((card) => ({
      label: card.title,
      title: card.kind,
      body: card.body,
    })),
  });
}

function fairSourcePackagesIntroBlock(): SectionBlock {
  // Package inventory table stays structural in FairSourcePage (name/license/repo).
  // Header + footer prose ride the CMS; private package name is embedded in body.
  const body = [
    FAIR_SOURCE_PACKAGES_SECTION.body.prefix,
    FAIR_SOURCE_PACKAGES_SECTION.body.privatePackage,
    FAIR_SOURCE_PACKAGES_SECTION.body.suffix,
  ].join(' ');
  const footer = [
    FAIR_SOURCE_PACKAGES_SECTION.footer.prefix,
    FAIR_SOURCE_PACKAGES_SECTION.footer.command,
    FAIR_SOURCE_PACKAGES_SECTION.footer.suffix,
  ].join(' ');
  return createSectionBlock(
    FAIR_SOURCE_PACKAGES_INTRO_BLOCK_ID,
    FAIR_SOURCE_PACKAGES_SECTION.heading,
    {
      eyebrow: FAIR_SOURCE_PACKAGES_SECTION.eyebrow,
      body,
      items: [
        { label: 'footer', body: footer },
        {
          label: 'footer-command',
          body: FAIR_SOURCE_PACKAGES_SECTION.footer.command,
        },
      ],
    },
  );
}

function fairSourceClockBlock(): SectionBlock {
  return createSectionBlock(FAIR_SOURCE_CLOCK_BLOCK_ID, FAIR_SOURCE_CLOCK_SECTION.heading, {
    eyebrow: FAIR_SOURCE_CLOCK_SECTION.eyebrow,
    body: FAIR_SOURCE_CLOCK_SECTION.body,
    items: FAIR_SOURCE_CLOCK_SECTION.steps.map((step) => ({
      label: step.title,
      title: step.color,
      body: step.body,
    })),
  });
}

function fairSourcePeersBlock(): SectionBlock {
  return createSectionBlock(FAIR_SOURCE_PEERS_BLOCK_ID, FAIR_SOURCE_PEERS_SECTION.heading, {
    eyebrow: FAIR_SOURCE_PEERS_SECTION.eyebrow,
    items: FAIR_SOURCE_PEERS.map((peer) => ({
      label: peer.name,
      title: peer.url,
      body: peer.note,
    })),
  });
}

function fairSourceFaqBlock(): SectionBlock {
  return createSectionBlock(FAIR_SOURCE_FAQ_BLOCK_ID, FAIR_SOURCE_FAQ_SECTION.heading, {
    eyebrow: FAIR_SOURCE_FAQ_SECTION.eyebrow,
    items: FAIR_SOURCE_FAQS.map((item) => ({
      label: item.question,
      body: item.answer,
    })),
  });
}

function fairSourceCtaBlock(): CtaSectionBlock {
  return createCtaSectionBlock(FAIR_SOURCE_CTA_BLOCK_ID, FAIR_SOURCE_CTA.heading, {
    body: FAIR_SOURCE_CTA.body,
    links: [
      {
        label: FAIR_SOURCE_CTA.primaryLabel,
        href: FAIR_SOURCE_CTA.primaryHref,
        variant: 'primary',
      },
      {
        label: FAIR_SOURCE_CTA.secondaryLabel,
        href: FAIR_SOURCE_CTA.secondaryHref,
        variant: 'secondary',
      },
    ],
  });
}

/** Derives the home page's block-driven sections (Demo, Primitives, GetStarted). */
export function homeBlocks(): Block[] {
  return [homeDemoBlock(), homePrimitivesBlock(), homeGetStartedBlock()];
}

/** Derives the products page's block-driven sections (Hero, FAQ, CTA). */
export function productsBlocks(): Block[] {
  return [productsHeroBlock(), productsFaqBlock(), productsCtaBlock()];
}

/** Derives the philosophy page's block-driven sections (Hero, body, CTA). */
export function philosophyBlocks(): Block[] {
  return [philosophyHeroBlock(), philosophyBodyBlock(), philosophyCtaBlock()];
}

/** Derives the local-ai page's block-driven sections (hero through CTA). */
export function localAiBlocks(): Block[] {
  return [
    localAiHeroBlock(),
    localAiPillarsBlock(),
    localAiMarketProofBlock(),
    localAiNotesBlock(),
    localAiCtaBlock(),
  ];
}

/**
 * Derives the fair-source page's CMS-driven sections.
 * Hero (metric-bearing) and package inventory table stay component-local.
 */
export function fairSourceBlocks(): Block[] {
  return [
    fairSourceContractBlock(),
    fairSourcePackagesIntroBlock(),
    fairSourceClockBlock(),
    fairSourcePeersBlock(),
    fairSourceFaqBlock(),
    fairSourceCtaBlock(),
  ];
}

export const HOME_FALLBACK_BLOCKS: Block[] = homeBlocks();
export const PRODUCTS_FALLBACK_BLOCKS: Block[] = productsBlocks();
export const PHILOSOPHY_FALLBACK_BLOCKS: Block[] = philosophyBlocks();
export const LOCAL_AI_FALLBACK_BLOCKS: Block[] = localAiBlocks();
export const FAIR_SOURCE_FALLBACK_BLOCKS: Block[] = fairSourceBlocks();

// ---------------------------------------------------------------------------
// Reverse mappers: canonical block -> rich component data shape
// ---------------------------------------------------------------------------

function sectionToDemo(block: SectionBlock): DemoData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    beats: (block.data.items ?? []).map((item) => ({
      n: item.label ?? '',
      title: item.title ?? '',
      body: item.body,
    })),
  };
}

function sectionToPrimitives(block: SectionBlock): PrimitivesData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    items: (block.data.items ?? []).map((item) => ({
      label: item.label ?? '',
      body: item.body,
    })),
  };
}

function ctaToGetStarted(block: CtaSectionBlock): GetStartedData {
  const links = block.data.links ?? [];
  const lines = block.data.snippet?.lines ?? [];
  return {
    heading: block.data.heading,
    body: block.data.body ?? '',
    cta: {
      primary: links[0] ? linkToCta(links[0]) : HOME_GET_STARTED.cta.primary,
      secondary: links[1] ? linkToCta(links[1]) : HOME_GET_STARTED.cta.secondary,
    },
    cli: {
      command: lines[0] ? lines[0].split(' ') : [...HOME_GET_STARTED.cli.command],
      caption: block.data.snippet?.caption ?? HOME_GET_STARTED.cli.caption,
    },
    // The newsletter is an interactive form label, not block-driven prose.
    newsletter: HOME_GET_STARTED.newsletter,
  };
}

function sectionToFaq(block: SectionBlock): FaqData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    items: (block.data.items ?? []).map((item) => ({
      question: item.label ?? '',
      answer: item.body,
    })),
  };
}

function heroToProductsHero(block: HeroBlock): ProductsHeroData {
  return {
    h1: block.data.title,
    subtitle: block.data.subtitle ?? '',
  };
}

function heroToPhilosophyHero(block: HeroBlock): PhilosophyHeroData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    h1: block.data.title,
  };
}

function sectionToPhilosophyBody(block: SectionBlock): PhilosophyBodyData {
  return {
    sections: (block.data.items ?? []).map((item) => {
      const label = item.label ?? 'body';
      const role: PhilosophyParagraphRole = label === 'lead' || label === 'footer' ? label : 'body';
      return { role, body: item.body };
    }),
  };
}

function heroToLocalAiHero(block: HeroBlock): LocalAiHeroData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    h1: block.data.title,
    lead: block.data.subtitle ?? '',
  };
}

function sectionToLocalAiPillars(block: SectionBlock): LocalAiPillarsData {
  return {
    pillars: (block.data.items ?? []).map((item) => ({
      title: item.label ?? '',
      body: item.body,
    })),
  };
}

function sectionToLocalAiMarketProof(block: SectionBlock): LocalAiMarketProofData {
  const items = block.data.items ?? [];
  const disclaimerItem = items.find((item) => item.label === 'disclaimer');
  const adopters = items
    .filter((item) => item.label !== 'disclaimer')
    .map((item) => ({
      name: item.label ?? '',
      detail: item.body,
      source: item.title ?? '',
    }));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    adopters,
    disclaimer: disclaimerItem?.body ?? LOCAL_AI_PAGE.marketProof.disclaimer,
  };
}

function sectionToLocalAiNotes(block: SectionBlock): LocalAiNotesData {
  const byLabel = new Map((block.data.items ?? []).map((item) => [item.label ?? '', item]));
  const dogfood = byLabel.get('dogfood')?.body ?? LOCAL_AI_SECTION.dogfood;
  const honesty = byLabel.get('honesty')?.body ?? LOCAL_AI_PAGE.honesty;
  const roadmap = byLabel.get('roadmap');
  const snippet = byLabel.get('snippet-caption');
  return {
    dogfood,
    honesty,
    roadmapHeading: roadmap?.title ?? LOCAL_AI_PAGE.roadmap.heading,
    roadmapBody: roadmap?.body ?? LOCAL_AI_PAGE.roadmap.body,
    // href is structural navigation, not CMS prose.
    roadmapHref: LOCAL_AI_PAGE.roadmap.href,
    snippetCaption: snippet?.body ?? LOCAL_AI_SECTION.snippet.caption,
  };
}

function ctaToLocalAiCta(block: CtaSectionBlock): LocalAiCtaData {
  const links = block.data.links ?? [];
  return {
    primary: links[0] ? linkToCta(links[0]) : LOCAL_AI_PAGE.cta.primary,
    secondary: links[1] ? linkToCta(links[1]) : LOCAL_AI_PAGE.cta.secondary,
  };
}

function ctaToPhilosophyCta(block: CtaSectionBlock): PhilosophyCtaData {
  const links = block.data.links ?? [];
  return {
    primary: links[0] ? linkToCta(links[0]) : PHILOSOPHY.cta.primary,
    secondary: links[1] ? linkToCta(links[1]) : PHILOSOPHY.cta.secondary,
  };
}

function ctaToProductsCta(block: CtaSectionBlock): ProductsCtaData {
  const links = block.data.links ?? [];
  const lines = block.data.snippet?.lines ?? [];
  return {
    heading: block.data.heading,
    body: block.data.body ?? '',
    cliSnippet: lines[0] ?? PRODUCTS_CTA_SECTION.cliSnippet,
    cta: {
      docs: links[0] ? linkToCta(links[0]) : PRODUCTS_CTA_SECTION.cta.docs,
      pricing: links[1] ? linkToCta(links[1]) : PRODUCTS_CTA_SECTION.cta.pricing,
    },
  };
}

/**
 * Default (fallback) data for the Primitives section. No single content const
 * carries both the header and the item list, so it is composed here once.
 */
export const PRIMITIVES_FALLBACK_DATA: PrimitivesData = sectionToPrimitives(homePrimitivesBlock());

// ---------------------------------------------------------------------------
// Slot resolvers: pick a block by POSITION + type, return data + annotation path.
// blocksMatchFallback() guarantees the type at each index matches the fallback,
// so a page can carry several `section` blocks without ambiguity.
// ---------------------------------------------------------------------------

export interface BlockSlot<T> {
  readonly data: T;
  /**
   * Dot-path of this block's DATA object within the array, e.g. `blocks.0.data`
   * (not `blocks.0`  -  every field a block component addresses via
   * `fieldAttrs` lives under `block.data.*`, per the canonical `Block` shape;
   * a path stopping at the block index would land a patch as a sibling of
   * `data` instead of inside it).
   */
  readonly path: string;
}

export function demoSlot(blocks: Block[]): BlockSlot<DemoData> {
  const block = blocks[HOME_DEMO_INDEX];
  const path = `blocks.${HOME_DEMO_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToDemo(block), path };
  return { data: sectionToDemo(homeDemoBlock()), path };
}

export function primitivesSlot(blocks: Block[]): BlockSlot<PrimitivesData> {
  const block = blocks[HOME_PRIMITIVES_INDEX];
  const path = `blocks.${HOME_PRIMITIVES_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToPrimitives(block), path };
  return { data: sectionToPrimitives(homePrimitivesBlock()), path };
}

export function getStartedSlot(blocks: Block[]): BlockSlot<GetStartedData> {
  const block = blocks[HOME_GET_STARTED_INDEX];
  const path = `blocks.${HOME_GET_STARTED_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToGetStarted(block), path };
  return { data: ctaToGetStarted(homeGetStartedBlock()), path };
}

export function productsHeroSlot(blocks: Block[]): BlockSlot<ProductsHeroData> {
  const block = blocks[PRODUCTS_HERO_INDEX];
  const path = `blocks.${PRODUCTS_HERO_INDEX}.data`;
  if (block && block.type === 'hero') return { data: heroToProductsHero(block), path };
  return { data: heroToProductsHero(productsHeroBlock()), path };
}

export function productsFaqSlot(blocks: Block[]): BlockSlot<FaqData> {
  const block = blocks[PRODUCTS_FAQ_INDEX];
  const path = `blocks.${PRODUCTS_FAQ_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFaq(block), path };
  return { data: sectionToFaq(productsFaqBlock()), path };
}

export function productsCtaSlot(blocks: Block[]): BlockSlot<ProductsCtaData> {
  const block = blocks[PRODUCTS_CTA_INDEX];
  const path = `blocks.${PRODUCTS_CTA_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToProductsCta(block), path };
  return { data: ctaToProductsCta(productsCtaBlock()), path };
}

export function philosophyHeroSlot(blocks: Block[]): BlockSlot<PhilosophyHeroData> {
  const block = blocks[PHILOSOPHY_HERO_INDEX];
  const path = `blocks.${PHILOSOPHY_HERO_INDEX}.data`;
  if (block && block.type === 'hero') return { data: heroToPhilosophyHero(block), path };
  return { data: heroToPhilosophyHero(philosophyHeroBlock()), path };
}

export function philosophyBodySlot(blocks: Block[]): BlockSlot<PhilosophyBodyData> {
  const block = blocks[PHILOSOPHY_BODY_INDEX];
  const path = `blocks.${PHILOSOPHY_BODY_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToPhilosophyBody(block), path };
  return { data: sectionToPhilosophyBody(philosophyBodyBlock()), path };
}

export function philosophyCtaSlot(blocks: Block[]): BlockSlot<PhilosophyCtaData> {
  const block = blocks[PHILOSOPHY_CTA_INDEX];
  const path = `blocks.${PHILOSOPHY_CTA_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToPhilosophyCta(block), path };
  return { data: ctaToPhilosophyCta(philosophyCtaBlock()), path };
}

export function localAiHeroSlot(blocks: Block[]): BlockSlot<LocalAiHeroData> {
  const block = blocks[LOCAL_AI_HERO_INDEX];
  const path = `blocks.${LOCAL_AI_HERO_INDEX}.data`;
  if (block && block.type === 'hero') return { data: heroToLocalAiHero(block), path };
  return { data: heroToLocalAiHero(localAiHeroBlock()), path };
}

export function localAiPillarsSlot(blocks: Block[]): BlockSlot<LocalAiPillarsData> {
  const block = blocks[LOCAL_AI_PILLARS_INDEX];
  const path = `blocks.${LOCAL_AI_PILLARS_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToLocalAiPillars(block), path };
  return { data: sectionToLocalAiPillars(localAiPillarsBlock()), path };
}

export function localAiMarketProofSlot(blocks: Block[]): BlockSlot<LocalAiMarketProofData> {
  const block = blocks[LOCAL_AI_MARKET_PROOF_INDEX];
  const path = `blocks.${LOCAL_AI_MARKET_PROOF_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToLocalAiMarketProof(block), path };
  return { data: sectionToLocalAiMarketProof(localAiMarketProofBlock()), path };
}

export function localAiNotesSlot(blocks: Block[]): BlockSlot<LocalAiNotesData> {
  const block = blocks[LOCAL_AI_NOTES_INDEX];
  const path = `blocks.${LOCAL_AI_NOTES_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToLocalAiNotes(block), path };
  return { data: sectionToLocalAiNotes(localAiNotesBlock()), path };
}

export function localAiCtaSlot(blocks: Block[]): BlockSlot<LocalAiCtaData> {
  const block = blocks[LOCAL_AI_CTA_INDEX];
  const path = `blocks.${LOCAL_AI_CTA_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToLocalAiCta(block), path };
  return { data: ctaToLocalAiCta(localAiCtaBlock()), path };
}

function sectionToFairSourceContract(block: SectionBlock): FairSourceContractData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    cards: (block.data.items ?? []).map((item) => ({
      kind: item.title === 'no' ? 'no' : 'yes',
      title: item.label ?? '',
      body: item.body,
    })),
  };
}

function sectionToFairSourcePackagesIntro(block: SectionBlock): FairSourcePackagesIntroData {
  const items = block.data.items ?? [];
  const footerItem = items.find((item) => item.label === 'footer');
  const commandItem = items.find((item) => item.label === 'footer-command');
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    footer: footerItem?.body ?? '',
    footerCommand: commandItem?.body ?? FAIR_SOURCE_PACKAGES_SECTION.footer.command,
  };
}

function sectionToFairSourceClock(block: SectionBlock): FairSourceClockData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    steps: (block.data.items ?? []).map((item) => ({
      title: item.label ?? '',
      body: item.body,
      color: item.title === 'amber' ? 'amber' : 'emerald',
    })),
  };
}

function sectionToFairSourcePeers(block: SectionBlock): FairSourcePeersData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    peers: (block.data.items ?? []).map((item) => ({
      name: item.label ?? '',
      note: item.body,
      url: item.title ?? '',
    })),
  };
}

function sectionToFairSourceFaq(block: SectionBlock): FairSourceFaqData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    items: (block.data.items ?? []).map((item) => ({
      question: item.label ?? '',
      answer: item.body,
    })),
  };
}

function ctaToFairSourceCta(block: CtaSectionBlock): FairSourceCtaData {
  const links = block.data.links ?? [];
  return {
    heading: block.data.heading,
    body: block.data.body ?? '',
    primary: links[0]
      ? linkToCta(links[0])
      : { label: FAIR_SOURCE_CTA.primaryLabel, href: FAIR_SOURCE_CTA.primaryHref },
    secondary: links[1]
      ? linkToCta(links[1])
      : { label: FAIR_SOURCE_CTA.secondaryLabel, href: FAIR_SOURCE_CTA.secondaryHref },
  };
}

export function fairSourceContractSlot(blocks: Block[]): BlockSlot<FairSourceContractData> {
  const block = blocks[FAIR_SOURCE_CONTRACT_INDEX];
  const path = `blocks.${FAIR_SOURCE_CONTRACT_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFairSourceContract(block), path };
  return { data: sectionToFairSourceContract(fairSourceContractBlock()), path };
}

export function fairSourcePackagesIntroSlot(
  blocks: Block[],
): BlockSlot<FairSourcePackagesIntroData> {
  const block = blocks[FAIR_SOURCE_PACKAGES_INTRO_INDEX];
  const path = `blocks.${FAIR_SOURCE_PACKAGES_INTRO_INDEX}.data`;
  if (block && block.type === 'section') {
    return { data: sectionToFairSourcePackagesIntro(block), path };
  }
  return { data: sectionToFairSourcePackagesIntro(fairSourcePackagesIntroBlock()), path };
}

export function fairSourceClockSlot(blocks: Block[]): BlockSlot<FairSourceClockData> {
  const block = blocks[FAIR_SOURCE_CLOCK_INDEX];
  const path = `blocks.${FAIR_SOURCE_CLOCK_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFairSourceClock(block), path };
  return { data: sectionToFairSourceClock(fairSourceClockBlock()), path };
}

export function fairSourcePeersSlot(blocks: Block[]): BlockSlot<FairSourcePeersData> {
  const block = blocks[FAIR_SOURCE_PEERS_INDEX];
  const path = `blocks.${FAIR_SOURCE_PEERS_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFairSourcePeers(block), path };
  return { data: sectionToFairSourcePeers(fairSourcePeersBlock()), path };
}

export function fairSourceFaqSlot(blocks: Block[]): BlockSlot<FairSourceFaqData> {
  const block = blocks[FAIR_SOURCE_FAQ_INDEX];
  const path = `blocks.${FAIR_SOURCE_FAQ_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFairSourceFaq(block), path };
  return { data: sectionToFairSourceFaq(fairSourceFaqBlock()), path };
}

export function fairSourceCtaSlot(blocks: Block[]): BlockSlot<FairSourceCtaData> {
  const block = blocks[FAIR_SOURCE_CTA_INDEX];
  const path = `blocks.${FAIR_SOURCE_CTA_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToFairSourceCta(block), path };
  return { data: ctaToFairSourceCta(fairSourceCtaBlock()), path };
}

// ---------------------------------------------------------------------------
// Shape validation: a CMS payload is only accepted when it matches the
// fallback's per-position block types, so a malformed override can never change
// which sections a page renders.
// ---------------------------------------------------------------------------

export function blocksMatchFallback(candidate: Block[], fallback: Block[]): boolean {
  if (candidate.length !== fallback.length || candidate.length === 0) return false;
  return fallback.every((block, index) => candidate[index]?.type === block.type);
}
