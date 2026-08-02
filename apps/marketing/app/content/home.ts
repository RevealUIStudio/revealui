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
// Problem (comparison table)
// ---------------------------------------------------------------------------

export interface ProblemRow {
  readonly capability: string;
  readonly sprawl: string;
  readonly agentOnly: string;
  readonly revealui: string;
}

export const HOME_PROBLEM = {
  eyebrow: 'The problem',
  heading: 'Vendor sprawl, or framework-only. Pick neither.',
  body: 'You either glue together an auth vendor, a headless CMS, Stripe code, and a job runner, or you pick an agent framework and rebuild all four underneath it. RevealUI is the third option: the whole set arrives wired into one runtime that you own.',
  tableAriaLabel: 'Vendor sprawl vs agent-framework vs RevealUI comparison',
  columns: {
    capability: 'Capability',
    sprawl: 'Vendor sprawl',
    agentOnly: 'Agent framework only',
    revealui: 'RevealUI',
  },
  rows: [
    {
      capability: 'Auth + RBAC + sessions',
      sprawl: 'A separate auth vendor, per seat',
      agentOnly: 'Bring your own',
      revealui: 'Sessions with RBAC and ABAC, built in',
    },
    {
      capability: 'CMS + admin UI',
      sprawl: 'A headless CMS, plus a team to wire it',
      agentOnly: 'Bring your own',
      revealui: 'Collections with an admin UI and REST API',
    },
    {
      capability: 'Stripe billing + webhooks',
      sprawl: 'Stripe + your code',
      agentOnly: 'Bring your own',
      revealui: 'Checkout, webhooks, and reconciliation crons',
    },
    {
      capability: 'Agent access to your data',
      sprawl: 'One-off integrations',
      agentOnly: 'Tool registry only',
      revealui: 'Content tools over MCP; collections surface as resources unless you opt out',
    },
  ] as readonly ProblemRow[],
  footnote: `Capability comparison only; a monthly cost estimate lives on the pricing page. RevealUI Pro is ${SUBSCRIPTION_PRICE_FALLBACKS.pro.price}/mo + your own infrastructure. Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.`,
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
  heading: 'From one command to a working stack in 60 seconds.',
  body: 'The stack runs locally in 60 seconds, Stripe starts in test mode, and agents connect over MCP.',
  mockupCaption: {
    prefix: 'Local screenshot from a fresh',
    code: 'npx create-revealui',
    suffix: '. The three beats below describe the steps.',
  },
  beats: [
    {
      n: '01',
      title: 'Spin up a stack.',
      body: 'One command. Auth, content, admin UI, the Stripe webhook handler, and MCP server scaffolding all running locally in 60 seconds.',
    },
    {
      n: '02',
      title: 'Customer flow, end to end.',
      body: 'A user signs up, picks a plan, and Stripe test-mode checkout completes. The admin UI shows the new account. Switch to live mode when you are ready to take real money.',
    },
    {
      n: '03',
      title: 'Agent-native, by default.',
      body: 'Wire an LLM provider and your agents read your sites, users, and content over MCP, with every call passing the same auth and tier gates your human users pass.',
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
        'No. Open standards end-to-end: OAuth, JWT, Stripe webhooks, MCP, and OpenAPI, over plain Postgres. Deploy anywhere Node runs, and take your data, your code, and your infrastructure with you. RevealUI is the runtime, not the prison.',
    },
    {
      question: 'Is it production-ready?',
      answer:
        'Every PR clears a 3-phase gate before it lands: Biome, Vitest unit and integration tests, Playwright end-to-end tests, CodeQL, and Gitleaks. This site and the agency site at revealuistudio.com both run on RevealUI in production.',
    },
    {
      question:
        'How is this different from stitching together separate auth, database, CMS, and background-job services?',
      answer:
        'Each of those covers one slice: a real-time database, a Postgres-plus-auth backend, a session service, a jobs runner. RevealUI is the whole runtime: auth, content, billing, admin UI, and an agent layer, self-hosted at every tier. (Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.)',
    },
    {
      question: 'Can I self-host?',
      answer:
        'Yes. 24 of 31 packages are MIT and stay MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infrastructure at any tier, with no vendor-specific edge runtimes and no proprietary database.',
    },
    {
      question: 'What does "agent-native" actually mean in code?',
      answer:
        'Agents authenticate like users and pass the same tier gates your customers pass. The content MCP server ships discovery and read tools, collections surface as discoverable MCP resources by default (set mcpResource: false to opt out), and writes go through the same REST API your app uses.',
    },
    {
      question: 'How does AI inference work?',
      answer:
        'Agents run on an open-weight model on your own infrastructure by default, with Claude, GPT, or any other provider one config line away. See the local AI docs at revealui.com/local-ai for the full pathway.',
    },
    {
      question: 'How do agent payments work?',
      answer:
        'RevealUI implements the HTTP 402 payment protocol so agents can pay each other over standard HTTP, with the payment rails still in development. See the agents section of the pricing page for the current status.',
    },
  ] as readonly FaqItem[],
} as const;

// ---------------------------------------------------------------------------
// GetStarted CTA
// ---------------------------------------------------------------------------

export const HOME_GET_STARTED = {
  heading: 'Your stack is one command away.',
  body: 'Spin it up on your machine in minutes. Flip to live mode when you are ready to charge real customers.',
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'Read the docs', href: SITE.urls.docs } satisfies Cta,
  },
  // CLI quick-start, moved here from the hero (frontend-excellence Phase 1
  // hero declutter): a fresh stack in one command belongs next to the closing
  // CTA, not competing with the hero's primary/secondary buttons.
  cli: {
    command: ['npx', 'create-revealui@latest', 'my-app'],
    caption: 'Local dev stack in 60 seconds. No credit card.',
  },
  newsletter: {
    label: 'Not ready to start? Get product updates and engineering insights.',
  },
} as const;
