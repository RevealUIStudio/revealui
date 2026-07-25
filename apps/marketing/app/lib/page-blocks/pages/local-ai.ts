/** CMS block derivation for `/local-ai` (local-ai). */

import { LOCAL_AI_PAGE, LOCAL_AI_SECTION } from '../../../content/local-ai';
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

export const LOCAL_AI_HERO_BLOCK_ID = 'local-ai-hero';

export const LOCAL_AI_PILLARS_BLOCK_ID = 'local-ai-pillars';

export const LOCAL_AI_MARKET_PROOF_BLOCK_ID = 'local-ai-market-proof';

export const LOCAL_AI_NOTES_BLOCK_ID = 'local-ai-notes';

export const LOCAL_AI_CTA_BLOCK_ID = 'local-ai-cta';

const LOCAL_AI_HERO_INDEX = 0;

const LOCAL_AI_PILLARS_INDEX = 1;

const LOCAL_AI_MARKET_PROOF_INDEX = 2;

const LOCAL_AI_NOTES_INDEX = 3;

const LOCAL_AI_CTA_INDEX = 4;

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

export function localAiBlocks(): Block[] {
  return [
    localAiHeroBlock(),
    localAiPillarsBlock(),
    localAiMarketProofBlock(),
    localAiNotesBlock(),
    localAiCtaBlock(),
  ];
}

export const LOCAL_AI_FALLBACK_BLOCKS: Block[] = localAiBlocks();

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

export const localAiPageSeed: FleetMarketingPageSeed = {
  slug: 'local-ai',
  path: '/local-ai',
  title: 'Local-first AI',
  blocks: localAiBlocks(),
  seo: {
    title: 'Local-first AI | RevealUI',
    description:
      'Run your AI on infrastructure you own. Open-weight default, frontier one config line away.',
  },
};
