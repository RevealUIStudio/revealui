// Sourced from: app/components/landing/Hero.tsx, app/components/landing/Problem.tsx,
//   app/components/landing/Demo.tsx, app/components/landing/Faq.tsx,
//   app/components/GetStarted.tsx (Phase 1c extraction).
// Phase 3 (2026-05-18) update: Hero "What ships today" metrics now reference
// METRICS from site.ts (single source per docs/MARKETING_METRICS.md §1).
// FSL package detail references METRICS: 21 MIT + 5 FSL + 1 internal = 27 total
// (matches validator licenseSplit; counted against packages/ on 2026-06-17 —
// @revealui/tokens addition took MIT 20→21 and total 26→27).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { METRICS, SITE } from './site';
import type { Cta, FaqItem } from './types';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const HOME_HERO = {
  eyebrow: 'Open source. Self-hostable. Audit-ready.',
  h1: 'Run your whole business on one runtime you own.',
  subtitle: {
    lead: 'Stop renting your stack from a half-dozen vendors.',
    strong:
      'Auth, content, offers, and payments, pre-wired into one open-source runtime you self-host.',
    body: 'Ship one product, or stamp a branded, self-hosted copy for every client you serve. Your team and your AI agents work in it under the same permissions and the same tamper-evident audit trail. Build it yourself with',
    cliSuffix: 'or hire',
    agencyLabel: 'RevealUI Studio',
    agencyHref: SITE.urls.agency,
    agencySuffix: 'to build it for you.',
  },
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'See it on GitHub', href: SITE.urls.repo, external: true } satisfies Cta,
  },
  agencyCta: {
    prefix: 'Want it built for you?',
    label: 'RevealUI Studio builds your AI product on RevealUI →',
    href: SITE.urls.agency,
  },
  cliCaption: 'Local dev stack in 60 seconds. No credit card.',
  shipsToday: {
    heading: 'What ships today',
    items: [
      {
        metric: `${METRICS.packages} packages`,
        detail: `${METRICS.licenseSplit.mit} MIT-licensed forever + ${METRICS.licenseSplit.fsl} Fair Source (FSL-1.1-MIT, convert to MIT after 2 years) + ${METRICS.licenseSplit.internal} internal-only test workspace. Source at packages/.`,
      },
      {
        metric: `${METRICS.dbTables} database tables`,
        detail:
          'Every table maps to a primitive: people, content, offers, payments, or agents. See the [database reference](https://docs.revealui.com/database).',
      },
      {
        metric: `${METRICS.mcpServers} first-party MCP servers`,
        detail:
          'Your agents discover every primitive through one open protocol. See the [MCP reference](https://docs.revealui.com/ai).',
      },
      {
        metric: 'Pro license enforcement, signed and verified',
        detail:
          'Pro features check against your license server-side, with no manual install gates. See the [Pro reference](https://docs.revealui.com/pro).',
      },
      {
        metric: `FSL-1.1-MIT on ${METRICS.licenseSplit.fsl} Fair Source packages`,
        detail: 'Source-visible, non-compete. Auto-converts to MIT 2 years after each release.',
      },
      {
        metric: 'Same permissions. Same audit chain. Same API.',
        detail:
          'One permission model and one tamper-evident chain, for your team and your agents alike. See the [architecture](https://docs.revealui.com/architecture).',
      },
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Hero — "Foundation" A/B variant (canonical lock).
// Per docs/marketing/06-copy-corpus.md §4.1 (sanctioned A/B variant under ADR
// 2026-06-07 decision 6, hero only): H1 reframes around "foundation"; subtitle
// inherits the default unchanged. The noun-test is the H1 only — the subtitle
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

// Full-width thesis band — a no-card rhythm break between the Primitives and
// What's-shipped grids. One bold line + a short contrast sub.
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
    {
      capability: 'Cost (5 devs, mid-startup)',
      sprawl: '~$320 to $700+ / mo',
      agentOnly: '~$300 / mo + infra',
      revealui: '$49 / mo + infra',
    },
  ] as readonly ProblemRow[],
  footnote:
    'Sprawl prices reflect typical mid-startup invoices. RevealUI Pro is $49/mo + your own infrastructure. Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.',
} as const;

// ---------------------------------------------------------------------------
// Objections (surfaced high: the two questions skeptical engineers ask first)
// Concise answers to the two hardest objections (lock-in, production-readiness),
// promoted above the FAQ so a skeptic gets them without scrolling. Full detail
// lives in HOME_FAQ + PROOF_*; the cards link onward to #faq.
// ---------------------------------------------------------------------------

