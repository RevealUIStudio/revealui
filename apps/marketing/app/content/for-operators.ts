// Sourced from the internal for-operators page-1 copy spec (2026-05-28)
// (the COMMIT-phase copy artifact for spec-2026-05-14-non-technical-lane.md Phase 1).
// Voice §5 self-check 12/12 documented in that spec.
// Locked decisions from spec §9.4: CTA "Book a 30-minute intro" (OQ-3);
// nav label "For Operators" (OQ-4); fork Branch A stays on / (OQ-5);
// coupled ship with agency-site receiving surface (OQ-6).
// Live /for-operators and /services are Moved stubs. This module is leftover
// CMS/page-block copy only — do not republish Written plan / ten years /
// Book a build call.
// The future managed offering is named "RevealUI Cloud" (OQ-1) — referenced
// only via the inline link to /for-operators/managed (Page 3, not this PR).
//
// claims-ratchet 2026-07-12: the agent-layer card drops "processes orders"
// because an email-agent template ships (packages/ai/src/templates) but no
// order-processing template exists.

import {
  ARCHITECTURE_REVIEW_PRICE,
  CONSULTING_HOUR_PRICE,
  LAUNCH_PACKAGE_PRICE,
} from '@revealui/contracts/public-catalog';
import { SITE } from './site';
import type { Cta, FaqItem } from './types';

/**
 * Agency-site contact surface — where the operator funnel converts.
 * Per non-technical-lane spec §6.2 handoff contract.
 */
const AGENCY_CONTACT = `${SITE.urls.agency}/contact` as const;

/**
 * Page 3 (managed roadmap) — not yet implemented; the inline link in
 * Section 3 of this page references it. Until Page 3 ships, the link
 * lands on the 404 page (acceptable for Phase 1 — Page 3 is Phase 5).
 */
const MANAGED_ROADMAP_HREF = '/for-operators/managed' as const;

export const FOR_OPERATORS_HERO = {
  eyebrow: 'Built. Delivered. Yours.',
  h1Lines: ['Your business grows with you,', 'and stays at the frontier.'] as const,
  subtitle:
    'Running a business is hard enough without racing AI stack churn. We build and deliver software with agents built in, on infrastructure you own, and keep it current as the world moves. You stay ahead and keep doing the work you love.',
  primaryCta: {
    label: 'Book a 30-minute intro',
    href: AGENCY_CONTACT,
    external: true,
  } satisfies Cta,
  reverseLink: {
    label: 'Are you a developer? See the runtime.',
    href: '/',
  } satisfies Cta,
} as const;

export interface OutcomeCard {
  readonly title: string;
  readonly body: string;
}

export const FOR_OPERATORS_WHAT_YOU_GET = {
  eyebrow: 'What you get',
  heading: 'What you get when we deliver.',
  body: 'A working business: accounts, billing, content, and a place to run it. Five outcomes, in plain English.',
  cards: [
    {
      title: 'Customers can sign in.',
      body: 'Real accounts with passwords, password resets, and roles. You decide who sees what. The admin you use is the same admin your team uses.',
    },
    {
      title: 'Customers can pay you.',
      body: 'Checkout, subscriptions, one-time charges, and a billing page customers can self-serve. Refunds and disputes live in the dashboard, not in an email thread with your accountant.',
    },
    {
      title: 'You have a dashboard.',
      body: 'One admin to manage products, customers, content, and orders. No second tool. No spreadsheet stitched to a Stripe export.',
    },
    {
      title: 'The software can do work on its own.',
      body: 'An agent layer that drafts emails and runs recurring tasks. It runs on open models on your infrastructure. The AI bill is your inference cost, not a per-task tax.',
    },
    {
      title: 'It is yours.',
      body: 'The code is yours. The data is yours. The Stripe account is yours. The hosting account is yours. If you walk away from RevealUI Studio, you take it with you and another engineer can pick it up.',
    },
  ] as readonly OutcomeCard[],
} as const;

