// Sourced from: app/components/landing/Hero.tsx, app/components/landing/Problem.tsx,
//   app/components/landing/Demo.tsx, app/components/landing/Faq.tsx,
//   app/components/GetStarted.tsx (Phase 1c extraction).
// Phase 3 (2026-05-18) update: Hero "What ships today" metrics now reference
// METRICS from site.ts (single source per docs/MARKETING_METRICS.md §1).
// FSL package detail rewritten: now states 20 MIT + 5 FSL + 1 internal = 26 total
// (matches validator licenseSplit; original copy's "21 published + 5 private" math
// counted 26 by including create-revealui in the 21 — drift caught Phase 3.4).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { METRICS, SITE } from './site';
import type { Cta, FaqItem } from './types';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const HOME_HERO = {
  eyebrow: 'Open-source. Self-hostable. Audit-grade.',
  h1: 'The open runtime for AI-native businesses.',
  subtitle: {
    strong: 'Yours to install. Ours to build for you.',
    body: 'Auth, content, products, payments, and intelligence — five primitives, one policy plane, one hash-chained audit log. For founders shipping AI products who need audit trails and unified governance from day one — whether you build with',
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
    label: 'RevealUI Studio builds AI businesses on RevealUI →',
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
        detail: 'Drizzle ORM over NeonDB across 5 schemas. Source at packages/db/src/schema/.',
      },
      {
        metric: `${METRICS.mcpServers} first-party MCP servers`,
        detail: 'Every one stdio-launchable. Source at packages/mcp/src/servers/.',
      },
      {
        metric: 'EdDSA-signed Pro license JWTs',
        detail:
          'Verified every 5 minutes against the license server. Source at packages/core/src/license.ts.',
      },
      {
        metric: `FSL-1.1-MIT on ${METRICS.licenseSplit.fsl} Fair Source packages`,
        detail: 'Source-visible, non-compete. Auto-converts to MIT 2 years after each release.',
      },
      {
        metric: 'Vite + Hono + ElectricSQL browser sync',
        detail: 'No Next.js, no community router, no Supabase in the production path.',
      },
    ],
  },
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
      sprawl: 'Clerk Pro ($25/seat)',
      agentOnly: 'Bring your own',
      revealui: 'Built in',
    },
    {
      capability: 'CMS + admin UI',
      sprawl: 'Payload + your team',
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
      sprawl: 'Datadog + custom hashing',
      agentOnly: 'Logs only',
      revealui: 'Hash-chained, in DB',
    },
    {
      capability: 'Cost (5 devs, mid-startup)',
      sprawl: '~$1,200 / mo',
      agentOnly: '~$300 / mo + infra',
      revealui: '$49 / mo + infra',
    },
  ] as readonly ProblemRow[],
  footnote:
    'Sprawl prices reflect typical mid-startup invoices. RevealUI Pro is $49/mo + your own infrastructure. Vercel and Cloudflare are deploy targets, not competitors — RevealUI runs on both.',
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
      question: 'How is this different from Supabase, Convex, Clerk, or Trigger?',
      answer:
        'Convex gives you real-time DB + functions. Supabase gives you Postgres + auth. Clerk gives you sessions. Trigger runs background jobs. Each one is a slice. RevealUI is the whole runtime — auth, content, billing, admin UI, and an agent layer governed by one RBAC policy and one tamper-evident audit chain. Self-hosted at every tier. (Vercel and Cloudflare are deploy targets, not competitors — RevealUI runs on both.)',
    },
    {
      question: 'Can I self-host?',
      answer:
        'Yes. 21 of 26 packages are MIT and stay MIT — forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and auto-convert to MIT two years after each release. Self-host the entire stack on your own infra at any tier — no vendor-specific edge runtimes, no proprietary database.',
    },
    {
      question: 'What does "agent-native" actually mean in code?',
      answer:
        'Every collection is an MCP tool AND a REST endpoint AND a typed SDK call — gated by the same RBAC + ABAC policy. Agents are first-class principals: scope one to a collection, give it a budget, watch every action sign into the audit chain, revoke when done. The runtime is the contract, not a glue layer.',
    },
    {
      question: "What's the lock-in story?",
      answer:
        'Open standards, end-to-end. OAuth, JWT, Stripe webhooks, MCP, OpenAPI. Postgres for data. Deploy anywhere Next.js and Hono run — Vercel, Cloudflare, Railway, Hetzner, your own metal. Your data, your code, your infra. RevealUI is the runtime, not the prison.',
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
        'Bring your own model. Default ships open-weight (Llama 4, Gemma 3, Qwen 3, DeepSeek R1) via Ollama or Ubuntu Inference Snaps — your bill does not scale with usage. Switch to Claude, GPT, or any provider in one config line. The runtime is provider-agnostic; the default is sovereignty-friendly.',
    },
    {
      question: 'How do agent payments work?',
      answer:
        "x402-native. RevealUI implements the HTTP 402 payment protocol — compatible with Amazon Bedrock AgentCore Payments, Coinbase, and Cloudflare's x402 Foundation. Agents pay agents over standard HTTP. The protocol is the load-bearing piece; the agent-payment rails are in development.",
    },
  ] as readonly FaqItem[],
} as const;

// ---------------------------------------------------------------------------
// GetStarted CTA
// ---------------------------------------------------------------------------

export const HOME_GET_STARTED = {
  heading: 'Ready to build?',
  body: 'Users, content, products, payments, and AI, pre-wired. Start building locally in minutes; flip to live mode when you are ready.',
  cta: {
    primary: { label: 'Start free', href: SITE.urls.signup } satisfies Cta,
    secondary: { label: 'Read the docs', href: SITE.urls.docs } satisfies Cta,
  },
  newsletter: {
    label: 'Not ready to start? Get product updates and engineering insights.',
  },
} as const;
