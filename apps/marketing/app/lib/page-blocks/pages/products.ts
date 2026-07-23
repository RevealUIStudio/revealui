/** CMS block derivation for `/products` (products). */

import { HOME_FAQ } from '../../../content/home';
import { PRODUCTS_CTA_SECTION, PRODUCTS_PAGE_HERO } from '../../../content/products';
import {
  type Block,
  type BlockSlot,
  type Cta,
  type CtaSectionBlock,
  createCtaSectionBlock,
  createHeroBlock,
  createSectionBlock,
  ctaToLink,
  type FaqData,
  type FleetMarketingPageSeed,
  type HeroBlock,
  linkToCta,
  type SectionBlock,
  sectionToFaq,
} from '../shared';

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

export const PRODUCTS_HERO_BLOCK_ID = 'products-hero';

export const PRODUCTS_FAQ_BLOCK_ID = 'products-faq';

export const PRODUCTS_CTA_BLOCK_ID = 'products-cta';

const PRODUCTS_HERO_INDEX = 0;

const PRODUCTS_FAQ_INDEX = 1;

const PRODUCTS_CTA_INDEX = 2;

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

export function productsBlocks(): Block[] {
  return [productsHeroBlock(), productsFaqBlock(), productsCtaBlock()];
}

export const PRODUCTS_FALLBACK_BLOCKS: Block[] = productsBlocks();

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

export const productsPageSeed: FleetMarketingPageSeed = {
  slug: 'products',
  path: '/products',
  title: 'Products',
  blocks: productsBlocks(),
  seo: {
    title: 'The RevFleet product family',
    description: 'Seven products on one foundation, all built and operated by RevealUI Studio.',
  },
};