export const FOR_OPERATORS_HOW_WE_DELIVER = {
  eyebrow: 'How we deliver',
  heading: 'How we deliver, today.',
  paragraph1:
    'Today, RevealUI Studio builds and delivers this for you as a fixed-scope engagement. A discovery call scopes the work. We build, deploy, and hand you a live product and the admin login. You operate it without code.',
  paragraph2: {
    before:
      'A self-serve managed version (sign up, configure in a browser, get a hosted product without an engagement) is on the roadmap. See the ',
    linkLabel: 'managed roadmap',
    linkHref: MANAGED_ROADMAP_HREF,
    after:
      ' for what that means and when it might be ready. It does not ship today. If you want a working product now, the path is a 30-minute intro.',
  },
  paragraph3:
    'If "I want it automatic and instant" is the requirement, this is not yet the right time to engage. If "I want it built, scoped, and delivered by people who maintain the runtime it runs on" is the requirement, that is what we ship.',
} as const;

// ---------------------------------------------------------------------------
// Studio engagement ladder — Hour / Architecture artifact bundle and
// review / Launch on revealuistudio.com only. Dead leftover rungs must
// not exist in this module. Prices import from @revealui/contracts/public-catalog
// so leftover admin catalogs cannot ship in the public marketing bundle.
// ---------------------------------------------------------------------------

export type AgencyEngagementId = 'consulting-hour' | 'architecture-review' | 'launch-package';

export interface AgencyEngagement {
  readonly id: AgencyEngagementId;
  readonly name: string;
  readonly price: string;
  readonly startsFrom: boolean;
}

export const AGENCY_ENGAGEMENT_LADDER: readonly AgencyEngagement[] = [
  {
    id: 'consulting-hour',
    name: 'Hour',
    price: CONSULTING_HOUR_PRICE,
    startsFrom: false,
  },
  {
    id: 'architecture-review',
    name: 'Architecture artifact bundle and review',
    price: ARCHITECTURE_REVIEW_PRICE,
    startsFrom: false,
  },
  {
    id: 'launch-package',
    name: 'Launch',
    price: LAUNCH_PACKAGE_PRICE,
    startsFrom: false,
  },
] as const;

/** Rendered display form for a ladder rung ("$3,500"). */
export function agencyEngagementPriceDisplay(engagement: AgencyEngagement): string {
  return engagement.startsFrom ? `from ${engagement.price}` : engagement.price;
}

function findEngagement(id: AgencyEngagementId): AgencyEngagement {
  const found = AGENCY_ENGAGEMENT_LADDER.find((e) => e.id === id);
  if (!found) throw new Error(`unknown agency engagement id: ${id}`);
  return found;
}

const CONSULTING_HOUR = findEngagement('consulting-hour');
const ARCHITECTURE_REVIEW = findEngagement('architecture-review');
const LAUNCH_PACKAGE = findEngagement('launch-package');

// ---------------------------------------------------------------------------
// Engagement pricing — rendered by components/for-operators/EngagementPricing.tsx,
// placed after <HowWeDeliver /> on ForOperatorsPage. Surface-specific body copy
// is operator-voice; the canonical anchor (name + price) derives from
// AGENCY_ENGAGEMENT_LADDER above.
// ---------------------------------------------------------------------------

export interface PricingRung {
  readonly title: string;
  readonly price: string;
  readonly body: string;
  readonly cta: Cta;
}

export const FOR_OPERATORS_PRICING = {
  eyebrow: 'What it costs',
  heading: 'What an engagement costs.',
  body: 'Engagements are fixed-bid and start with a discovery call that scopes the work. The numbers below are starting points, not final quotes.',
  rungs: [
    {
      title: CONSULTING_HOUR.name,
      price: agencyEngagementPriceDisplay(CONSULTING_HOUR),
      body: 'One hour with the founder. Architecture advice, migration planning, or implementation guidance. Booked on Google Calendar. This SKU lives on revealuistudio.com, not on the product catalog.',
      cta: { label: 'Book a session', href: AGENCY_CONTACT, external: true },
    },
    {
      title: ARCHITECTURE_REVIEW.name,
      price: agencyEngagementPriceDisplay(ARCHITECTURE_REVIEW),
      body: 'An architecture artifact bundle and review of your current stack. The prototype is inside the bundle, not a second deliverable. This SKU lives on revealuistudio.com, not on the product catalog.',
      cta: { label: 'Book a 30-minute intro', href: AGENCY_CONTACT, external: true },
    },
    {
      title: LAUNCH_PACKAGE.name,
      price: agencyEngagementPriceDisplay(LAUNCH_PACKAGE),
      body: 'We stand up your RevealUI instance, migrate your content, and get you to first deploy. This SKU lives on revealuistudio.com, not on the product catalog.',
      cta: { label: 'Book a 30-minute intro', href: AGENCY_CONTACT, external: true },
    },
  ] as readonly PricingRung[],
} as const;

