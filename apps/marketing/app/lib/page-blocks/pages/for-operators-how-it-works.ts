/** CMS block derivation for `/for-operators/how-it-works` (for-operators-how-it-works). */

import {
  FO_HIW_CLOSING,
  FO_HIW_FEAR,
  FO_HIW_HERO,
  FO_HIW_OWNERSHIP,
  FO_HIW_STEPS,
  FO_HIW_TIMELINE,
} from '../../../content/for-operators-how-it-works';
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
  hrefLooksExternal,
  linkToCta,
  type SectionBlock,
} from '../shared';

export interface FoHiwHeroData {
  readonly eyebrow: string;
  readonly h1Lines: readonly string[];
  readonly subtitle: string;
  readonly primaryCta: Cta;
  readonly backLink: Cta;
}

export interface FoHiwStepData {
  readonly number: string;
  readonly title: string;
  readonly body: string;
}

export interface FoHiwStepsData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly steps: readonly FoHiwStepData[];
}

export interface FoHiwFearOptionData {
  readonly title: string;
  readonly body: string;
}

export interface FoHiwFearData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly paragraph1: string;
  readonly paragraph2: string;
  readonly options: readonly FoHiwFearOptionData[];
  readonly closing: string;
}

export interface FoHiwOwnershipClaimData {
  readonly title: string;
  readonly body: string;
}

export interface FoHiwOwnershipData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly intro: string;
  readonly claims: readonly FoHiwOwnershipClaimData[];
  readonly differentiator: string;
}

export interface FoHiwTimelineData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly paragraph1: string;
  readonly paragraph2: string;
}

export interface FoHiwCtaData {
  readonly heading: string;
  readonly body: string;
  readonly primaryCta: Cta;
  readonly backLink: Cta;
}

export const FO_HIW_HERO_BLOCK_ID = 'fo-hiw-hero';

export const FO_HIW_STEPS_BLOCK_ID = 'fo-hiw-steps';

export const FO_HIW_FEAR_BLOCK_ID = 'fo-hiw-fear';

export const FO_HIW_OWNERSHIP_BLOCK_ID = 'fo-hiw-ownership';

export const FO_HIW_TIMELINE_BLOCK_ID = 'fo-hiw-timeline';

export const FO_HIW_CTA_BLOCK_ID = 'fo-hiw-cta';

const FO_HIW_HERO_INDEX = 0;

const FO_HIW_STEPS_INDEX = 1;

const FO_HIW_FEAR_INDEX = 2;

const FO_HIW_OWNERSHIP_INDEX = 3;

const FO_HIW_TIMELINE_INDEX = 4;

const FO_HIW_CTA_INDEX = 5;

function foHiwHeroBlock(): HeroBlock {
  return createHeroBlock(FO_HIW_HERO_BLOCK_ID, FO_HIW_HERO.h1Lines.join('\n'), {
    eyebrow: FO_HIW_HERO.eyebrow,
    subtitle: FO_HIW_HERO.subtitle,
    links: [
      ctaToLink(FO_HIW_HERO.primaryCta, 'primary'),
      ctaToLink(FO_HIW_HERO.backLink, 'secondary'),
    ],
  });
}

function foHiwStepsBlock(): SectionBlock {
  return createSectionBlock(FO_HIW_STEPS_BLOCK_ID, FO_HIW_STEPS.heading, {
    eyebrow: FO_HIW_STEPS.eyebrow,
    items: FO_HIW_STEPS.steps.map((step) => ({
      label: step.number,
      title: step.title,
      body: step.body,
    })),
  });
}

function foHiwFearBlock(): SectionBlock {
  return createSectionBlock(FO_HIW_FEAR_BLOCK_ID, FO_HIW_FEAR.heading, {
    eyebrow: FO_HIW_FEAR.eyebrow,
    body: FO_HIW_FEAR.paragraph1,
    items: [
      { label: 'paragraph2', body: FO_HIW_FEAR.paragraph2 },
      ...FO_HIW_FEAR.options.map((opt) => ({
        label: 'option',
        title: opt.title,
        body: opt.body,
      })),
      { label: 'closing', body: FO_HIW_FEAR.closing },
    ],
  });
}

