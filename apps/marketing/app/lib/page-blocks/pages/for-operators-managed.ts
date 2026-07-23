/** CMS block derivation for `/for-operators/managed` (for-operators-managed). */

import {
  FO_MANAGED_HERO,
  FO_MANAGED_PREREQS,
  FO_MANAGED_STATUS,
  FO_MANAGED_TODAY,
  FO_MANAGED_WAITLIST,
  FO_MANAGED_WOULD_BE,
} from '../../../content/for-operators-managed';
import {
  type Block,
  type BlockSlot,
  type Cta,
  createHeroBlock,
  createSectionBlock,
  ctaToLink,
  type FleetMarketingPageSeed,
  type HeroBlock,
  hrefLooksExternal,
  linkToCta,
  type SectionBlock,
} from '../shared';

export interface FoManagedHeroData {
  readonly eyebrow: string;
  readonly h1Lines: readonly string[];
  readonly subtitle: string;
  readonly backLink: Cta;
}

export interface FoManagedStatusData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly paragraph1: string;
  readonly paragraph2: string;
  readonly paragraph3: string;
}

export interface FoManagedCapabilityData {
  readonly title: string;
  readonly body: string;
}

export interface FoManagedWouldBeData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly capabilities: readonly FoManagedCapabilityData[];
  readonly closing: string;
}

export interface FoManagedPrereqData {
  readonly title: string;
  readonly body: string;
}

export interface FoManagedPrereqsData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly intro: string;
  readonly prerequisites: readonly FoManagedPrereqData[];
  readonly closing: string;
}

export interface FoManagedTodayData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly primaryCta: Cta;
  readonly detailLink: Cta;
}

export interface FoManagedWaitlistData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly inputPlaceholder: string;
  readonly buttonLabel: string;
  readonly buttonLabelLoading: string;
  readonly successMessage: string;
}

export const FO_MANAGED_HERO_BLOCK_ID = 'fo-managed-hero';

export const FO_MANAGED_STATUS_BLOCK_ID = 'fo-managed-status';

export const FO_MANAGED_WOULD_BE_BLOCK_ID = 'fo-managed-would-be';

export const FO_MANAGED_PREREQS_BLOCK_ID = 'fo-managed-prereqs';

export const FO_MANAGED_TODAY_BLOCK_ID = 'fo-managed-today';

export const FO_MANAGED_WAITLIST_BLOCK_ID = 'fo-managed-waitlist';

const FO_MANAGED_HERO_INDEX = 0;

const FO_MANAGED_STATUS_INDEX = 1;

const FO_MANAGED_WOULD_BE_INDEX = 2;

const FO_MANAGED_PREREQS_INDEX = 3;

const FO_MANAGED_TODAY_INDEX = 4;

const FO_MANAGED_WAITLIST_INDEX = 5;

function foManagedHeroBlock(): HeroBlock {
  return createHeroBlock(FO_MANAGED_HERO_BLOCK_ID, FO_MANAGED_HERO.h1Lines.join('\n'), {
    eyebrow: FO_MANAGED_HERO.eyebrow,
    subtitle: FO_MANAGED_HERO.subtitle,
    links: [ctaToLink(FO_MANAGED_HERO.backLink, 'secondary')],
  });
}

function foManagedStatusBlock(): SectionBlock {
  return createSectionBlock(FO_MANAGED_STATUS_BLOCK_ID, FO_MANAGED_STATUS.heading, {
    eyebrow: FO_MANAGED_STATUS.eyebrow,
    body: FO_MANAGED_STATUS.paragraph1,
    items: [
      { label: 'paragraph2', body: FO_MANAGED_STATUS.paragraph2 },
      { label: 'paragraph3', body: FO_MANAGED_STATUS.paragraph3 },
    ],
  });
}

function foManagedWouldBeBlock(): SectionBlock {
  return createSectionBlock(FO_MANAGED_WOULD_BE_BLOCK_ID, FO_MANAGED_WOULD_BE.heading, {
    eyebrow: FO_MANAGED_WOULD_BE.eyebrow,
    items: [
      ...FO_MANAGED_WOULD_BE.capabilities.map((cap) => ({
        label: cap.title,
        body: cap.body,
      })),
      { label: 'closing', body: FO_MANAGED_WOULD_BE.closing },
    ],
  });
}

