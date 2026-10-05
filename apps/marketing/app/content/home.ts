// Surface status: HOME_HERO variants and HOME_BENEFITS are rendered on `/`.
// HOME_GET_STARTED.cli is rendered by Hero. Other HOME_* sections are retained
// CMS seed/component copy, not mounted by HomePage. See apps/marketing/README.md.
// Sourced from: app/components/landing/Hero.tsx, app/components/landing/Problem.tsx,
//   app/components/landing/Demo.tsx, app/components/landing/Faq.tsx,
//   app/components/GetStarted.tsx (Phase 1c extraction).
// Per the internal marketing-overhaul plan §4.4.
// 2026-07-09: homepage funnel declutter (internal marketing funnel audit). Hero
// subtitle carries the canonical positioning sentences; receipt foil lives on
// the ReceiptCard. The "What ships today" grid, audience Fork, and Objections
// section moved out (metrics in Proof; objections in FAQ).
// 2026-07-23: hero subtitle restored to the full 2026-07-09 locked form
// (sentence1 + sentence2 + support). Foil stays on ReceiptCard.
// 2026-07-10: frontend-excellence Phase 1 (11->7 section cut, ADR
// 2026-07-10-frontend-design-direction). HOME_ACTORS and HOME_THESIS_BAND
// removed (thin vocabulary/pull-quote content, no longer rendered anywhere);
// HOME_HERO's agency CTAs moved to the footer, its CLI block moved into
// HOME_GET_STARTED.cli.
// 2026-07-12: messaging rewrite (frontend-excellence Phase 1b spec in .jv).
// Every prose sentence in this file is indexed in ./claims-evidence.ts with
// the code that proves it (owner directive); the collections-over-MCP claims
// reflect default-on resources (mcpResource !== false; opt out with false).
// 2026-09-15: Brand LOCK — known-for is the agentic business runtime
// startups operate on their own domain (H1 drafts #2 + #5). Receipts,
// catalog honesty, and powerful + safe stay in the subtitle, not the H1.

import { SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';
import { SITE } from './site';
import type { Cta, FaqItem } from './types';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const HOME_HERO = {
  eyebrow: 'Self-hostable. Source available.',
  // Brand LOCK 2026-09-15: known-for H1 (#2 operate on their domain).
  // Public word PROOF = receipted action lives in the subtitle (not
  // "outcome validation", not "proof of work"). Catalog honesty stays here.
  h1: 'Build your business on software you can run yourself.',
  subtitle: {
    sentence1:
      'RevealUI brings People, Content, Offers, Payments, and Agents into one self-hosted runtime.',
    sentence2:
      'Start with the MIT-licensed core. Add Pro for agent tools, memory, and MCP integrations.',
    support:
      'Use accounts and infrastructure you control. Hosting, database services, and model usage are separate costs.',
  },
  cta: {
    primary: { label: 'Create a RevealUI account', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'Inspect the source', href: SITE.urls.repo, external: true } satisfies Cta,
  },
} as const;

// Trust strip under the hero (sm+). Short chrome; the matching claims live
// on HOME_HERO.eyebrow and the proof cards.
export const HOME_TRUST_SIGNALS = [
  'MIT core',
  'Self-hostable',
  'Supported local inference',
] as const;

// ---------------------------------------------------------------------------
// Hero query previews. Scoped claims adopted 2026-10-04; all share the default
// setup, license, and cost disclosures. Served via selectHomeHero().
// ---------------------------------------------------------------------------

export const HOME_HERO_FOUNDATION = {
  ...HOME_HERO,
  h1: 'Build on shared business primitives with supported integrations.',
} as const;

// Ownership preview via ?hero=ownership. Same disclosures as HOME_HERO.
export const HOME_HERO_OWNERSHIP = {
  ...HOME_HERO,
  h1: 'Run your business software on infrastructure you control.',
} as const;

// Agent configuration preview via ?hero=l2, without automatic traffic split.
export const HOME_HERO_L2 = {
  ...HOME_HERO,
  h1: 'Configure agents for the business data and permissions you choose.',
} as const;

// ---------------------------------------------------------------------------
// Problem (three-path comparison — not a table)
// Craft pass 2026-08: desktop spreadsheet + mobile capability cards replaced
// with three equal paths. Row claims stay for claims-evidence export paths.
// ---------------------------------------------------------------------------

export interface ProblemRow {
  readonly capability: string;
  readonly sprawl: string;
  readonly agentOnly: string;
  readonly revealui: string;
}

export const HOME_PROBLEM = {
  eyebrow: 'The problem',
  heading: 'Choose how to build your business runtime.',
  // Hybrid: body states the fork once; matrix carries capability detail.
  // pathBlurbs removed (de-dupe) so we do not restate the three paths twice.
  body: 'Compare a shared runtime with connecting separate services or adding business features to an agent framework. Configure and maintain the services you choose.',
  /** Accessible name for the three-path comparison region. */
  tableAriaLabel: 'Vendor sprawl vs agent-framework vs RevealUI comparison',
  columns: {
    capability: 'Capability',
    sprawl: 'Vendor sprawl',
    agentOnly: 'Agent framework only',
    revealui: 'RevealUI',
  },
  rows: [
    {
      capability: 'Sign-in and permissions',
      sprawl: 'Configure an authentication service',
      agentOnly: 'Bring your own',
      revealui: 'Sign-in, roles, and policies built in',
    },
    {
      capability: 'Content and admin',
      sprawl: 'Connect a content service and admin interface',
      agentOnly: 'Bring your own',
      revealui: 'Your content model, with admin UI and API',
    },
    {
      capability: 'Billing',
      sprawl: 'Integrate Stripe checkout and webhooks',
      agentOnly: 'Bring your own',
      revealui: 'Test-mode checkout, subscriptions, and webhook handling',
    },
    {
      capability: 'Agents on your data',
      sprawl: 'Connect tools and permissions to each service',
      agentOnly: 'Configure tools and business access',
      revealui: 'Supported agent tools use configured API permissions and plan limits',
    },
  ] as readonly ProblemRow[],
  footnote: `Capability only. Pricing is on the pricing page (Pro ${SUBSCRIPTION_PRICE_FALLBACKS.pro.price}/mo + your infrastructure). Vercel, Cloudflare, and Fly are deploy targets, not competitors.`,
} as const;

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export interface DemoBeat {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

export const HOME_DEMO = {
  eyebrow: 'See a local stack',
  heading: 'Install locally. Test checkout. Point an agent at the same data.',
  body: 'Create a local project, configure its services, and test a supported workflow. Agent tools require Pro and a configured model provider.',
  // Honest: ProductFrame is live presentation components, not a screenshot.
  // Install path stays in the three beats (create-revealui).
  mockupCaption: {
    // ≥26-char prose units so claims-evidence indexes them (floor in gate).
    prefix: 'Example admin interface built with',
    code: '@revealui/presentation',
    suffix: 'components. The three beats are the local install path.',
  },
  beats: [
    {
      n: '01',
      title: 'Install locally.',
      body: 'Create a local project, then configure the database, authentication, and services your template needs.',
    },
    {
      n: '02',
      title: 'Run a test checkout.',
      body: 'Configure Stripe test credentials and webhooks, then test sign-up and checkout. Configure live credentials before accepting real payments.',
    },
    {
      n: '03',
      title: 'Point an agent at the same data.',
      body: 'With Pro, configure a supported model provider and agent tools. Use the content API under the configured permissions and plan limits.',
    },
  ] as readonly DemoBeat[],
} as const;

// ---------------------------------------------------------------------------
// FAQ
// The first two items are the merged former-Objections cards (the two
// questions skeptical engineers ask first, surfaced at the top of the FAQ
// rather than in their own pre-FAQ section). Their answers replace the
// near-duplicate lock-in / production-ready entries that used to live further
// down this list, so each claim appears once.
// ---------------------------------------------------------------------------

export const HOME_FAQ = {
  eyebrow: 'FAQ',
  heading: 'Questions',
  items: [
    {
      question: 'Will I get locked in?',
      answer:
        'Use your own repository, database, and hosting accounts. The core uses MIT; Pro packages follow their published license terms and require license validation. Integrations have their own dependencies.',
    },
    {
      question: 'Is it production-ready?',
      answer:
        'Used in production by the team that maintains it. Automated tests and security checks cover defined properties; review the source and validate your own deployment before launch.',
    },
    {
      question: 'How is this different from stitching separate tools together?',
      answer:
        'RevealUI shares People, Content, Offers, Payments, and Agents across one self-hosted runtime. Configure the services and integrations you need; paid agent features require the appropriate license.',
    },
    {
      question: 'Can I self-host?',
      answer:
        'Yes. The core uses MIT; Pro packages use FSL-1.1-MIT and follow their published conversion terms. You operate the infrastructure. Paid features require the appropriate license and configuration; read the Fair Source guide for details.',
    },
    {
      question: 'What does agent-native mean for my product?',
      answer:
        'Supported agent tools access your content through the configured API permissions and plan limits. Configure the agent identity, credentials, and model provider for your deployment.',
    },
    {
      question: 'How does AI inference work?',
      answer:
        'Configure a supported local runner or hosted provider. Local inference needs suitable hardware; hosted providers process the requests you send and charge for usage. Read the local-first guide for setup.',
    },
    {
      question: 'How do agent payments work?',
      answer:
        'RevealUI includes an HTTP 402 (x402) payment rail so agents can pay over standard HTTP when an operator turns it on. The rail ships in the code and stays off by default (X402_ENABLED off). It is not a live payments product today. See the agents section on the pricing page for current status.',
    },
  ] as readonly FaqItem[],
} as const;

// ---------------------------------------------------------------------------
// GetStarted CTA
// ---------------------------------------------------------------------------

export const HOME_GET_STARTED = {
  heading: 'Start on your machine today.',
  body: 'Create a local app with npx create-revealui@latest or a public GitHub template. Configure the services your template needs before testing your workflow. The Apify actor is a separate pay-per-event agent run, not an app installer.',
  cta: {
    primary: { label: 'Create a RevealUI account', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'Read the docs', href: SITE.urls.docs } satisfies Cta,
  },
  // CLI quick-start, moved here from the hero (frontend-excellence Phase 1
  // hero declutter): a fresh stack in one command belongs next to the closing
  // CTA, not competing with the hero's primary/secondary buttons.
  cli: {
    command: ['npx', 'create-revealui@latest', 'my-app'],
    caption: 'Create a RevealUI app locally.',
  },
  newsletter: {
    label: 'Not ready to start? Get product updates when they ship.',
  },
} as const;

// Buyer benefits adopted from the September 30 public-copy assessment.
export const HOME_BENEFITS = [
  {
    title: 'Keep a foundation you can reuse.',
    body: 'RevealFleet is the family of software behind RevealUI and the tools we use to build and operate it. The MIT core can be used in another app; paid runtime features follow your license limits.',
  },
  {
    title: 'Choose where inference runs.',
    body: 'Configure a supported local runner or hosted provider. Local inference needs suitable hardware; hosted providers process the model requests you send them.',
  },
  {
    title: 'Inspect supported agent activity.',
    body: 'When audit signing is configured, supported actions leave signed records. Pro adds downloadable Merkle roots and inclusion proofs. A record helps you investigate an action; it does not prove the business outcome was correct.',
  },
] as const;