function foHiwOwnershipBlock(): SectionBlock {
  return createSectionBlock(FO_HIW_OWNERSHIP_BLOCK_ID, FO_HIW_OWNERSHIP.heading, {
    eyebrow: FO_HIW_OWNERSHIP.eyebrow,
    body: FO_HIW_OWNERSHIP.intro,
    items: [
      ...FO_HIW_OWNERSHIP.claims.map((claim) => ({
        label: 'claim',
        title: claim.title,
        body: claim.body,
      })),
      { label: 'differentiator', body: FO_HIW_OWNERSHIP.differentiator },
    ],
  });
}

function foHiwTimelineBlock(): SectionBlock {
  return createSectionBlock(FO_HIW_TIMELINE_BLOCK_ID, FO_HIW_TIMELINE.heading, {
    eyebrow: FO_HIW_TIMELINE.eyebrow,
    body: FO_HIW_TIMELINE.paragraph1,
    items: [{ label: 'paragraph2', body: FO_HIW_TIMELINE.paragraph2 }],
  });
}

function foHiwCtaBlock(): CtaSectionBlock {
  return createCtaSectionBlock(FO_HIW_CTA_BLOCK_ID, FO_HIW_CLOSING.heading, {
    body: FO_HIW_CLOSING.body,
    links: [
      ctaToLink(FO_HIW_CLOSING.primaryCta, 'primary'),
      ctaToLink(FO_HIW_CLOSING.backLink, 'secondary'),
    ],
  });
}

export function foHiwBlocks(): Block[] {
  return [
    foHiwHeroBlock(),
    foHiwStepsBlock(),
    foHiwFearBlock(),
    foHiwOwnershipBlock(),
    foHiwTimelineBlock(),
    foHiwCtaBlock(),
  ];
}

export const FO_HIW_FALLBACK_BLOCKS: Block[] = foHiwBlocks();

function heroToFoHiwHero(block: HeroBlock): FoHiwHeroData {
  const links = block.data.links ?? [];
  const primary = links[0]
    ? {
        ...linkToCta(links[0]),
        ...(hrefLooksExternal(links[0].href) ? { external: true as const } : {}),
      }
    : FO_HIW_HERO.primaryCta;
  const back = links[1] ? linkToCta(links[1]) : FO_HIW_HERO.backLink;
  const lines = block.data.title.split('\n').filter((line) => line.length > 0);
  return {
    eyebrow: block.data.eyebrow ?? '',
    h1Lines: lines.length > 0 ? lines : [...FO_HIW_HERO.h1Lines],
    subtitle: block.data.subtitle ?? '',
    primaryCta: primary,
    backLink: back,
  };
}

function sectionToFoHiwSteps(block: SectionBlock): FoHiwStepsData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    steps: (block.data.items ?? []).map((item) => ({
      number: item.label ?? '',
      title: item.title ?? '',
      body: item.body,
    })),
  };
}

function sectionToFoHiwFear(block: SectionBlock): FoHiwFearData {
  const items = block.data.items ?? [];
  const p2 = items.find((item) => item.label === 'paragraph2');
  const closing = items.find((item) => item.label === 'closing');
  const options = items
    .filter((item) => item.label === 'option')
    .map((item) => ({ title: item.title ?? '', body: item.body }));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    paragraph1: block.data.body ?? '',
    paragraph2: p2?.body ?? FO_HIW_FEAR.paragraph2,
    options: options.length > 0 ? options : [...FO_HIW_FEAR.options],
    closing: closing?.body ?? FO_HIW_FEAR.closing,
  };
}

