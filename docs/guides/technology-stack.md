---
visibility: public
status: verified
title: "Technology Stack"
description: "Canonical reference for the libraries, frameworks, and services @revealui/* uses today — with rationale for each choice"
category: guide
audience: developer
---

RevealUI is a framework, not a stack. The five primitives (people, content, offers, payments, agents) are the contract; `@revealui/*` packages are one implementation of that contract. This page documents the libraries that implementation uses today, with one-line rationale for each choice. Future implementations could carry the same primitives on different code.

## Apps

| App | Port | Framework | Why |
|---|---|---|---|
| `apps/server` | 3004 | Hono | Type-safe routes via `@revealui/openapi`; runs on Node or any Hono-compatible runtime; deploys to Vercel functions or Fly. |
| `apps/admin` | 4000 | Next.js 16 | RSC, Turbopack, mature plugin ecosystem for the admin engine. Migration to `@revealui/router` + Vite is in flight per internal admin-platform ADR. |
| `apps/docs` | 3002 | Vite + `@revealui/router` | Documentation site (docs.revealui.com) — static-heavy, no SSR overhead, no vendor lock. |
| `apps/marketing` | 3000 | Vite + `@revealui/router` | Customer-facing site (revealui.com) — same justification as docs. |

## Data layer

| Choice | Role | Why |
|---|---|---|
| **NeonDB** (Postgres) | Primary database — 104 tables across the five primitives | Serverless Postgres; pgvector supported; any standard Postgres works as a substitute (the agnosticism principle is a contract, not a coupling). |
| **Drizzle ORM** | Schema definition + type-safe queries | Schema-first, accurate types, no runtime overhead, no proprietary query DSL. |
| **Cloudflare R2** | Canonical object-storage backend | S3-compatible, no egress fees. The legacy Vercel Blob backend was retired. |
| **ElectricSQL** (optional) | Real-time browser sync layer | Off by default. When enabled, syncs Postgres tables to a local PGlite store in the browser for offline-capable UIs. |

## Frontend

| Choice | Role | Why |
|---|---|---|
| **React 19** | UI runtime across all apps | Stable React; Server Components in admin, plain CSR in customer-facing apps. |
| **`@revealui/router`** | First-party file-based router | Owns the URL contract — no community-router upgrade cycle dictates the framework. |
| **`@revealui/presentation`** | Native UI components (Tailwind v4, zero external UI deps — only clsx + CVA) | No external UI library = no vendor coupling to a design-system release cadence. |
| **Tailwind CSS v4** | Utility-first styling | `@theme inline` bridge enables semantic tokens; system-adaptive dark mode via `prefers-color-scheme`. |
| **Lexical** | Rich text editor inside the admin engine | Performant, AST-based — fits the no-regex authoring posture; renders to HTML for storage. |
| **Cobalt brand token** | `--rvui-brand: oklch(0.36 0.190 240)` light / `oklch(0.58 0.150 240)` dark | One brand token, two themes, AA contrast on both. |

## Backend

| Choice | Role | Why |
|---|---|---|
| **Hono** | HTTP layer for `apps/server` | Lightweight, type-safe via `@revealui/openapi`, runs on Node + Fly + Vercel functions + Cloudflare Workers. |
| **`@hono/node-server`** | Node adapter for Hono | Plain Node + Vercel functions deployment story. |
| **Stripe** | Payments primitive | Industry-standard; webhook-driven license enforcement; same code path for subscriptions, perpetual licenses, and x402 agent payments. |
| **Yjs + y-protocols** | CRDT for agent memory + collaborative editing | Conflict-free; one library for both human collaboration and agent memory. |

## Build & quality

| Choice | Role | Why |
|---|---|---|
| **pnpm 10** | Package manager | Workspace support; faster + smaller install than npm; `only-allow pnpm` enforced. |
| **Turborepo** | Build orchestrator | Respects dependency order; affected-only PR gate. |
| **Biome 2** | Lint + format | Single Rust tool replaces ESLint + Prettier. |
| **Vitest 4** | Test runner | Native ESM, PGlite-backed DB tests. |
| **Playwright** | E2E tests | Cross-browser, runs against staging deploys. |
| **TypeScript 6** | Type system | Strict mode everywhere; no `any`; explicit return types on exported functions. |

## Inference

The runtime is provider-agnostic by contract and ships with no default AI vendor coupling. The Anthropic SDK is **not** imported by `@revealui/*` packages.

| Choice | Role |
|---|---|
| **Ollama** | Local model runner — the standard developer-machine path. |
| **Ubuntu Inference Snaps** | Snap-packaged model runtimes — recommended for production on Ubuntu hosts. |
| **Canonical model catalog (product)** | Nemotron 3 Nano/Omni, Gemma 3/4 (US-origin allowlist). |
| **Pluggable provider adapters** | Claude, OpenAI, and others available as opt-in adapters — never bundled. |

## Deployment targets

| Target | Role |
|---|---|
| **Vercel** | HTTP layer (`apps/marketing`, `apps/docs`, `apps/admin`, `apps/server` functions). |
| **Fly** | Long-running services (ElectricSQL sync, optional dedicated `apps/server` worker) configured via `apps/server/fly.toml` + `apps/server/Dockerfile.worker`. Railway was dropped as a target. |
| **Self-host** | Any infrastructure that runs Node 24 + Postgres + Hono. The runtime is portable by contract. |

## License posture

- **25 of 32 packages MIT-licensed** (forever).
- **5 of 32 packages Fair Source (FSL-1.1-MIT)** — source-visible, non-compete; convert to MIT 2 years after each release.
- **2 of 32 packages internal** (`@revealui/scripts`, `@revealui/apify-actor-governed-run`) — unlicensed, unpublished.

See [FAIR_SOURCE.md](../FAIR_SOURCE.md) for the licensing rationale.

## Further reading

- [ARCHITECTURE.md](../ARCHITECTURE.md) — system architecture deep-dive
- [DATABASE.md](../DATABASE.md) — Drizzle schema + migration workflow
- [AI.md](../AI.md) — AI package, MCP server catalog, agent runtime
- [PRO.md](../PRO.md) — Pro packages, license enforcement, commercial features
- [REFERENCE.md](../REFERENCE.md) — package-by-package API reference
