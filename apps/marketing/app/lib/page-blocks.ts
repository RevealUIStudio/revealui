/**
 * Static-first block derivation for the marketing home + products pages.
 *
 * The marketing content modules (content/home.ts, content/primitives.ts,
 * content/products.ts) stay the single source of truth for every prose string.
 * This module derives the canonical `pages.blocks` array from those modules with
 * the `@revealui/contracts` factories — a PURE transform, so the CMS block stream
 * and the static fallback can never carry a different sentence than the
 * claim-covered modules do.
 *
 * The reverse mappers reconstruct each marketing component's own rich data shape
 * from a block, so the styled marketing components keep their look while their
 * prose can be overridden by the CMS. Only prose lives in blocks: metric-derived
 * numbers, prices, product versions, colors, and icon paths never leave the TSX.
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
import { HOME_DEMO, HOME_FAQ, HOME_GET_STARTED } from '../content/home';
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

const HOME_DEMO_INDEX = 0;
const HOME_PRIMITIVES_INDEX = 1;
const HOME_GET_STARTED_INDEX = 2;
const PRODUCTS_HERO_INDEX = 0;
const PRODUCTS_FAQ_INDEX = 1;
const PRODUCTS_CTA_INDEX = 2;

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

/** Derives the home page's block-driven sections (Demo, Primitives, GetStarted). */
export function homeBlocks(): Block[] {
  return [homeDemoBlock(), homePrimitivesBlock(), homeGetStartedBlock()];
}

/** Derives the products page's block-driven sections (Hero, FAQ, CTA). */
export function productsBlocks(): Block[] {
  return [productsHeroBlock(), productsFaqBlock(), productsCtaBlock()];
}

export const HOME_FALLBACK_BLOCKS: Block[] = homeBlocks();
export const PRODUCTS_FALLBACK_BLOCKS: Block[] = productsBlocks();

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

// ---------------------------------------------------------------------------
// Shape validation: a CMS payload is only accepted when it matches the
// fallback's per-position block types, so a malformed override can never change
// which sections a page renders.
// ---------------------------------------------------------------------------

export function blocksMatchFallback(candidate: Block[], fallback: Block[]): boolean {
  if (candidate.length !== fallback.length || candidate.length === 0) return false;
  return fallback.every((block, index) => candidate[index]?.type === block.type);
}
