// Sourced from spec-2026-05-14-non-technical-lane.md §3.3 Page 2 brief.
// Phase 4 of the non-technical-lane spec — the process page that removes
// the operator's fear by making the engagement concrete and bounded.
//
// Locked decisions consumed (from spec §9.4):
// - OQ-3: "Book a build call" — same CTA as Page 1, consistent across the seam.
// - OQ-6: agency-site coupling — CTA routes to ${SITE.urls.agency}/contact.
//
// Voice constraints honored:
// - The 5 voice rules (R1-R5) per the internal messaging-funnel audit
//   (voice-and-headline rules).
// - Operator-lane register per non-technical-lane spec §7 (first-person plural
//   about the studio + third-person about the runtime + second-person about
//   the operator).
// - No specific day-counts as promises; range framing only ("weeks, not quarters").
// - No specific dollar figures per agency-pricing-floors ADR.

import { SITE } from './site';
import type { Cta } from './types';

const AGENCY_CONTACT = `${SITE.urls.agency}/contact` as const;

export const FO_HIW_HERO = {
  eyebrow: 'How the engagement works',
  h1Lines: ['Discovery, scope,', 'build, deliver.'] as const,
  subtitle:
    'A discovery call scopes the work. We build, deploy, and hand over a live product with the admin login. Weeks, not quarters. The discovery call gives you the range for your specific scope.',
  primaryCta: {
    label: 'Book a build call',
    href: AGENCY_CONTACT,
    external: true,
  } satisfies Cta,
  backLink: {
    label: '← Back to Services',
    href: '/services',
  } satisfies Cta,
} as const;

export interface EngagementStep {
  readonly number: string;
  readonly title: string;
  readonly body: string;
}

export const FO_HIW_STEPS = {
  eyebrow: 'The five steps',
  heading: 'What happens, in order.',
  steps: [
    {
      number: '01',
      title: 'Discovery call.',
      body: "30 minutes, free. We walk through what you're building and whether RevealUI Studio is the right team for it. If we are, we move to scope. If we're not, we tell you and point you somewhere that is.",
    },
    {
      number: '02',
      title: 'Fixed-scope proposal.',
      body: "A written statement of work: what we'll build, what the deliverable looks like, what's in and out of scope, and the engagement timeline. Fixed-bid. No surprise change orders.",
    },
    {
      number: '03',
      title: 'We build.',
      body: 'You stay in the loop. We send a checkpoint at the end of each milestone with screenshots, links, and what is next. The build is the engagement; nothing is hidden until launch.',
    },
    {
      number: '04',
      title: 'You get the keys.',
      body: 'At delivery, you receive: the admin login, the hosting account credentials in your name, the Stripe account in your name, and the source code in a Git repository you control. You operate the product without us.',
    },
    {
      number: '05',
      title: 'Ongoing support is optional.',
      body: 'If you want a retainer for ongoing work (new features, scaled support, expansion engagements), we offer one. If you want to take it from here, you take it from here. There is no lock-in either way.',
    },
  ] as readonly EngagementStep[],
} as const;

export const FO_HIW_FEAR = {
  eyebrow: 'The honest answer',
  heading: 'Do I need a developer after this?',
  paragraph1:
    "No, to operate the product. You log into the admin, manage your products, customers, content, and orders. The dashboard is the interface; you don't touch the code.",
  paragraph2:
    'Yes, to change the software itself. Adding a new feature, a new page, a new integration: that is engineering work. Two honest options:',
  options: [
    {
      title: 'Hire RevealUI Studio for the change.',
      body: 'We know the codebase; we built it. This is a scoped follow-on engagement, not a retainer.',
    },
    {
      title: 'Hire your own engineer.',
      body: 'The code we hand over is standard TypeScript on standard tools: React, Vite, Hono, Drizzle. Any competent React engineer can pick it up.',
    },
  ] as readonly { readonly title: string; readonly body: string }[],
  closing:
    'We do not pretend you become self-sufficient on the codebase. We do promise you are self-sufficient on operating the product.',
} as const;

export const FO_HIW_OWNERSHIP = {
  eyebrow: 'Ownership',
  heading: 'What ownership means at delivery.',
  intro: 'Three concrete claims, true today, not roadmap:',
  claims: [
    {
      title: 'The code is yours.',
      body: 'The open-source RevealUI runtime plus your configuration, in a Git repository you control.',
    },
    {
      title: 'The infrastructure is in your name.',
      body: 'Vercel account, Neon database, Stripe account: all registered to your business, not RevealUI Studio.',
    },
    {
      title: 'There is no vendor lock-in.',
      body: 'If you walk away from RevealUI Studio tomorrow, your product keeps running and a different engineer can pick up the codebase. No proprietary platform to migrate off.',
    },
  ] as readonly { readonly title: string; readonly body: string }[],
  differentiator:
    'This is a strong, honest differentiator from SaaS vendors who own your data and your platform.',
} as const;

export const FO_HIW_TIMELINE = {
  eyebrow: 'Timeline',
  heading: 'How long does it take?',
  paragraph1:
    'Weeks, not quarters. The discovery call gives you the range for your specific scope.',
  paragraph2:
    'We do not promise specific day-counts. The work is fixed-bid (Step 2), so the timeline is part of the scope you and we agree on in writing. What we do not do is "live in 14 days": that is a marketing promise, not an engineering reality.',
} as const;

export const FO_HIW_CLOSING = {
  heading: 'Ready to scope it?',
  body: 'Book the discovery call. 30 minutes, free. We walk through your business and decide whether we are the right team for it.',
  primaryCta: {
    label: 'Book a build call',
    href: AGENCY_CONTACT,
    external: true,
  } satisfies Cta,
  backLink: {
    label: '← Back to Services',
    href: '/services',
  } satisfies Cta,
} as const;
