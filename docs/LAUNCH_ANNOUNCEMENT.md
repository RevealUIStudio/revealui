# RevealUI Launch Announcement

Drafts for X, GitHub Discussions, and Discord.

---

## X / Twitter Thread

**Tweet 1 (hook):**

> Building a SaaS? You don't need to assemble auth + CMS + payments + AI from scratch every time.
>
> Introducing RevealUI — open-source business infrastructure for software companies.
>
> Users. Content. Products. Payments. Intelligence. Pre-wired and ready to deploy. 🧵

---

**Tweet 2 (what it is):**

> RevealUI ships the 5 primitives every software business actually needs:
>
> → Users — auth, sessions, RBAC, brute force protection
> → Content — collections, rich text, REST API
> → Products — catalog, pricing tiers, license keys
> → Payments — Stripe checkout, subscriptions, webhooks
> → Intelligence — AI agents, MCP servers (Pro)
>
> One repo. Day one.

---

**Tweet 3 (the problem):**

> The average SaaS founder spends 6–12 weeks on infrastructure before writing a single line of product code.
>
> Auth. CMS. Billing. Role management. Email. Logging. That's before you even start on the thing that makes you different.
>
> RevealUI cuts that to a weekend.

---

**Tweet 4 (open source):**

> MIT licensed. Full source code.
>
> Not a hosted service. Not a component library. Not a headless CMS.
>
> A deployable, self-hostable TypeScript monorepo that runs your whole business stack.
>
> npx create-revealui my-app

---

**Tweet 5 (stack):**

> Built on the same stack you're already using:
>
> React 19 · Next.js 16 · Hono · TypeScript 5.9
> Drizzle ORM · NeonDB · Stripe · Tailwind v4
> Lexical rich text · ElectricSQL sync · Vitest · Playwright

---

**Tweet 6 (Pro):**

> The core is free forever. MIT.
>
> Pro ($49/mo) adds AI agents with working memory, MCP servers for Stripe/Supabase/Vercel/Playwright, and BYOK for any LLM provider.
>
> Enterprise ($299/mo) adds SSO, multi-tenant, white-label.

---

**Tweet 7 (CTA):**

> ⭐ GitHub: github.com/RevealUIStudio/revealui
> 📖 Docs: docs.revealui.com
> 💬 Discord: [discord invite]
>
> If you're building a software business, RevealUI is the foundation I wish I had.
>
> RT to help another founder skip the boilerplate hell 🙏

---

## GitHub Discussions (Announcements)

**Title:** RevealUI is now open source 🎉

---

We're officially open sourcing RevealUI — business infrastructure for software companies.

**What is it?**

RevealUI is a full TypeScript monorepo that ships the five things every software business needs:

| Primitive | What's included |
|-----------|----------------|
| **Users** | Auth, sessions, RBAC, rate limiting, brute force protection |
| **Content** | CMS collections, rich text (Lexical), media, REST API |
| **Products** | Catalog, pricing tiers, license keys |
| **Payments** | Stripe checkout, subscriptions, webhooks, billing portal |
| **Intelligence** | AI agents, MCP servers, BYOK *(Pro)* |

You clone it. You own it. You deploy it. Full source code, no vendor lock-in.

**Why open source?**

Every software company builds the same foundation. Auth, billing, content management, user roles — the same problems, solved slightly differently, millions of times. That's waste.

RevealUI is our attempt at a well-engineered, opinionated foundation you can actually deploy and then build your product on top of.

**Getting started**

```bash
npx create-revealui my-app
cd my-app
pnpm install
pnpm dev
```

Full docs at [docs.revealui.com](https://docs.revealui.com).

**Licensing**

Core infrastructure (13 packages) is MIT. AI agents and Pro features are commercially licensed at $49/month. Enterprise at $299/month. The split is documented in the repo.

**What's next**

We're at the launch preparation phase. The codebase is production-grade (320,000 lines, 307+ test files, full CI gate), deployed on Vercel, and actively used for RevealUI's own marketing and docs. We're opening the repo now to get real feedback before the formal announcement.

If you find bugs, open issues. If you want a feature, open a discussion. If you're building something with it, we'd love to hear about it.

— Joshua, RevealUI Studio

---

## Discord Announcement

**Channel: #announcements**

---

**@everyone — RevealUI is now open source!**

After 7 weeks and 650+ commits, the repo is public.

**What:** Open-source business infrastructure for TypeScript/React software companies. Users, content, products, payments, and AI — pre-wired and ready to deploy.

**Stack:** React 19, Next.js 16, Hono, Drizzle ORM, NeonDB, Stripe, Tailwind v4, Lexical, ElectricSQL

**GitHub:** github.com/RevealUIStudio/revealui
**Docs:** docs.revealui.com
**Get started:** `npx create-revealui my-app`

**MIT core. Pro tier at $49/mo for AI agents and MCP servers.**

Questions? Drop them in #general. Found a bug? #bug-reports. Building something? #showcase.

---

## Hacker News (Show HN)

**Title:** Show HN: RevealUI – open-source business infrastructure for software companies

---

RevealUI is a full TypeScript monorepo that ships the five things every software business needs before they can build their actual product: auth, CMS, products catalog, Stripe payments, and AI agents.

The problem: the average SaaS founder spends 6–12 weeks on infrastructure that isn't differentiated. Auth, billing, user management, content — it's the same for everyone. RevealUI collapses that to a weekend.

**What's in the box:**
- Auth with sessions, RBAC, brute force protection, rate limiting
- CMS engine: 50+ field types, rich text (Lexical), REST API, draft/live
- Products: catalog, pricing tiers, license keys
- Stripe: checkout, subscriptions, webhooks, billing portal
- AI agents with working memory + MCP servers (Pro)
- 53 native UI components (zero external UI deps)
- Full real-time sync via ElectricSQL
- `npx create-revealui` scaffolding tool

**Stack:** React 19, Next.js 16, Hono, TypeScript 5.9, Drizzle ORM, NeonDB, Stripe, Tailwind v4, Lexical, Vitest, Playwright

**Licensing:** 13 core packages are MIT. AI/Pro features are commercially licensed ($49/mo Pro, $299/mo Enterprise). The split is at the package level with full source access on both tiers.

The codebase is 320K lines across 6 apps and 18 packages. Full CI gate (Biome, TypeScript, Vitest, Playwright). Deployed on Vercel.

GitHub: github.com/RevealUIStudio/revealui
Docs: docs.revealui.com
