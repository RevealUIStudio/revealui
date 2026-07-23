/** CMS block derivation for `/philosophy` (philosophy). */

import { PHILOSOPHY } from '../../../content/philosophy';
import {
  type Block,
  type BlockSlot,
  type Cta,
  type CtaSectionBlock,
  createCtaSectionBlock,
  createHeroBlock,
  createSectionBlock,
  ctaToLink,
  type FleetMarketingPageSeed,
  type HeroBlock,
  linkToCta,
  type SectionBlock,
} from '../shared';

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

export const PHILOSOPHY_HERO_BLOCK_ID = 'philosophy-hero';

export const PHILOSOPHY_BODY_BLOCK_ID = 'philosophy-body';

export const PHILOSOPHY_CTA_BLOCK_ID = 'philosophy-cta';

const PHILOSOPHY_HERO_INDEX = 0;

const PHILOSOPHY_BODY_INDEX = 1;

const PHILOSOPHY_CTA_INDEX = 2;

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

export function philosophyBlocks(): Block[] {
  return [philosophyHeroBlock(), philosophyBodyBlock(), philosophyCtaBlock()];
}

export const PHILOSOPHY_FALLBACK_BLOCKS: Block[] = philosophyBlocks();

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

function ctaToPhilosophyCta(block: CtaSectionBlock): PhilosophyCtaData {
  const links = block.data.links ?? [];
  return {
    primary: links[0] ? linkToCta(links[0]) : PHILOSOPHY.cta.primary,
    secondary: links[1] ? linkToCta(links[1]) : PHILOSOPHY.cta.secondary,
  };
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

export const philosophyPageSeed: FleetMarketingPageSeed = {
  slug: 'philosophy',
  path: '/philosophy',
  title: 'Philosophy',
  blocks: philosophyBlocks(),
  seo: {
    title: 'Philosophy | RevealUI',
    description: 'Software that compounds. Why RevealUI exists.',
  },
};
