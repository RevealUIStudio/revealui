/** CMS block derivation for `/fair-source` (fair-source). */

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
} from '../../../content/fair-source';
import {
  type Block,
  type BlockSlot,
  type Cta,
  type CtaSectionBlock,
  createCtaSectionBlock,
  createSectionBlock,
  type FleetMarketingPageSeed,
  linkToCta,
  type SectionBlock,
} from '../shared';

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

export const FAIR_SOURCE_CONTRACT_BLOCK_ID = 'fair-source-contract';

export const FAIR_SOURCE_PACKAGES_INTRO_BLOCK_ID = 'fair-source-packages-intro';

export const FAIR_SOURCE_CLOCK_BLOCK_ID = 'fair-source-clock';

export const FAIR_SOURCE_PEERS_BLOCK_ID = 'fair-source-peers';

export const FAIR_SOURCE_FAQ_BLOCK_ID = 'fair-source-faq';

export const FAIR_SOURCE_CTA_BLOCK_ID = 'fair-source-cta';

const FAIR_SOURCE_CONTRACT_INDEX = 0;

const FAIR_SOURCE_PACKAGES_INTRO_INDEX = 1;

const FAIR_SOURCE_CLOCK_INDEX = 2;

const FAIR_SOURCE_PEERS_INDEX = 3;

const FAIR_SOURCE_FAQ_INDEX = 4;

const FAIR_SOURCE_CTA_INDEX = 5;

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

export const FAIR_SOURCE_FALLBACK_BLOCKS: Block[] = fairSourceBlocks();

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

export const fairSourcePageSeed: FleetMarketingPageSeed = {
  slug: 'fair-source',
  path: '/fair-source',
  title: 'Fair Source',
  blocks: fairSourceBlocks(),
  seo: {
    title: 'Fair Source | RevealUI',
    description:
      'Source-visible. Commercially usable. MIT in two years. The license contract for RevealUI Pro packages.',
  },
};
