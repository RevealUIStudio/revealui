/** CMS block derivation for `/services` (services). */

import {
  FOR_OPERATORS_CLOSING,
  FOR_OPERATORS_DISCOVERY,
  FOR_OPERATORS_HERO,
  FOR_OPERATORS_HOW_WE_DELIVER,
  FOR_OPERATORS_PRICING,
  FOR_OPERATORS_PROOF,
  FOR_OPERATORS_WHAT_YOU_GET,
} from '../../../content/for-operators';
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

export interface ServicesHeroData {
  readonly eyebrow: string;
  readonly h1Lines: readonly string[];
  readonly subtitle: string;
  readonly primaryCta: Cta;
  readonly reverseLink: Cta;
}

export interface ServicesCardData {
  readonly title: string;
  readonly body: string;
}

export interface ServicesWhatYouGetData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly cards: readonly ServicesCardData[];
}

export interface ServicesHowWeDeliverData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly paragraph1: string;
  readonly paragraph2: {
    readonly before: string;
    readonly linkLabel: string;
    readonly linkHref: string;
    readonly after: string;
  };
  readonly paragraph3: string;
}

export interface ServicesPricingIntroData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
}

export interface ServicesDiscoveryData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly link: Cta;
}

export interface ServicesProofData {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly bulletIntro: string;
  readonly bullets: readonly string[];
  readonly links: readonly Cta[];
}

export interface ServicesCtaData {
  readonly heading: string;
  readonly body: string;
  readonly primaryCta: Cta;
  readonly emailFallback: {
    readonly prefix: string;
    readonly address: string;
    readonly suffix: string;
  };
}

export const SERVICES_HERO_BLOCK_ID = 'services-hero';

export const SERVICES_WHAT_YOU_GET_BLOCK_ID = 'services-what-you-get';

export const SERVICES_HOW_WE_DELIVER_BLOCK_ID = 'services-how-we-deliver';

export const SERVICES_PRICING_INTRO_BLOCK_ID = 'services-pricing-intro';

export const SERVICES_DISCOVERY_BLOCK_ID = 'services-discovery';

export const SERVICES_PROOF_BLOCK_ID = 'services-proof';

export const SERVICES_CTA_BLOCK_ID = 'services-cta';

const SERVICES_HERO_INDEX = 0;

const SERVICES_WHAT_YOU_GET_INDEX = 1;

const SERVICES_HOW_WE_DELIVER_INDEX = 2;

const SERVICES_PRICING_INTRO_INDEX = 3;

const SERVICES_DISCOVERY_INDEX = 4;

const SERVICES_PROOF_INDEX = 5;

const SERVICES_CTA_INDEX = 6;

function servicesHeroBlock(): HeroBlock {
  // h1Lines ride title as newline-joined so reverse can restore line breaks.
  return createHeroBlock(SERVICES_HERO_BLOCK_ID, FOR_OPERATORS_HERO.h1Lines.join('\n'), {
    eyebrow: FOR_OPERATORS_HERO.eyebrow,
    subtitle: FOR_OPERATORS_HERO.subtitle,
    links: [
      ctaToLink(FOR_OPERATORS_HERO.primaryCta, 'primary'),
      ctaToLink(FOR_OPERATORS_HERO.reverseLink, 'secondary'),
    ],
  });
}

function servicesWhatYouGetBlock(): SectionBlock {
  return createSectionBlock(SERVICES_WHAT_YOU_GET_BLOCK_ID, FOR_OPERATORS_WHAT_YOU_GET.heading, {
    eyebrow: FOR_OPERATORS_WHAT_YOU_GET.eyebrow,
    body: FOR_OPERATORS_WHAT_YOU_GET.body,
    items: FOR_OPERATORS_WHAT_YOU_GET.cards.map((card) => ({
      label: card.title,
      body: card.body,
    })),
  });
}

function servicesHowWeDeliverBlock(): SectionBlock {
  const p2 = FOR_OPERATORS_HOW_WE_DELIVER.paragraph2;
  return createSectionBlock(
    SERVICES_HOW_WE_DELIVER_BLOCK_ID,
    FOR_OPERATORS_HOW_WE_DELIVER.heading,
    {
      eyebrow: FOR_OPERATORS_HOW_WE_DELIVER.eyebrow,
      body: FOR_OPERATORS_HOW_WE_DELIVER.paragraph1,
      items: [
        { label: 'paragraph2-before', body: p2.before },
        { label: 'paragraph2-link', title: p2.linkHref, body: p2.linkLabel },
        { label: 'paragraph2-after', body: p2.after },
        { label: 'paragraph3', body: FOR_OPERATORS_HOW_WE_DELIVER.paragraph3 },
      ],
    },
  );
}

function servicesPricingIntroBlock(): SectionBlock {
  // Engagement ladder rungs stay in EngagementPricing (prices from contracts).
  return createSectionBlock(SERVICES_PRICING_INTRO_BLOCK_ID, FOR_OPERATORS_PRICING.heading, {
    eyebrow: FOR_OPERATORS_PRICING.eyebrow,
    body: FOR_OPERATORS_PRICING.body,
  });
}

