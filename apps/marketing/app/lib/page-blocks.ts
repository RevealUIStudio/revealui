/**
 * Static-first block derivation for the marketing home + products pages.
 *
 * The marketing content modules (content/home.ts, content/products.ts) stay the
 * single source of truth for every prose string. This module derives the
 * canonical `pages.blocks` array from those modules with the `@revealui/contracts`
 * factories — a PURE transform, so the CMS block stream and the static fallback
 * can never carry a different sentence than the claim-covered modules do.
 *
 * The reverse mappers reconstruct each marketing component's own rich data shape
 * from a block, so the styled marketing components keep their look while their
 * prose can be overridden by the CMS. Only prose lives in blocks: metric-derived
 * numbers, prices, product versions, and interactive logic never leave the TSX.
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
import { HOME_DEMO, HOME_GET_STARTED } from '../content/home';
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

export interface GetStartedData {
  readonly heading: string;
  readonly body: string;
  readonly cta: { readonly primary: Cta; readonly secondary: Cta };
  readonly cli: { readonly command: readonly string[]; readonly caption: string };
  readonly newsletter: { readonly label: string };
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
// Stable block ids. Ids let the seed and fallback match, but the runtime never
// routes by id (the CMS assigns its own) — it routes by array position + type.
// ---------------------------------------------------------------------------

export const HOME_DEMO_BLOCK_ID = 'home-demo';
export const HOME_GET_STARTED_BLOCK_ID = 'home-get-started';
export const PRODUCTS_HERO_BLOCK_ID = 'products-hero';
export const PRODUCTS_CTA_BLOCK_ID = 'products-cta';

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

/** Derives the home page's block-driven sections (Demo, GetStarted). */
export function homeBlocks(): Block[] {
  return [homeDemoBlock(), homeGetStartedBlock()];
}

/** Derives the products page's block-driven sections (Hero, CTA). */
export function productsBlocks(): Block[] {
  return [productsHeroBlock(), productsCtaBlock()];
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

// ---------------------------------------------------------------------------
// Slot resolvers: pick a block by type + position, return data + annotation path
// ---------------------------------------------------------------------------

export interface BlockSlot<T> {
  readonly data: T;
  /** Dot-path base of the block within the array, e.g. `blocks.0`. */
  readonly path: string;
}

function firstOfType(blocks: Block[], type: Block['type']): { block: Block; index: number } | null {
  const index = blocks.findIndex((block) => block.type === type);
  if (index < 0) return null;
  const block = blocks[index];
  return block ? { block, index } : null;
}

export function demoSlot(blocks: Block[]): BlockSlot<DemoData> {
  const found = firstOfType(blocks, 'section');
  if (found && found.block.type === 'section') {
    return { data: sectionToDemo(found.block), path: `blocks.${found.index}` };
  }
  return { data: sectionToDemo(homeDemoBlock()), path: 'blocks.0' };
}

export function getStartedSlot(blocks: Block[]): BlockSlot<GetStartedData> {
  const found = firstOfType(blocks, 'ctaSection');
  if (found && found.block.type === 'ctaSection') {
    return { data: ctaToGetStarted(found.block), path: `blocks.${found.index}` };
  }
  return { data: ctaToGetStarted(homeGetStartedBlock()), path: 'blocks.1' };
}

export function productsHeroSlot(blocks: Block[]): BlockSlot<ProductsHeroData> {
  const found = firstOfType(blocks, 'hero');
  if (found && found.block.type === 'hero') {
    return { data: heroToProductsHero(found.block), path: `blocks.${found.index}` };
  }
  return { data: heroToProductsHero(productsHeroBlock()), path: 'blocks.0' };
}

export function productsCtaSlot(blocks: Block[]): BlockSlot<ProductsCtaData> {
  const found = firstOfType(blocks, 'ctaSection');
  if (found && found.block.type === 'ctaSection') {
    return { data: ctaToProductsCta(found.block), path: `blocks.${found.index}` };
  }
  return { data: ctaToProductsCta(productsCtaBlock()), path: 'blocks.1' };
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
