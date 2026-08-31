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
// 2026-08-09: proof-grade + allure pass. Outcome language on problem/demo/FAQ/
// get-started; locked positioning subtitle and L1 H1 unchanged. Technical
// depth points at docs / local-ai / pricing rather than dumping stack lists.

import { SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';
import { SITE } from './site';
import type { Cta, FaqItem } from './types';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const HOME_HERO = {
  eyebrow: 'Open source. Self-hostable.',
  // Owner ruling 2026-07-29: L1 H1. Subtitle is locked positioning form
  // (copy-voice + ADR 2026-07-09). 2026-08-02: re-armed after GAP-355 close
  // (stages 0–6 on test/main; prod GET /api/audit/public-key 200; S6-6 owner
  // ruling option b). Receipt foil is NOT in the subtitle; it is RECEIPT_HERO_CAPTION.
  h1: 'Build it once. Every product after starts ahead.',
  subtitle: {
    sentence1:
      'RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof.',
    sentence2: 'Every agent is a governed and audited user that lives on your infrastructure.',
    support: 'It runs on any AI provider you choose.',
  },
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'See it on GitHub', href: SITE.urls.repo, external: true } satisfies Cta,
  },
} as const;

// Trust strip under the hero (sm+). Short chrome; the matching claims live
// on HOME_HERO.eyebrow and the proof cards.
export const HOME_TRUST_SIGNALS = ['Open source', 'Self-hostable', 'Local-first AI'] as const;

// ---------------------------------------------------------------------------
// Hero: "Foundation" A/B variant (canonical lock).
// Per docs/marketing/06-copy-corpus.md §4.1 (sanctioned A/B under ADR
// 2026-06-07 decision 6, hero only): H1 reframes around "foundation"; subtitle
// inherits the default unchanged. Served via selectHomeHero() when the URL
// carries ?hero=foundation, else HOME_HERO.
// ---------------------------------------------------------------------------

export const HOME_HERO_FOUNDATION = {
  ...HOME_HERO,
  h1: 'The foundation your business runs on.',
} as const;

// Prior default H1, retained for rollback preview via ?hero=ownership
// (not automatic traffic). Same subtitle as HOME_HERO.
export const HOME_HERO_OWNERSHIP = {
  ...HOME_HERO,
  h1: 'Run your whole business on one runtime you own.',
} as const;

// Corpus L2 leverage-frame A/B (06-copy-corpus.md §4.1). Owner go 2026-07-31:
// enable via ?hero=l2 only — not default traffic. Measurement still needs an
// analytics sink (same note as foundation/ownership).
export const HOME_HERO_L2 = {
  ...HOME_HERO,
  h1: 'Ship your next product on the work your last one finished.',
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
  heading: 'Tired of tools that don’t talk — and agents you can’t audit?',
  // Hybrid: body states the fork once; matrix carries capability detail.
  // pathBlurbs removed (de-dupe) so we do not restate the three paths twice.
  body: 'Teams either stitch a vendor for each slice, or start with agents and rebuild the rest. RevealUI is one self-hosted runtime for the business and the agents that run it.',
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
      sprawl: 'A separate auth product, priced per seat',
      agentOnly: 'Bring your own',
      revealui: 'Sign-in, roles, and policies built in',
    },
    {
      capability: 'Content and admin',
      sprawl: 'A CMS plus a team to wire it',
      agentOnly: 'Bring your own',
      revealui: 'Your content model, with admin UI and API',
    },
    {
      capability: 'Billing',
      sprawl: 'Stripe + your glue',
      agentOnly: 'Bring your own',
      revealui: 'Test-mode checkout, subscriptions, and webhook handling',
    },
    {
      capability: 'Agents on your data',
      sprawl: 'One-off integrations',
      agentOnly: 'Tool registry only',
      revealui: 'Agents use the same data and gates as your team',
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
  eyebrow: 'Watch it work',
  heading: 'From one command to a running stack in about a minute.',
  body: 'Install on your machine. Take a test payment. Connect an agent to the same data your admin already uses.',
  // Honest: ProductFrame is live presentation components, not a screenshot.
  // Install path stays in the three beats (create-revealui).
  mockupCaption: {
    // ≥26-char prose units so claims-evidence indexes them (floor in gate).
    prefix: 'Live admin chrome composed from',
    code: '@revealui/presentation',
    suffix: 'components. The three beats are the local install path.',
  },
  beats: [
    {
      n: '01',
      title: 'Spin up a stack.',
      body: 'One command. Sign-in, content, admin, billing, and agent tooling run locally.',
    },
    {
      n: '02',
      title: 'Customer flow, end to end.',
      body: 'A user signs up, picks a plan, and test-mode checkout completes. Switch to live mode when you take real money.',
    },
    {
      n: '03',
      title: 'Agents on your data.',
      body: 'Connect a model. Agents use the same content, sign-in, and plan rules as your team.',
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
  heading: 'Common questions.',
  items: [
    {
      question: 'Will I get locked in?',
      answer:
        'No. You keep your data in plain Postgres, your code in your repo, and your deploy on infrastructure you choose. Open standards throughout. RevealUI is the runtime, not the prison. Details live in the docs.',
    },
    {
      question: 'Is it production-ready?',
      answer:
        'Changes clear automated tests and security checks before they land. This site and the agency site at revealuistudio.com both run on RevealUI in production today.',
    },
    {
      question: 'How is this different from stitching separate tools together?',
      answer:
        'Each vendor covers one slice. RevealUI is the whole runtime: people, content, billing, admin, and agents, self-hosted at all tiers. Deploy targets such as Vercel, Cloudflare, and Fly are places it runs, not competitors.',
    },
    {
      question: 'Can I self-host?',
      answer:
        'Yes. Most packages are MIT forever. A small Pro set is Fair Source and converts to MIT two years after each release. Self-host the full stack on your infrastructure at any tier. License detail is on the Fair Source page.',
    },
    {
      question: 'What does agent-native mean for my product?',
      answer:
        'Agents sign in like users and face the same plan rules. They work on your content through the same APIs your app uses. How the wire protocol works is covered in the docs.',
    },
    {
      question: 'How does AI inference work?',
      answer:
        'By default, agents run on an open-weight model on infrastructure you own. Add Claude, GPT, or another provider when you choose. The local AI page walks through the full path.',
    },
    {
      question: 'How do agent payments work?',
      answer:
        'RevealUI speaks the HTTP 402 payment protocol so agents can pay over standard HTTP. Payment rails are still in development. See the agents section on the pricing page for current status.',
    },
  ] as readonly FaqItem[],
} as const;

// ---------------------------------------------------------------------------
// GetStarted CTA
// ---------------------------------------------------------------------------

export const HOME_GET_STARTED = {
  heading: 'Start on your machine today.',
  body: 'Install free. Open the admin UI. Go live when you are ready to charge customers.',
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'Read the docs', href: SITE.urls.docs } satisfies Cta,
  },
  // CLI quick-start, moved here from the hero (frontend-excellence Phase 1
  // hero declutter): a fresh stack in one command belongs next to the closing
  // CTA, not competing with the hero's primary/secondary buttons.
  cli: {
    command: ['npx', 'create-revealui@latest', 'my-app'],
    caption: 'Local stack in about a minute. No credit card.',
  },
  newsletter: {
    label: 'Not ready to start? Get product updates when they ship.',
  },
} as const;
