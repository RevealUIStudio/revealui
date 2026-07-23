/** CMS block derivation for `/` (home). */

import { HOME_DEMO, HOME_GET_STARTED } from '../../../content/home';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../../../content/primitives';
import {
  type Block,
  type BlockSlot,
  type Cta,
  type CtaSectionBlock,
  createCtaSectionBlock,
  createSectionBlock,
  ctaToLink,
  type FleetMarketingPageSeed,
  linkToCta,
  type SectionBlock,
} from '../shared';

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

export const HOME_DEMO_BLOCK_ID = 'home-demo';

export const HOME_PRIMITIVES_BLOCK_ID = 'home-primitives';

export const HOME_GET_STARTED_BLOCK_ID = 'home-get-started';

const HOME_DEMO_INDEX = 0;

const HOME_PRIMITIVES_INDEX = 1;

const HOME_GET_STARTED_INDEX = 2;

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

export function homeBlocks(): Block[] {
  return [homeDemoBlock(), homePrimitivesBlock(), homeGetStartedBlock()];
}

export const HOME_FALLBACK_BLOCKS: Block[] = homeBlocks();

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

export const PRIMITIVES_FALLBACK_DATA: PrimitivesData = sectionToPrimitives(homePrimitivesBlock());

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

export const homePageSeed: FleetMarketingPageSeed = {
  slug: 'home',
  path: '/',
  title: 'Home',
  blocks: homeBlocks(),
  seo: {
    title: 'RevealUI',
    description: 'Agentic business runtime. People, content, offers, payments, and agents.',
  },
};
