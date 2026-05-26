// Sponsor page content.
// Sourced from extraction of app/routes/SponsorPage.tsx (Phase 1, no copy changes).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from './site';
import type { Cta } from './types';

export interface SponsorTier {
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly emoji: string;
  readonly description: string;
  readonly benefits: readonly string[];
}

export interface SupportArea {
  readonly title: string;
  readonly description: string;
  readonly iconKey: 'development' | 'documentation' | 'community';
}

export const SPONSOR_HERO = {
  brand: 'Sponsor',
  brandHighlight: 'RevealUI',
  subhead:
    'RevealUI is open source and free to use. Your sponsorship helps fund development, documentation, and community support.',
  cta: {
    label: 'Sponsor on GitHub',
    href: SITE.urls.sponsors,
    external: true,
  } satisfies Cta,
} as const;

export const SPONSOR_TIERS_SECTION = {
  heading: {
    title: 'Sponsorship Tiers',
    subtitle: 'Every contribution matters. Choose the tier that works for you.',
  },
  ctaBottom: {
    label: 'Become a Sponsor',
    href: SITE.urls.sponsors,
    external: true,
  } satisfies Cta,
} as const;

export const SPONSOR_TIERS: readonly SponsorTier[] = [
  {
    name: 'Supporter',
    price: '$5',
    period: '/month',
    emoji: '☕',
    description: 'Buy the maintainers a coffee.',
    benefits: ['Sponsor badge on GitHub profile', 'Shoutout in release notes'],
  },
  {
    name: 'Backer',
    price: '$25',
    period: '/month',
    emoji: '⭐',
    description: 'Support ongoing development.',
    benefits: [
      'All Supporter benefits',
      'Name listed on sponsors page',
      'Early access to roadmap updates',
      'Priority issue responses',
    ],
  },
  {
    name: 'Gold Sponsor',
    price: '$100',
    period: '/month',
    emoji: '\u{1F3C6}',
    description: 'Fund a major feature every quarter.',
    benefits: [
      'All Backer benefits',
      'Logo on README and docs site',
      'Monthly office hours call',
      'Vote on roadmap priorities',
    ],
  },
  {
    name: 'Platinum Sponsor',
    price: '$500',
    period: '/month',
    emoji: '\u{1F48E}',
    description: 'Fund a release and help shape the roadmap.',
    benefits: [
      'All Gold Sponsor benefits',
      'Logo with link on landing page',
      'Dedicated Discourse channel',
      'Direct line to the founder for prioritized feature requests — implementation scoped separately via RevealUI Studio engagements',
    ],
  },
] as const;

export const SPONSOR_SUPPORT_AREAS: readonly SupportArea[] = [
  {
    title: 'Development',
    description: 'New features, bug fixes, and performance improvements.',
    iconKey: 'development',
  },
  {
    title: 'Documentation',
    description: 'Guides, tutorials, API references, and examples.',
    iconKey: 'documentation',
  },
  {
    title: 'Community',
    description: 'Discourse forums, issue triage, code reviews, and mentorship.',
    iconKey: 'community',
  },
];

export const SPONSOR_SUPPORT_HEADING = 'Where Your Support Goes';

export const SPONSOR_FOOTER_NOTE = {
  prefix: 'Looking for the product? See ',
  productsLink: { label: 'Products', href: '/products' } satisfies Cta,
  separator: ' or ',
  docsLink: { label: 'read the docs', href: SITE.urls.docs, external: true } satisfies Cta,
  suffix: '.',
} as const;