export const HOME_OBJECTIONS = {
  eyebrow: 'Before you ask',
  heading: 'The two questions every engineer asks first.',
  cards: [
    {
      heading: 'Will I get locked in?',
      body: 'No. Open standards end-to-end: OAuth, JWT, Stripe webhooks, MCP, OpenAPI, and plain Postgres. Deploy anywhere Node runs, and take your data, your code, and your infra with you. RevealUI is the runtime, not the prison.',
    },
    {
      heading: 'Is it production-ready?',
      body: 'Every PR clears a 3-phase gate before it lands: Biome, Vitest unit and integration, Playwright E2E, CodeQL, and Gitleaks. This site and the agency site at revealuistudio.com both run on RevealUI in production.',
    },
  ],
  cta: { label: 'See all the questions →', href: '#faq' },
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
// ---------------------------------------------------------------------------

export const HOME_FAQ = {
  eyebrow: 'FAQ',
  heading: 'Common questions.',
  items: [
    {
      question:
        'How is this different from stitching together separate auth, database, CMS, and background-job services?',
      answer:
        'Each of those covers one slice: a real-time database, a Postgres-plus-auth backend, a session service, a jobs runner. RevealUI is the whole runtime: auth, content, billing, admin UI, and an agent layer governed by one RBAC policy and one tamper-evident audit chain. Self-hosted at every tier. (Vercel, Cloudflare, and Fly are deploy targets, not competitors. RevealUI runs on all three.)',
    },
    {
      question: 'Can I self-host?',
      answer:
        'Yes. 21 of 27 packages are MIT and stay MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infra at any tier, with no vendor-specific edge runtimes and no proprietary database.',
    },
    {
      question: 'What does "agent-native" actually mean in code?',
      answer:
        'Every collection is an MCP tool AND a REST endpoint AND a typed SDK call, gated by the same RBAC + ABAC policy. Agents are first-class principals: scope one to a collection, give it a budget, watch every action sign into the audit chain, revoke when done. The runtime is the contract, not a glue layer.',
    },
    {
      question: "What's the lock-in story?",
      answer:
        'Open standards, end-to-end. OAuth, JWT, Stripe webhooks, MCP, OpenAPI. Postgres for data. Deploy anywhere Node runs: Vercel, Cloudflare, Fly, Hetzner, your own metal. Your data, your code, your infra. RevealUI is the runtime, not the prison.',
    },
    {
      question: 'Production-ready?',
      answer:
        'Behind a 3-phase CI gate: Biome lint, Vitest unit + integration, Playwright E2E, CodeQL, Gitleaks, claim-drift validator. Every PR runs the gate before it can land. The marketing site you are reading runs on @revealui/router and @revealui/presentation; the agency site at revealuistudio.com runs on the same packages. View the source on GitHub.',
    },
    {
      question: "What's the rest of RevFleet?",
      answer:
        'RevFleet is the umbrella. RevealUI is the runtime. RevVault encrypts secrets (CLI MIT, desktop Pro). RevDev is the engineering harness (multi-agent coordination across Claude / Cursor / Copilot). RevCon syncs editor configs. RevSkills is the skills library. RevForge is the operator-side stamping tool that produces white-label trial kits. RevKit is the portable WSL dev environment. Use RevealUI standalone, or compose what you need.',
    },
    {
      question: 'How does AI inference work?',
      answer:
        'Pair RevealUI with Ollama or Ubuntu Inference Snaps. Bring Gemma 4 or Phi-4-mini locally, so your bill does not scale with usage. Switch to Claude, GPT, or any provider in one config line. The runtime is provider-agnostic; the default is sovereignty-friendly.',
    },
    {
      question: 'How do agent payments work?',
      answer:
        "x402-native. RevealUI implements the HTTP 402 payment protocol, compatible with Amazon Bedrock AgentCore Payments, Coinbase, and Cloudflare's x402 Foundation. Agents pay agents over standard HTTP. The protocol is the load-bearing piece; the agent-payment rails are in development.",
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
// between the hero and the audience fork so "agents" in the hero h1 is defined
// within one scroll, before the visitor self-identifies in the fork below.
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

// ---------------------------------------------------------------------------
// Homepage audience fork
// Per spec-2026-05-14-non-technical-lane.md §4.3 (Phase 2 of the spec sequence).
// Two technical-lane branches; visitor self-identifies before the technical-lane
// content below. Branch A scrolls past the fork into the existing technical
// homepage (OQ-5 locked); Branch C routes studios/agencies to the Agency
// Perpetual pricing band. The former Branch B ("I want it built for me") was
// removed when the audience toggle landed: "built for me" is now the
// non-technical mode itself (the in-hero Technical/Non-technical switch).
// Decisions consumed: §9.4 OQ-5 (Branch A stays on /).
// ---------------------------------------------------------------------------

export const HOME_FORK = {
  branchA: {
    title: "I'm building this myself.",
    body: 'Source, packages, the CLI, and docs. Read on.',
    cta: 'Keep reading →',
  },
  branchC: {
    title: 'I build software for my clients.',
    body: 'License once, then ship a branded, self-hosted instance for every client you serve.',
    cta: 'See agency licensing →',
    href: '/pricing#perpetual',
  },
} as const;