export const FOR_OPERATORS_DISCOVERY = {
  eyebrow: 'How the engagement works',
  heading: 'Discovery, scope, ship.',
  body: "Every engagement starts with a free 30-minute discovery call. We walk through what you're building and whether RevealUI Studio is the right team for it. If we are, we scope with a fixed-bid statement of work. If we're not, we'll point you somewhere that is.",
  link: {
    label: 'Read how the engagement works →',
    href: '/for-operators/how-it-works',
  } satisfies Cta,
} as const;

export const FOR_OPERATORS_PROOF = {
  eyebrow: 'Who delivers it',
  heading: 'Built by the engineer who built the runtime.',
  body: 'RevealUI Studio is one engineer, Joshua Vaughn, and the runtime he maintains. 5+ years managing teams in telecommunications before this. The engagement is delivered by the same person who reviews commits on the open-source codebase you will run.',
  bulletIntro: 'That means three concrete things:',
  bullets: [
    'The software we build for you runs the same code we run on revealui.com.',
    'When a bug surfaces in your deployment, the person debugging it wrote that part of the runtime.',
    'When the runtime ships a new feature, your deployment can take the same release cadence as the rest of the fleet.',
  ] as readonly string[],
  links: [
    {
      label: 'Read the runtime on GitHub →',
      href: SITE.urls.repo,
      external: true,
    },
  ] as readonly Cta[],
} as const;

export const FOR_OPERATORS_FAQ = {
  eyebrow: 'FAQ',
  heading: 'Common questions.',
  items: [
    {
      question: 'Do I need to know how to code?',
      answer:
        "No, to operate the product we deliver. You log into the admin, click around, manage your business. Changing the software (adding a new feature, a new page, a new integration) is an engineer's job. You can hire RevealUI Studio for that or hire your own engineer; we deliver code another engineer can pick up.",
    },
    {
      question: 'Is this a website builder, like Wix or Squarespace?',
      answer:
        'No. Wix and Squarespace build brochure websites. We deliver a real software product with real customer accounts, billing, data, and an admin you operate. If a brochure site is what you need, those tools are faster and cheaper. Book the call only if "real software with real customer accounts" is what you actually need.',
    },
    {
      question: 'Who hosts it? What if RevealUI Studio goes away?',
      answer:
        'You host it, on infrastructure in your name (Vercel for the app, Neon for the database, Stripe for billing). The code is open source. If RevealUI Studio ceased to exist tomorrow, your product keeps running on the same infrastructure with no change. Hiring a different engineer to take over the codebase is a normal hand-off, not a rescue mission.',
    },
    {
      question: 'How much does it cost?',
      answer: `Studio SKUs live on revealuistudio.com, not on this catalog. ${CONSULTING_HOUR.name} is ${CONSULTING_HOUR.price}, ${ARCHITECTURE_REVIEW.name} is ${ARCHITECTURE_REVIEW.price}, and ${LAUNCH_PACKAGE.name} is ${LAUNCH_PACKAGE.price}. Book on Google Calendar from that site.`,
    },
    {
      question: 'How long does it take?',
      answer:
        'Weeks, not quarters. The discovery call gives you the range for your specific scope.',
    },
    {
      question: 'Can you build my specific thing?',
      answer:
        "The discovery call is where we answer this. If RevealUI Studio is the right fit, we scope it. If we're not the right fit, we'll tell you and point you somewhere that is.",
    },
    {
      question: 'What about AI?',
      answer:
        'The runtime ships an agent layer that can draft emails and run recurring tasks. It runs on open models on your infrastructure. The AI bill is your inference cost, not a per-task tax. Common first uses are email triage, recurring reports, and routine ops tasks. We scope what fits your business in discovery.',
    },
  ] as readonly FaqItem[],
} as const;

export const FOR_OPERATORS_CLOSING = {
  heading: 'Get on a call.',
  body: "A free 30-minute discovery call. We walk through what you're building, whether we're the right team for it, and what a scoped engagement would look like.",
  primaryCta: {
    label: 'Book a 30-minute intro',
    href: AGENCY_CONTACT,
    external: true,
  } satisfies Cta,
  emailFallback: {
    prefix: 'Email ',
    address: SITE.emails.founder,
    suffix: ' if a form is not right.',
  },
} as const;