function servicesDiscoveryBlock(): SectionBlock {
  return createSectionBlock(SERVICES_DISCOVERY_BLOCK_ID, FOR_OPERATORS_DISCOVERY.heading, {
    eyebrow: FOR_OPERATORS_DISCOVERY.eyebrow,
    body: FOR_OPERATORS_DISCOVERY.body,
    items: [
      {
        label: FOR_OPERATORS_DISCOVERY.link.label,
        title: FOR_OPERATORS_DISCOVERY.link.href,
        body: '',
      },
    ],
  });
}

function servicesProofBlock(): SectionBlock {
  return createSectionBlock(SERVICES_PROOF_BLOCK_ID, FOR_OPERATORS_PROOF.heading, {
    eyebrow: FOR_OPERATORS_PROOF.eyebrow,
    body: FOR_OPERATORS_PROOF.body,
    items: [
      { label: 'bullet-intro', body: FOR_OPERATORS_PROOF.bulletIntro },
      ...FOR_OPERATORS_PROOF.bullets.map((bullet) => ({
        label: 'bullet',
        body: bullet,
      })),
      ...FOR_OPERATORS_PROOF.links.map((link) => ({
        label: link.label,
        title: link.href,
        body: link.external ? 'external' : 'internal',
      })),
    ],
  });
}

function servicesCtaBlock(): CtaSectionBlock {
  return createCtaSectionBlock(SERVICES_CTA_BLOCK_ID, FOR_OPERATORS_CLOSING.heading, {
    body: FOR_OPERATORS_CLOSING.body,
    links: [ctaToLink(FOR_OPERATORS_CLOSING.primaryCta, 'primary')],
    snippet: {
      lines: [
        FOR_OPERATORS_CLOSING.emailFallback.prefix,
        FOR_OPERATORS_CLOSING.emailFallback.address,
        FOR_OPERATORS_CLOSING.emailFallback.suffix,
      ],
    },
  });
}

export function servicesBlocks(): Block[] {
  return [
    servicesHeroBlock(),
    servicesWhatYouGetBlock(),
    servicesHowWeDeliverBlock(),
    servicesPricingIntroBlock(),
    servicesDiscoveryBlock(),
    servicesProofBlock(),
    servicesCtaBlock(),
  ];
}

export const SERVICES_FALLBACK_BLOCKS: Block[] = servicesBlocks();

function heroToServicesHero(block: HeroBlock): ServicesHeroData {
  const links = block.data.links ?? [];
  const primary = links[0]
    ? {
        ...linkToCta(links[0]),
        ...(hrefLooksExternal(links[0].href) ? { external: true as const } : {}),
      }
    : FOR_OPERATORS_HERO.primaryCta;
  const reverse = links[1] ? linkToCta(links[1]) : FOR_OPERATORS_HERO.reverseLink;
  const lines = block.data.title.split('\n').filter((line) => line.length > 0);
  return {
    eyebrow: block.data.eyebrow ?? '',
    h1Lines: lines.length > 0 ? lines : [...FOR_OPERATORS_HERO.h1Lines],
    subtitle: block.data.subtitle ?? '',
    primaryCta: primary,
    reverseLink: reverse,
  };
}

function sectionToServicesWhatYouGet(block: SectionBlock): ServicesWhatYouGetData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    cards: (block.data.items ?? []).map((item) => ({
      title: item.label ?? '',
      body: item.body,
    })),
  };
}

function sectionToServicesHowWeDeliver(block: SectionBlock): ServicesHowWeDeliverData {
  const byLabel = new Map((block.data.items ?? []).map((item) => [item.label ?? '', item]));
  const p2 = FOR_OPERATORS_HOW_WE_DELIVER.paragraph2;
  const linkItem = byLabel.get('paragraph2-link');
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    paragraph1: block.data.body ?? '',
    paragraph2: {
      before: byLabel.get('paragraph2-before')?.body ?? p2.before,
      linkLabel: linkItem?.body ?? p2.linkLabel,
      linkHref: linkItem?.title ?? p2.linkHref,
      after: byLabel.get('paragraph2-after')?.body ?? p2.after,
    },
    paragraph3: byLabel.get('paragraph3')?.body ?? FOR_OPERATORS_HOW_WE_DELIVER.paragraph3,
  };
}

function sectionToServicesPricingIntro(block: SectionBlock): ServicesPricingIntroData {
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
  };
}

function sectionToServicesDiscovery(block: SectionBlock): ServicesDiscoveryData {
  const linkItem = (block.data.items ?? [])[0];
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    link: {
      label: linkItem?.label ?? FOR_OPERATORS_DISCOVERY.link.label,
      href: linkItem?.title ?? FOR_OPERATORS_DISCOVERY.link.href,
    },
  };
}

