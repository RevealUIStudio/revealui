// Sourced from `~/revfleet/.jv/docs/specs/2026-05-28-for-operators-page-1-copy.md`
// (the COMMIT-phase copy artifact for spec-2026-05-14-non-technical-lane.md Phase 1).
// Voice §5 self-check 12/12 documented in that spec.
// Locked decisions from spec §9.4: CTA "Book a build call" (OQ-3); nav label
// "For Operators" (OQ-4); fork Branch A stays on / (OQ-5); coupled ship with
// agency-site receiving surface (OQ-6).
// The future managed offering is named "RevealUI Cloud" (OQ-1) — referenced
// only via the inline link to /for-operators/managed (Page 3, not this PR).

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
  h1Lines: ['Software for your business.', 'Built and delivered.'] as const,
  subtitle:
    'Accounts, billing, content, and an admin dashboard — the software layer of a business, already built. We deliver it live, on infrastructure in your name, with the admin login in your hand. The first version runs in weeks, not quarters.',
  primaryCta: {
    label: 'Book a build call',
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
  body: 'A working business: accounts, billing, content, and a place to operate the thing. Five capabilities, in plain English.',
  cards: [
    {
      title: 'Customers can sign in.',
      body: 'Real accounts with passwords, password resets, and roles. You decide who sees what. The admin you log into is the same admin your team uses.',
    },
    {
      title: 'Customers can pay you.',
      body: 'Stripe Checkout, subscriptions, one-time charges, and a billing page customers can self-serve. Refunds and disputes are handled in the dashboard, not by emailing your accountant.',
    },
    {
      title: 'You have a dashboard.',
      body: 'One admin you log into to manage products, customers, content, and orders. No second tool. No spreadsheet stitched to a Stripe export.',
    },
    {
      title: 'The software can do work on its own.',
      body: 'An agent layer that drafts emails, processes orders, and runs recurring tasks. It runs on open AI models on your infrastructure, not on a per-token API. The AI bill is your inference cost, not a per-task tax.',
    },
    {
      title: 'It is yours.',
      body: 'The code is yours. The data is yours. The Stripe account is yours. The hosting account is yours. If you ever want to walk away from RevealUI Studio, you take it with you and a different engineer can pick it up.',
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
      'A self-serve managed version — sign up, configure in a browser, get a hosted product without an engagement — is on the roadmap. See the ',
    linkLabel: 'managed roadmap',
    linkHref: MANAGED_ROADMAP_HREF,
    after:
      ' for what that means and when it might be ready. It does not ship today. If you want a working product now, the path is a build call.',
  },
  paragraph3:
    'If "I want it automatic and instant" is the requirement, this is not yet the right time to engage. If "I want it built, scoped, and delivered by people who maintain the runtime it runs on" is the requirement, that is what we ship.',
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
  body: 'RevealUI Studio is one engineer — Joshua Vaughn — and the runtime he maintains. Ten years managing teams in telecommunications before this. The agency engagement is delivered by the same person who reviews every commit to the open-source codebase you will be running.',
  bulletIntro: 'That means three concrete things:',
  bullets: [
    'The software we build for you runs the same code we run on revealui.com.',
    'When a bug surfaces in your deployment, the person debugging it wrote that part of the runtime.',
    'When the runtime ships a new feature, your deployment gets it on the same release cadence as every other one.',
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
        "No, to operate the product we deliver. You log into the admin, click around, manage your business. Changing the software — adding a new feature, a new page, a new integration — is an engineer's job. You can hire RevealUI Studio for that or hire your own engineer; we deliver code another engineer can pick up.",
    },
    {
      question: 'Is this a website builder, like Wix or Squarespace?',
      answer:
        'No. Wix and Squarespace build brochure websites. We deliver a real software product with real customer accounts, billing, data, and an admin you operate. If a brochure site is what you need, those tools are faster and cheaper — book the call only if "real software with real customer accounts" is what you actually need.',
    },
    {
      question: 'Who hosts it? What if RevealUI Studio goes away?',
      answer:
        'You host it — on infrastructure in your name (Vercel for the app, Neon for the database, Stripe for billing). The code is open source. If RevealUI Studio ceased to exist tomorrow, your product keeps running on the same infrastructure with no change. Hiring a different engineer to take over the codebase is a normal hand-off, not a rescue mission.',
    },
    {
      question: 'How much does it cost?',
      answer:
        'The discovery call scopes the engagement. A $3,500 fixed-bid Architecture Review is available as a written-assessment starting point if you want an outside-eye look before committing to a full engagement. Full-scope engagement prices are scoped per project in discovery.',
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
        "The runtime ships an agent layer that can draft emails, process orders, and run recurring tasks for you. It runs on open AI models on your infrastructure, not on a per-call API — the AI bill is your inference cost, not a per-task tax. The first practical use cases for most operators are customer-email triage, recurring report generation, and routine inventory tasks; we scope what's right for your business in discovery.",
    },
  ] as readonly FaqItem[],
} as const;

export const FOR_OPERATORS_CLOSING = {
  heading: 'Get on a call.',
  body: "A free 30-minute discovery call. We walk through what you're building, whether we're the right team for it, and what a scoped engagement would look like.",
  primaryCta: {
    label: 'Book a build call',
    href: AGENCY_CONTACT,
    external: true,
  } satisfies Cta,
  emailFallback: {
    prefix: 'Email ',
    address: SITE.emails.founder,
    suffix: ' if a form is not right.',
  },
} as const;
