/**
 * Shared primitives for marketing CMS block derivation.
 * Page-specific derivation lives in ./pages/* so concurrent VES page wires
 * do not collide on a single mega-file (durable conflict-proofing).
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
import type { Cta } from '../../content/types';

export interface FaqItemData {
  readonly question: string;
  readonly answer: string;
}

export interface FaqData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly items: readonly FaqItemData[];
}

export function hrefLooksExternal(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('//')
  );
}

export function ctaToLink(cta: Cta, variant: 'primary' | 'secondary'): MarketingLink {
  return { label: cta.label, href: cta.href, variant };
}

export function linkToCta(link: MarketingLink): Cta {
  return { label: link.label, href: link.href };
}

export function sectionToFaq(block: SectionBlock): FaqData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    items: (block.data.items ?? []).map((item) => ({
      question: item.label ?? '',
      answer: item.body,
    })),
  };
}

export interface BlockSlot<T> {
  readonly data: T;
  /**
   * Dot-path of this block's DATA object within the array, e.g. `blocks.0.data`
   * (not `blocks.0` — every field a block component addresses via
   * `fieldAttrs` lives under `block.data.*`, per the canonical `Block` shape;
   * a path stopping at the block index would land a patch as a sibling of
   * `data` instead of inside it).
   */
  readonly path: string;
}

export function blocksMatchFallback(candidate: Block[], fallback: Block[]): boolean {
  if (candidate.length !== fallback.length || candidate.length === 0) return false;
  return fallback.every((block, index) => candidate[index]?.type === block.type);
}

/** Seed descriptor every page module must export as `fleetMarketingPageSeed`. */
export interface FleetMarketingPageSeed {
  readonly slug: string;
  readonly path: string;
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly seo: { readonly title: string; readonly description: string };
}

// Re-export factories/types pages need without pulling React.
export type { Block, Cta, CtaSectionBlock, HeroBlock, MarketingLink, SectionBlock };
export { createCtaSectionBlock, createHeroBlock, createSectionBlock };