function sectionToServicesProof(block: SectionBlock): ServicesProofData {
  const items = block.data.items ?? [];
  const intro = items.find((item) => item.label === 'bullet-intro');
  const bullets = items.filter((item) => item.label === 'bullet').map((item) => item.body);
  const links = items
    .filter((item) => item.label !== 'bullet-intro' && item.label !== 'bullet')
    .map((item) => ({
      label: item.label ?? '',
      href: item.title ?? '',
      ...(item.body === 'external' || hrefLooksExternal(item.title ?? '')
        ? { external: true as const }
        : {}),
    }));
  return {
    eyebrow: block.data.eyebrow ?? '',
    heading: block.data.heading,
    body: block.data.body ?? '',
    bulletIntro: intro?.body ?? FOR_OPERATORS_PROOF.bulletIntro,
    bullets: bullets.length > 0 ? bullets : [...FOR_OPERATORS_PROOF.bullets],
    links: links.length > 0 ? links : [...FOR_OPERATORS_PROOF.links],
  };
}

function ctaToServicesCta(block: CtaSectionBlock): ServicesCtaData {
  const links = block.data.links ?? [];
  const lines = block.data.snippet?.lines ?? [];
  const primary = links[0]
    ? {
        ...linkToCta(links[0]),
        ...(hrefLooksExternal(links[0].href) ? { external: true as const } : {}),
      }
    : FOR_OPERATORS_CLOSING.primaryCta;
  return {
    heading: block.data.heading,
    body: block.data.body ?? '',
    primaryCta: primary,
    emailFallback: {
      prefix: lines[0] ?? FOR_OPERATORS_CLOSING.emailFallback.prefix,
      address: lines[1] ?? FOR_OPERATORS_CLOSING.emailFallback.address,
      suffix: lines[2] ?? FOR_OPERATORS_CLOSING.emailFallback.suffix,
    },
  };
}

export function servicesHeroSlot(blocks: Block[]): BlockSlot<ServicesHeroData> {
  const block = blocks[SERVICES_HERO_INDEX];
  const path = `blocks.${SERVICES_HERO_INDEX}.data`;
  if (block && block.type === 'hero') return { data: heroToServicesHero(block), path };
  return { data: heroToServicesHero(servicesHeroBlock()), path };
}

export function servicesWhatYouGetSlot(blocks: Block[]): BlockSlot<ServicesWhatYouGetData> {
  const block = blocks[SERVICES_WHAT_YOU_GET_INDEX];
  const path = `blocks.${SERVICES_WHAT_YOU_GET_INDEX}.data`;
  if (block && block.type === 'section') {
    return { data: sectionToServicesWhatYouGet(block), path };
  }
  return { data: sectionToServicesWhatYouGet(servicesWhatYouGetBlock()), path };
}

export function servicesHowWeDeliverSlot(blocks: Block[]): BlockSlot<ServicesHowWeDeliverData> {
  const block = blocks[SERVICES_HOW_WE_DELIVER_INDEX];
  const path = `blocks.${SERVICES_HOW_WE_DELIVER_INDEX}.data`;
  if (block && block.type === 'section') {
    return { data: sectionToServicesHowWeDeliver(block), path };
  }
  return { data: sectionToServicesHowWeDeliver(servicesHowWeDeliverBlock()), path };
}

export function servicesPricingIntroSlot(blocks: Block[]): BlockSlot<ServicesPricingIntroData> {
  const block = blocks[SERVICES_PRICING_INTRO_INDEX];
  const path = `blocks.${SERVICES_PRICING_INTRO_INDEX}.data`;
  if (block && block.type === 'section') {
    return { data: sectionToServicesPricingIntro(block), path };
  }
  return { data: sectionToServicesPricingIntro(servicesPricingIntroBlock()), path };
}

export function servicesDiscoverySlot(blocks: Block[]): BlockSlot<ServicesDiscoveryData> {
  const block = blocks[SERVICES_DISCOVERY_INDEX];
  const path = `blocks.${SERVICES_DISCOVERY_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToServicesDiscovery(block), path };
  return { data: sectionToServicesDiscovery(servicesDiscoveryBlock()), path };
}

export function servicesProofSlot(blocks: Block[]): BlockSlot<ServicesProofData> {
  const block = blocks[SERVICES_PROOF_INDEX];
  const path = `blocks.${SERVICES_PROOF_INDEX}.data`;
  if (block && block.type === 'section') return { data: sectionToServicesProof(block), path };
  return { data: sectionToServicesProof(servicesProofBlock()), path };
}

export function servicesCtaSlot(blocks: Block[]): BlockSlot<ServicesCtaData> {
  const block = blocks[SERVICES_CTA_INDEX];
  const path = `blocks.${SERVICES_CTA_INDEX}.data`;
  if (block && block.type === 'ctaSection') return { data: ctaToServicesCta(block), path };
  return { data: ctaToServicesCta(servicesCtaBlock()), path };
}

export const servicesPageSeed: FleetMarketingPageSeed = {
  slug: 'services',
  path: '/services',
  title: 'Services',
  blocks: servicesBlocks(),
  seo: {
    title: 'Services | RevealUI',
    description:
      'Done-for-you software with AI built in. Fixed-scope engagements from discovery call to live product you own.',
  },
};
