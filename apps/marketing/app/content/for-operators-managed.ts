// Sourced from spec-2026-05-14-non-technical-lane.md §3.3 Page 3 brief.
// Phase 5 of the non-technical-lane spec — the honest managed-roadmap page.
//
// Locked decisions consumed (from spec §9.4):
// - OQ-1: "RevealUI Cloud" — locked working name for the future managed offering.
// - OQ-2: ship Page 3 with the lane (operator arrives with SaaS mental model;
//   silence causes misread of the agency engagement as a managed product).
// - OQ-3: "Book a build call" — CTA for the impatient-operator path.
// - OQ-6: agency-site coupling.
//
// Honesty doctrine (the page's load-bearing constraint):
// - Names that RevealUI Cloud does NOT ship today at H2 weight.
// - No prices, no dates, no signup buttons that imply the product exists,
//   no present-tense feature claims as if the product ships.
// - The waitlist is the ONLY conversion action, explicitly labeled as a waitlist.
// - Impatient operators are routed back to /for-operators (the agency path
//   that ships today).
//
// Voice rules: all 5 apply unchanged + operator-lane register per spec §7
// (codified in voice-and-headline-rules.md §2.1).

import { SITE } from './site';
import type { Cta } from './types';

const AGENCY_CONTACT = `${SITE.urls.agency}/contact` as const;

export const FO_MANAGED_HERO = {
  eyebrow: 'Roadmap',
  h1Lines: ['RevealUI Cloud.', 'On the roadmap.'] as const,
  subtitle:
    'A self-serve managed version of the runtime: sign up in a browser, configure your business, get a hosted product without an agency engagement. It does not ship today. This page is the honest roadmap.',
  backLink: {
    label: '← Back to For Operators',
    href: '/for-operators',
  } satisfies Cta,
} as const;

export const FO_MANAGED_STATUS = {
  eyebrow: 'Status',
  heading: 'Not built. On the roadmap.',
  paragraph1:
    'RevealUI Cloud does not exist today. There is no signup, no billing, no managed hosting you can configure in a browser.',
  paragraph2:
    'What does exist today is the RevealUI Studio agency engagement: we build and deliver a working product for your business as a scoped engagement. See For Operators for the path that ships.',
  paragraph3:
    'This page is the honest version of the question "is there a managed offering?" Yes, on the roadmap; no, not yet.',
} as const;

export interface WouldBeCapability {
  readonly title: string;
  readonly body: string;
}

export const FO_MANAGED_WOULD_BE = {
  eyebrow: 'What it would be',
  heading: 'When RevealUI Cloud ships, you would:',
  capabilities: [
    {
      title: 'Sign up in a browser.',
      body: 'No agency call required. Email, payment method, business name: the SaaS-shape onboarding most operators expect.',
    },
    {
      title: 'Configure the business in a browser.',
      body: 'Name, branding, products, billing rates, customer-facing copy: all set up through a configuration UI, no code.',
    },
    {
      title: 'Get a hosted instance in your account.',
      body: 'The runtime, deployed and managed by RevealUI Studio, on infrastructure registered to your business.',
    },
    {
      title: 'Operate via the admin dashboard.',
      body: 'Same admin UI as the agency-delivered version. Same RBAC, same audit chain, same primitives.',
    },
    {
      title: 'Receive product support directly.',
      body: 'Defined response times, defined escalation paths, included in the price. Not the bespoke retainer the agency offers: a productized support contract.',
    },
  ] as readonly WouldBeCapability[],
  closing:
    'This is the SaaS-shape mental model operators arrive with. RevealUI Cloud is what fulfills it, when it ships.',
} as const;

export interface Prerequisite {
  readonly title: string;
  readonly body: string;
}

export const FO_MANAGED_PREREQS = {
  eyebrow: 'Prerequisites',
  heading: 'What has to be true before RevealUI Cloud ships.',
  intro: 'Four things must be in place before the managed offering can move from roadmap to real:',
  prerequisites: [
    {
      title: 'The runtime has to charge customers in live mode.',
      body: 'A managed offering charges money. The runtime can charge today in test mode; live mode is gated on owner-side operational steps. Until that gate clears, no managed signup can complete a real transaction.',
    },
    {
      title: 'A provisioning path that stands up a per-operator hosted instance, without a human.',
      body: 'This is real engineering work, unbuilt today. The agency engagement stands up each operator manually; the managed offering needs that automated.',
    },
    {
      title: 'An operator-legible configuration UI.',
      body: 'The operator configures the business in a browser: branding, products, payments, copy. The UI to do that does not exist today.',
    },
    {
      title: 'A defined support contract for self-serve operators.',
      body: 'The agency engagement has support baked into the relationship. A self-serve tier needs an explicit shape (what is included, response times, escalation) that the agency motion does not currently formalize.',
    },
  ] as readonly Prerequisite[],
  closing:
    'Each prerequisite is a multi-week-to-multi-month engineering effort. The work is funded by revenue from the agency engagement.',
} as const;

export const FO_MANAGED_TODAY = {
  eyebrow: 'If you want it today',
  heading: 'Book the agency engagement.',
  body: 'The path that ships, today, is the RevealUI Studio agency engagement. Discovery call → fixed-scope proposal → we build it → you get the keys. Weeks, not quarters.',
  primaryCta: {
    label: 'Book a build call',
    href: AGENCY_CONTACT,
    external: true,
  } satisfies Cta,
  detailLink: {
    label: 'Read how the engagement works →',
    href: '/for-operators/how-it-works',
  } satisfies Cta,
} as const;

export const FO_MANAGED_WAITLIST = {
  eyebrow: 'Waitlist',
  heading: 'Want it when it ships? Join the waitlist.',
  body: 'Tell us your email and we will record your interest in RevealUI Cloud specifically. We will reach out when there is something to demo, not before.',
  product: 'managed-cloud',
  inputPlaceholder: 'you@company.com',
  buttonLabel: 'Join the waitlist',
  buttonLabelLoading: 'Joining…',
  successMessage:
    'You are on the RevealUI Cloud waitlist. We will email when there is something to demo.',
} as const;