function foManagedPrereqsBlock(): SectionBlock {
  return createSectionBlock(FO_MANAGED_PREREQS_BLOCK_ID, FO_MANAGED_PREREQS.heading, {
    eyebrow: FO_MANAGED_PREREQS.eyebrow,
    body: FO_MANAGED_PREREQS.intro,
    items: [
      ...FO_MANAGED_PREREQS.prerequisites.map((p) => ({
        label: p.title,
        body: p.body,
      })),
      { label: 'closing', body: FO_MANAGED_PREREQS.closing },
    ],
  });
}

function foManagedTodayBlock(): SectionBlock {
  // ctaSection has no eyebrow field; encode CTAs as items (label/href/external flag).
  return createSectionBlock(FO_MANAGED_TODAY_BLOCK_ID, FO_MANAGED_TODAY.heading, {
    eyebrow: FO_MANAGED_TODAY.eyebrow,
    body: FO_MANAGED_TODAY.body,
    items: [
      {
        label: FO_MANAGED_TODAY.primaryCta.label,
        title: FO_MANAGED_TODAY.primaryCta.href,
        body: FO_MANAGED_TODAY.primaryCta.external ? 'external' : 'internal',
      },
      {
        label: FO_MANAGED_TODAY.detailLink.label,
        title: FO_MANAGED_TODAY.detailLink.href,
        body: 'internal',
      },
    ],
  });
}

function foManagedWaitlistBlock(): SectionBlock {
  // product source tag stays out of CMS (API contract).
  return createSectionBlock(FO_MANAGED_WAITLIST_BLOCK_ID, FO_MANAGED_WAITLIST.heading, {
    eyebrow: FO_MANAGED_WAITLIST.eyebrow,
    body: FO_MANAGED_WAITLIST.body,
    items: [
      { label: 'placeholder', body: FO_MANAGED_WAITLIST.inputPlaceholder },
      { label: 'button', body: FO_MANAGED_WAITLIST.buttonLabel },
      { label: 'button-loading', body: FO_MANAGED_WAITLIST.buttonLabelLoading },
      { label: 'success', body: FO_MANAGED_WAITLIST.successMessage },
    ],
  });
}

function heroToFoManagedHero(block: HeroBlock): FoManagedHeroData {
  const links = block.data.links ?? [];
  const back = links[0] ? linkToCta(links[0]) : FO_MANAGED_HERO.backLink;
  const lines = block.data.title.split('\n').filter((line) => line.length > 0);
  return {
    eyebrow: block.data.eyebrow ?? '',
    h1Lines: lines.length > 0 ? lines : [...FO_MANAGED_HERO.h1Lines],
    subtitle: block.data.subtitle ?? '',
    backLink: back,
  };
}

function sectionToFoManagedStatus(block: SectionBlock): FoManagedStatusData {
  const byLabel = new Map((block.data.items ?? []).map((item) => [item.label ?? '', item]));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    paragraph1: block.data.body ?? '',
    paragraph2: byLabel.get('paragraph2')?.body ?? FO_MANAGED_STATUS.paragraph2,
    paragraph3: byLabel.get('paragraph3')?.body ?? FO_MANAGED_STATUS.paragraph3,
  };
}

function sectionToFoManagedWouldBe(block: SectionBlock): FoManagedWouldBeData {
  const items = block.data.items ?? [];
  const closing = items.find((item) => item.label === 'closing');
  const capabilities = items
    .filter((item) => item.label !== 'closing')
    .map((item) => ({ title: item.label ?? '', body: item.body }));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    capabilities:
      capabilities.length > 0
        ? capabilities
        : FO_MANAGED_WOULD_BE.capabilities.map((c) => ({ title: c.title, body: c.body })),
    closing: closing?.body ?? FO_MANAGED_WOULD_BE.closing,
  };
}

function sectionToFoManagedPrereqs(block: SectionBlock): FoManagedPrereqsData {
  const items = block.data.items ?? [];
  const closing = items.find((item) => item.label === 'closing');
  const prerequisites = items
    .filter((item) => item.label !== 'closing')
    .map((item) => ({ title: item.label ?? '', body: item.body }));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    intro: block.data.body ?? '',
    prerequisites:
      prerequisites.length > 0
        ? prerequisites
        : FO_MANAGED_PREREQS.prerequisites.map((p) => ({ title: p.title, body: p.body })),
    closing: closing?.body ?? FO_MANAGED_PREREQS.closing,
  };
}

