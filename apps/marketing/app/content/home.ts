// Sourced from: app/components/landing/Hero.tsx, app/components/landing/Problem.tsx,
//   app/components/landing/Demo.tsx, app/components/landing/Faq.tsx,
//   app/components/GetStarted.tsx (Phase 1c extraction).
// Per the internal marketing-overhaul plan §4.4.
// 2026-07-09: homepage funnel declutter (internal marketing funnel audit). Hero
// subtitle now carries the canonical positioning sentence + foil; the "What
// ships today" grid, the audience Fork, and the Objections section moved out
// (their 3 strongest metrics live in the Proof section; the two objection
// cards became the first two FAQ items below).

import { SITE } from './site';
import type { Cta, FaqItem } from './types';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const HOME_HERO = {
  eyebrow: 'Open source. Self-hostable. Audit-ready.',
  h1: 'Run your whole business on one runtime you own.',
  subtitle: {
    foil: "If an agent did it, there's a receipt.",
    sentence1:
      'RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof.',
    sentence2: 'Every agent is a governed and audited user that lives on your infrastructure.',
    support: 'It runs on any AI provider you choose.',
  },
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'See it on GitHub', href: SITE.urls.repo, external: true } satisfies Cta,
  },
  agencyCta: {
    prefix: 'Want it built for you?',
    label: 'See services.',
    href: '/services',
  },
  agencyLicensingCta: {
    prefix: 'Building for clients?',
    label: 'See agency licensing.',
    href: '/pricing#perpetual',
  },
  cliCaption: 'Local dev stack in 60 seconds. No credit card.',
} as const;

// ---------------------------------------------------------------------------
// Hero: "Foundation" A/B variant (canonical lock).
// Per docs/marketing/06-copy-corpus.md §4.1 (sanctioned A/B variant under ADR
// 2026-06-07 decision 6, hero only): H1 reframes around "foundation"; subtitle
// inherits the default unchanged. The noun-test is the H1 only; the subtitle
// keeps the canonical "runtime" noun. Served via selectHomeHero()
// (app/lib/hero-variant.ts): the homepage hero renders this variant when the
// URL carries ?hero=foundation, else HOME_HERO. An automatic traffic split +
// conversion measurement is separate (the marketing app has no analytics sink
// yet).
// ---------------------------------------------------------------------------

export const HOME_HERO_FOUNDATION = {
  ...HOME_HERO,
  h1: 'The foundation your business runs on.',
} as const;

// Full-width thesis band: a no-card rhythm break between the Primitives and
// Local-AI sections. One bold line + a short contrast sub.
export const HOME_THESIS_BAND = {
  line: 'You bring the business. The runtime handles the rest.',
  sub: 'Not a starter kit, and not glue between five SaaS tools. One system, already wired together.',
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
  body: 'Most AI teams glue together a half-dozen SaaS backends. Some pick a thin agent framework and rebuild auth, billing, and content from scratch. RevealUI is the third option: everything wired in, governed by one policy, owned by you.',
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
      revealui: 'Built in',
    },
    {
      capability: 'CMS + admin UI',
      sprawl: 'A headless CMS, plus a team to wire it',
      agentOnly: 'Bring your own',
      revealui: 'Built in',
    },
    {
      capability: 'Stripe billing + webhooks',
      sprawl: 'Stripe + your code',
      agentOnly: 'Bring your own',
      revealui: 'Built in (with reconciliation)',
    },
    {
      capability: 'MCP tools for every API',
      sprawl: 'Per-collection plugin',
      agentOnly: 'Tool registry only',
      revealui: 'Auto-exposed, RBAC-governed',
    },
    {
      capability: 'Tamper-evident audit log',
      sprawl: 'An observability vendor, plus custom hashing',
      agentOnly: 'Logs only',
      revealui: 'Hash-chained, in DB',
    },
  ] as readonly ProblemRow[],
  footnote:
    'Capability comparison only; a monthly cost estimate lives on the pricing page. RevealUI Pro is $49/mo + your own infrastructure. Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.',
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
  heading: 'From CLI to a working stack in 90 seconds.',
  body: 'Three beats. Local in 60 seconds. Test-mode Stripe by default. Agents wired in via MCP.',
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
      body: 'Every primitive ships with a matching MCP server. Wire an LLM provider and your agents read customers, refund subscriptions, and write content through the same APIs your app uses.',
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
        'Each of those covers one slice: a real-time database, a Postgres-plus-auth backend, a session service, a jobs runner. RevealUI is the whole runtime: auth, content, billing, admin UI, and an agent layer governed by one RBAC policy and one tamper-evident audit chain. Self-hosted at every tier. (Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.)',
    },
    {
      question: 'Can I self-host?',
      answer:
        'Yes. 21 of 27 packages are MIT and stay MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infrastructure at any tier, with no vendor-specific edge runtimes and no proprietary database.',
    },
    {
      question: 'What does "agent-native" actually mean in code?',
      answer:
        'Every collection is an MCP tool AND a REST endpoint AND a typed SDK call, gated by the same RBAC + ABAC policy. Agents are first-class principals: scope one to a collection, give it a budget, watch every action sign into the audit chain, revoke when done. The runtime is the contract, not a glue layer.',
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
  heading: 'Build your business today.',
  body: 'The business logic, pre-wired. Spin up on your machine in minutes, then flip to live mode when you’re ready to charge real customers.',
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'Read the docs', href: SITE.urls.docs } satisfies Cta,
  },
  newsletter: {
    label: 'Not ready to start? Get product updates and engineering insights.',
  },
} as const;

// ---------------------------------------------------------------------------
// Three actors (cast explainer)
// Defines the three roles the rest of the copy assumes: developer, operator,
// agent. Two human roles (build, run) plus the AI role (work inside). Sits
// between the hero and the Problem section so "agents" in the hero h1 is
// defined within one scroll.
// ---------------------------------------------------------------------------

export interface Actor {
  readonly role: string;
  readonly action: string;
  readonly body: string;
}

export const HOME_ACTORS = {
  eyebrow: 'Who does what',
  heading: 'Three actors, one runtime.',
  body: 'RevealUI runs people and AI under one set of rules: the same permissions and the same tamper-evident audit trail.',
  actors: [
    {
      role: 'Developers',
      action: 'build it.',
      body: 'Install RevealUI, write the code, own the stack.',
    },
    {
      role: 'Operators',
      action: 'run it.',
      body: 'Log into the admin to manage customers, content, and billing. No code required.',
    },
    {
      role: 'Agents',
      action: 'work inside it.',
      body: 'An agent is an AI that works through the same APIs you do: read and update your data, send notifications, look up customers and billing. Every action runs under the same permissions and the same audit trail as a person.',
    },
  ] as readonly Actor[],
  tagline: 'Developers build it. Operators run it. Agents work in it.',
} as const;
