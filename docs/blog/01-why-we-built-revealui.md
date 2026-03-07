# Why I Built RevealUI (and Open-Sourced It)

*By Joshua Vaughn — RevealUI Studio*

---

Every TypeScript SaaS project I've ever started has gone the same way.

Week one: set up auth. Sessions, password reset, rate limiting, brute force protection. By the time you have signup, login, and "forgot password" working correctly — not just working, but correctly — it's day five. You haven't written a line of product code.

Week two: pick a CMS or build content management from scratch. Collections, field types, rich text, media uploads, draft vs live. Another week gone.

Week three: Stripe. Checkout sessions, webhooks, subscription lifecycle, billing portal. The webhook handler alone takes two days because you have to handle idempotency, failed payments, subscription updates, chargeback disputes, and trial periods — and if you get any of it wrong, you either give people free access or incorrectly revoke their paid access.

And then you still haven't touched the actual product.

I've done this loop more times than I can count. Each time I'd copy pieces from the last project, update the dependencies, fix the things that broke, and lose another two weeks. The code was never clean enough to reuse cleanly. It was always "the auth from that project" and "the billing handler from this one" and a week of glue.

At some point I decided to do it properly once.

---

## What RevealUI Is

RevealUI is open-source business infrastructure for TypeScript projects. It's the foundation every software business needs: **users, content, products, payments, and intelligence** — pre-wired and ready to deploy.

Not a boilerplate. Not a starter template you fork and immediately diverge from. A set of packages you install and configure, with real production code underneath.

The stack:
- **`@revealui/core`** — CMS engine, REST API, auth, rich text, admin UI, plugins
- **`@revealui/auth`** — sessions, password reset, rate limiting, brute force protection
- **`@revealui/db`** — 41-table Drizzle ORM schema (NeonDB + Supabase), migrations
- **`@revealui/contracts`** — Zod schemas and TypeScript types, single source of truth
- **`@revealui/presentation`** — 50+ native UI components, zero external UI dependencies

Plus the Pro tier for AI: agents, MCP servers, BYOK, streaming, vector memory.

You get to `npx create-revealui my-app` and have a running business — not a blank slate.

---

## Seven Weeks

I started on December 30, 2025. By the time I'm writing this it's March 2026 — about 10 weeks, though the first three were part-time. The repository has 320,000 lines of TypeScript across 1,786 files and 648+ commits.

I'm not saying this to brag. I'm saying it because the scope of "what a software business needs" is genuinely large, and the only way to understand that scope is to build it all the way through. Every piece you skip is a piece your customers will have to build themselves.

Here's what I didn't skip:

- **RBAC + ABAC policy engine** — role-based and attribute-based access control, because "is the user an admin?" isn't a real authorization model
- **GDPR compliance framework** — consent, deletion requests, anonymization, audit log — not because I enjoy compliance, but because EU customers are real customers
- **Webhook idempotency** — Stripe retries webhooks. If your handler isn't idempotent, you will double-charge people. This deserves a database table, not an in-memory Map that resets on every cold start
- **Circuit breakers on Stripe** — because Stripe goes down sometimes, and when it does your app shouldn't take the whole thing down with it
- **ElectricSQL real-time sync** — because collaborative editing is a solved problem at the infrastructure level and shouldn't require building a WebSocket server
- **CSP, CORS, HSTS, rate limiting, brute force protection** — because security headers aren't optional and "I'll add them later" means never

The AI layer — `@revealui/ai` — adds agent orchestration, CRDT memory, semantic search with pgvector, streaming, MCP server integration, and BYOK. It runs on Groq and Ollama by default, with no OpenAI dependency.

---

## Why Open Source

I open-sourced the core for a simple reason: the hard part of building a software business is not the infrastructure. It's the product. The business logic. The thing only you can build.

If I keep this stack proprietary, I'm making every TypeScript developer who finds it choose between trusting me and building it themselves. That's not a useful choice. The code should be readable, forkable, auditable, and improvable. MIT license on everything in the core.

The Pro tier — AI agents, MCP servers, editor integrations — is commercially licensed. That's how I keep working on this. But the foundation is free.

---

## What's Different

There are a lot of boilerplates. There are a lot of "full-stack starters." Here's what I think is different about RevealUI:

**It's not a template.** Boilerplates diverge from the moment you fork them. RevealUI is a set of packages. When I ship a bug fix to `@revealui/auth`, you get it with `pnpm update`.

**It's not a framework.** You don't write code "in RevealUI." You use RevealUI packages alongside your own code. The API is Hono. The CMS is Next.js. The components are Tailwind. Nothing is invented where a standard already exists.

**It's built for production.** I've deployed this. The auth, the billing, the database — all running against real traffic. The test suite is 400+ tests. The CI gate has three phases. This isn't code I wrote to look good in a demo.

**The AI layer is first-class.** Not a third-party integration, not a thin wrapper. The agent system has memory (episodic, semantic, working, procedural), tool use, streaming, provider health monitoring, and a workboard coordination protocol for running multiple agents in parallel on the same codebase.

---

## Try It

```bash
npx create-revealui my-app
cd my-app
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

The GitHub repo is [RevealUIStudio/revealui](https://github.com/RevealUIStudio/revealui). MIT license.

If you're building a TypeScript SaaS product and you've done the auth-CMS-billing loop more than once, RevealUI is for you. If you want to understand how a production billing + auth + CMS system fits together, the source is all there.

I'd love feedback. The quick-start guide is at [docs.revealui.com](https://docs.revealui.com). Discord is at [discord.gg/revealui](https://discord.gg/revealui) — still small, join early.

---

*RevealUI is open-source business infrastructure for software companies. [revealui.com](https://revealui.com)*