function sectionToFoManagedToday(block: SectionBlock): FoManagedTodayData {
  const items = block.data.items ?? [];
  const primaryItem = items[0];
  const detailItem = items[1];
  const primary = primaryItem
    ? {
        label: primaryItem.label ?? FO_MANAGED_TODAY.primaryCta.label,
        href: primaryItem.title ?? FO_MANAGED_TODAY.primaryCta.href,
        ...(primaryItem.body === 'external' || hrefLooksExternal(primaryItem.title ?? '')
          ? { external: true as const }
          : {}),
      }
    : FO_MANAGED_TODAY.primaryCta;
  const detail = detailItem
    ? {
        label: detailItem.label ?? FO_MANAGED_TODAY.detailLink.label,
        href: detailItem.title ?? FO_MANAGED_TODAY.detailLink.href,
      }
    : FO_MANAGED_TODAY.detailLink;
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    primaryCta: primary,
    detailLink: detail,
  };
}

function sectionToFoManagedWaitlist(block: SectionBlock): FoManagedWaitlistData {
  const byLabel = new Map((block.data.items ?? []).map((item) => [item.label ?? '', item]));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    inputPlaceholder: byLabel.get('placeholder')?.body ?? FO_MANAGED_WAITLIST.inputPlaceholder,
    buttonLabel: byLabel.get('button')?.body ?? FO_MANAGED_WAITLIST.buttonLabel,
    buttonLabelLoading:
      byLabel.get('button-loading')?.body ?? FO_MANAGED_WAITLIST.buttonLabelLoading,
    successMessage: byLabel.get('success')?.body ?? FO_MANAGED_WAITLIST.successMessage,
  };
}

export function foManagedBlocks(): Block[] {
  return [
    foManagedHeroBlock(),
    foManagedStatusBlock(),
    foManagedWouldBeBlock(),
    foManagedPrereqsBlock(),
    foManagedTodayBlock(),
    foManagedWaitlistBlock(),
  ];
}

export function foManagedHeroSlot(blocks: Block[]): BlockSlot<FoManagedHeroData> {
  const block = blocks[FO_MANAGED_HERO_INDEX];
  const path = `blocks.${FO_MANAGED_HERO_INDEX}.data`;
  if (block && block.type === 'hero') return { data: heroToFoManagedHero(block), path };
  return { data: heroToFoManagedHero(foManagedHeroBlock()), path };
}

export function foManagedStatusSlot(blocks: Block[]): BlockSlot<FoManagedStatusData> {
  const block = blocks[FO_MANAGED_STATUS_INDEX];
  const path = `blocks.${FO_MANAGED_STATUS_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoManagedStatus(block), path };
  return { data: sectionToFoManagedStatus(foManagedStatusBlock()), path };
}

export function foManagedWouldBeSlot(blocks: Block[]): BlockSlot<FoManagedWouldBeData> {
  const block = blocks[FO_MANAGED_WOULD_BE_INDEX];
  const path = `blocks.${FO_MANAGED_WOULD_BE_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoManagedWouldBe(block), path };
  return { data: sectionToFoManagedWouldBe(foManagedWouldBeBlock()), path };
}

export function foManagedPrereqsSlot(blocks: Block[]): BlockSlot<FoManagedPrereqsData> {
  const block = blocks[FO_MANAGED_PREREQS_INDEX];
  const path = `blocks.${FO_MANAGED_PREREQS_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoManagedPrereqs(block), path };
  return { data: sectionToFoManagedPrereqs(foManagedPrereqsBlock()), path };
}

export function foManagedTodaySlot(blocks: Block[]): BlockSlot<FoManagedTodayData> {
  const block = blocks[FO_MANAGED_TODAY_INDEX];
  const path = `blocks.${FO_MANAGED_TODAY_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoManagedToday(block), path };
  return { data: sectionToFoManagedToday(foManagedTodayBlock()), path };
}

export function foManagedWaitlistSlot(blocks: Block[]): BlockSlot<FoManagedWaitlistData> {
  const block = blocks[FO_MANAGED_WAITLIST_INDEX];
  const path = `blocks.${FO_MANAGED_WAITLIST_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToFoManagedWaitlist(block), path };
  return { data: sectionToFoManagedWaitlist(foManagedWaitlistBlock()), path };
}

export const FO_MANAGED_FALLBACK_BLOCKS: Block[] = foManagedBlocks();

export const foManagedPageSeed: FleetMarketingPageSeed = {
  slug: 'for-operators-managed',
  path: '/for-operators/managed',
  title: 'RevealUI Cloud',
  blocks: foManagedBlocks(),
  seo: {
    title: 'RevealUI Cloud | RevealUI',
    description:
      'A self-serve managed runtime on the roadmap. Honest status: not built yet. Agency path ships today.',
  },
};