function sectionToFoHiwOwnership(block: SectionBlock): FoHiwOwnershipData {
  const items = block.data.items ?? [];
  const differentiator = items.find((item) => item.label === 'differentiator');
  const claims = items
    .filter((item) => item.label === 'claim')
    .map((item) => ({ title: item.title ?? '', body: item.body }));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    intro: block.data.body ?? '',
    claims: claims.length > 0 ? claims : [...FO_HIW_OWNERSHIP.claims],
    differentiator: differentiator?.body ?? FO_HIW_OWNERSHIP.differentiator,
  };
}

function sectionToFoHiwTimeline(block: SectionBlock): FoHiwTimelineData {
  const p2 = (block.data.items ?? []).find((item) => item.label === 'paragraph2');
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    paragraph1: block.data.body ?? '',
    paragraph2: p2?.body ?? FO_HIW_TIMELINE.paragraph2,
  };
}

function ctaToFoHiwCta(block: CtaSectionBlock): FoHiwCtaData {
  const links = block.data.links ?? [];
  const primary = links[0]
    ? {
        ...linkToCta(links[0]),
        ...(hrefLooksExternal(links[0].href) ? { external: true as const } : {}),
      }
    : FO_HIW_CLOSING.primaryCta;
  const back = links[1] ? linkToCta(links[1]) : FO_HIW_CLOSING.backLink;
  return {
    heading: block.data.heading,
    body: block.data.body ?? '',
    primaryCta: primary,
    backLink: back,
  };
}

export function foHiwHeroSlot(blocks: Block[]): BlockSlot<FoHiwHeroData> {
  const block = blocks[FO_HIW_HERO_INDEX];
  const path = `blocks.${FO_HIW_HERO_INDEX}.data`;
  if (block && block.type === 'hero') return { data: heroToFoHiwHero(block), path };
  return { data: heroToFoHiwHero(foHiwHeroBlock()), path };
}

export function foHiwStepsSlot(blocks: Block[]): BlockSlot<FoHiwStepsData> {
  const block = blocks[FO_HIW_STEPS_INDEX];
  const path = `blocks.${FO_HIW_STEPS_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoHiwSteps(block), path };
  return { data: sectionToFoHiwSteps(foHiwStepsBlock()), path };
}

export function foHiwFearSlot(blocks: Block[]): BlockSlot<FoHiwFearData> {
  const block = blocks[FO_HIW_FEAR_INDEX];
  const path = `blocks.${FO_HIW_FEAR_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoHiwFear(block), path };
  return { data: sectionToFoHiwFear(foHiwFearBlock()), path };
}

export function foHiwOwnershipSlot(blocks: Block[]): BlockSlot<FoHiwOwnershipData> {
  const block = blocks[FO_HIW_OWNERSHIP_INDEX];
  const path = `blocks.${FO_HIW_OWNERSHIP_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoHiwOwnership(block), path };
  return { data: sectionToFoHiwOwnership(foHiwOwnershipBlock()), path };
}

export function foHiwTimelineSlot(blocks: Block[]): BlockSlot<FoHiwTimelineData> {
  const block = blocks[FO_HIW_TIMELINE_INDEX];
  const path = `blocks.${FO_HIW_TIMELINE_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoHiwTimeline(block), path };
  return { data: sectionToFoHiwTimeline(foHiwTimelineBlock()), path };
}

export function foHiwCtaSlot(blocks: Block[]): BlockSlot<FoHiwCtaData> {
  const block = blocks[FO_HIW_CTA_INDEX];
  const path = `blocks.${FO_HIW_CTA_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToFoHiwCta(block), path };
  return { data: ctaToFoHiwCta(foHiwCtaBlock()), path };
}

export const foHiwPageSeed: FleetMarketingPageSeed = {
  slug: 'for-operators-how-it-works',
  path: '/for-operators/how-it-works',
  title: 'How the engagement works',
  blocks: foHiwBlocks(),
  seo: {
    title: 'How the engagement works | RevealUI',
    description:
      'Discovery call to handoff: how a RevealUI Studio engagement works, what you own, and what it costs in time.',
  },
};
