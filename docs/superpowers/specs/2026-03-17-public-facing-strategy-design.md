# RevealUI Public-Facing Strategy — Dual-Audience Platform Design

**Date:** 2026-03-17
**Status:** Approved
**Launch:** Soft (Friday 2026-03-21) → Hard (2026-03-28) → Full (2026-04-04)

---

## Overview

RevealUI's public presence serves two audiences simultaneously: **humans** who browse websites and **AI agents** who discover services via A2A, MCP, and OpenAPI protocols. The strategy has three layers mapped across three launch phases.

## Architecture Decision

**Hybrid model:** Marketing site (`revealui.com`) owns all pre-purchase content. CMS (`cms.revealui.com`) owns all post-signup product experience. No marketing content on the CMS — branded login gate only.

**Rationale:** Researched 14 B2B SaaS companies. Universal pattern: no company redirects unauthenticated app visitors to marketing. The login gate is standard (Payload CMS, Contentful, Strapi, Linear, Neon). SEO authority consolidates on the primary domain.

---

## Layer 1: The Living Proof (revealui.com)

### Principle
The marketing site runs on RevealUI itself. Every feature visitors see is a feature they get. The site is the product demo.

### Soft Launch (Friday 2026-03-21)

**Homepage restructure:**
- Primary CTA: "Get Early Access" / waitlist → **"Get Started Free"** → `cms.revealui.com/signup`
- Secondary CTA: "View docs" (stays)
- CLI block stays: `npx create-revealui@latest my-app`
- `LeadCapture.tsx` **deleted entirely** → replaced with new `GetStarted.tsx` component (simple CTA block linking to signup)
- All `#waitlist` anchor references in `HeroSection.tsx` and elsewhere updated to point to `cms.revealui.com/signup`
- `/api/waitlist` endpoint kept temporarily (returns 301 to signup for existing external links)
- Trust signals updated: current test count, workspace count, npm links

**Blog at `/blog` (stretch goal — defer to hard launch if not ready by Friday):**
- New route in `apps/marketing` fetching from `GET api.revealui.com/api/posts`
- Renders Lexical rich text to HTML using `@revealui/core/richtext/rsc` (the `serializeLexicalState` function or `RichTextContent` component)
- Data strategy: ISR with `next: { revalidate: 300 }` (5-minute revalidation). On fetch failure, render "No posts yet — check back soon" graceful fallback (not a 500).
- At least 1 launch post written before Friday. Remaining 2-4 posts written over soft launch week:
  - "Why we built RevealUI"
  - "The five primitives of business software"
  - "Open source + Pro: how we think about monetization"
- SEO metadata from post fields (title, description, slug)

**Navigation update:**
- "Get Early Access" → **"Get Started"** → `cms.revealui.com/signup`
- Add "Blog" → `/blog` (only if blog ships; otherwise defer)
- Add "Log in" text link → `cms.revealui.com/login`

### Hard Launch (2026-03-28)

- Blog ships here if not ready for soft launch
- Pricing page: add "For AI Agents" section — a card below the existing tracks showing:
  - "RevealUI is agent-native" heading
  - x402 per-call pricing model (how agents pay)
  - Agent Card URL for discovery
  - Link to API docs for integration
  - MCP server list with registry links
- Marketing site config open-sourced as a RevealUI reference template (1 template — the marketing site itself)

### Full Launch (2026-04-04)

- Marketing content migrated from hardcoded JSX to CMS Pages collection
- Block renderer: maps `{ type: 'hero', data }` → `<HeroSection />` etc. (~200 LOC)
- Marketing site fully dogfooded — every edit goes through CMS admin

---

## Layer 2: The Agent Storefront (well-known endpoints)

### Principle
When an AI agent evaluates RevealUI, it reads structured data at well-known endpoints. These endpoints ARE the marketing site for agent customers.

### Soft Launch (Friday 2026-03-21)

- `AGENTS.md` at repo root reviewed and updated (already exists from 2026-03-13 — update with current capabilities and discovery URLs)
- `/openapi.json` verified complete (pre-launch checklist item, not a deliverable — already works)

### Hard Launch (2026-03-28)

**A2A Agent Card path alignment:**
- The existing `/.well-known/agent.json` is already A2A spec-compliant (confirmed: the A2A spec uses `/.well-known/agent.json`, not `agent-card.json`)
- Review and update the Agent Card content: capabilities, protocols, pricing fields
- No new path needed — existing path is correct

**Registry registrations:**
- a2a-registry.org (A2A — first commercial Business OS platform listed)
- Smithery, mcpt, OpenTools, Glama.ai (MCP servers: Stripe, Supabase, Neon, Vercel, Code Validator)
- IAB Tech Lab AAMP (first A2A entry)

### Full Launch (2026-04-04)

- x402 V2 header upgrade (`X-PAYMENT-*` → `PAYMENT-SIGNATURE`/`PAYMENT-RESPONSE`)
- Signed Agent Cards (cryptographic identity verification per A2A 1.0)
- Marketplace promoted as combined MCP + A2A registry

---

## Layer 3: The Ecosystem Flywheel

### Principle
RevealUI becomes infrastructure that other developers build on and earn from. Each participant drives discovery for the next.

### Soft Launch (Friday 2026-03-21)

**"Built with RevealUI" badge — presentational component only:**
- Opt-in component in `@revealui/presentation`: `<BuiltWithRevealUI />`
- Theme-aware (reads CSS variables for colors, radius, font)
- Customizable props: `position`, `size`, `variant` (full | logo-only), `className`
- Props interface:
  ```ts
  interface BuiltWithRevealUIProps {
    position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
    size?: 'sm' | 'md';
    variant?: 'full' | 'logo';
    className?: string;
  }
  ```
- Soft launch ships the component only. No verification endpoint, no incentive backend yet.
- Badge included by default in CLI template projects (easy to remove, comment explains future incentive)

### Hard Launch (2026-03-28)

**Badge incentive system goes live:**
- Attribution verification endpoint: `GET /api/attribution/verify?domain=...` (domain logging, no tracking pixels)
- Task quota system updated: sites with verified badge get 500 bonus agent tasks/month
- Incentive documented in badge component JSDoc and on pricing page

**Marketplace as distribution:**
- Published MCP servers discoverable via A2A Agent Card + MCP registries
- Creator profiles on marketplace
- 80/20 revenue split via Stripe Connect (implemented in `apps/api/src/routes/marketplace.ts`)

**Template gallery:**
- 1 template published to Vercel template gallery: the marketing site itself as a cloneable RevealUI instance
- Additional templates (blog, e-commerce, portfolio) deferred to full launch or later

### Full Launch (2026-04-04)

**Community-driven growth:**
- Discourse launched via free.discourse.group with SSO via DiscourseConnect
- Tier-gated categories (Pro/Max/Enterprise private support)
- Public categories indexed by Google (SEO compounding)
- Build-in-public blog cadence: weekly posts

**The flywheel:**
1. Developer finds RevealUI (agent discovery / MCP registry / template gallery / organic / badge)
2. Deploys free tier with `npx create-revealui`
3. Opts into attribution badge for bonus tasks
4. Publishes MCP server on marketplace to earn revenue
5. Published server makes ecosystem more valuable
6. More agents discover RevealUI through expanded marketplace
7. Next developer finds RevealUI → cycle repeats

---

## CMS App Changes (cms.revealui.com)

### Principle
CMS is the product, not a marketing channel. When you arrive, you're here to work.

### Soft Launch (Friday 2026-03-21)

**Unauthenticated root → branded login gate:**
- Branding added to `AuthLayout` component (from `@revealui/presentation/server`) so all auth pages are consistent (login, signup, reset-password, MFA)
- RevealUI logo (use `public/logo.webp` or AVIF variant) + "Business OS" one-liner
- Login form (email/password, passkey, OAuth)
- "Create account" link → signup page
- Subtle footer: "Learn more at revealui.com"

**Root route logic:**
```
GET cms.revealui.com/
  → Has session? Redirect to /admin
  → No session? Redirect to /login
```

**Deleted:**
- `CmsLandingPage.tsx` and its route
- Mini pricing table on CMS
- Feature grid duplicating marketing site
- All marketing copy on unauthenticated CMS routes

**Blog migration — CMS routes:**
- `/posts` and `/posts/*` routes add 301 redirects to `revealui.com/blog` and `revealui.com/blog/[slug]` respectively
- `[slug]` catch-all route stays for CMS-managed pages (only renders pages with `status: 'published'`, gated by existing access control)
- Content stays in CMS collections (created/edited in admin). Public rendering moves to marketing site via API.

**Preserved:**
- `/login` — login page (default for unauthenticated root)
- `/signup` — signup with plan selection (`?plan=pro` for trial)
- `/account/billing` — billing dashboard (authenticated)
- `/admin/*` — full admin dashboard (authenticated)
- `/[slug]` — CMS-managed pages (published only)

---

## Vercel Project Mapping

| Domain | Vercel Project | Purpose |
|--------|---------------|---------|
| `revealui.com` | revealui-marketing | All pre-purchase: hero, features, pricing, blog, templates, legal |
| `cms.revealui.com` | revealui-cms | Post-signup: login, admin, billing, collections |
| `api.revealui.com` | revealui-api | REST API, A2A, MCP marketplace, webhooks, agent storefront |
| `docs.revealui.com` | revealui-docs | Developer documentation |

---

## Files Changed

### Soft Launch

**Marketing (`apps/marketing/`):**
- `src/components/LeadCapture.tsx` — DELETE
- `src/components/GetStarted.tsx` — NEW: simple CTA block linking to signup
- `src/components/NavBar.tsx` — update CTAs, add Blog/Login links
- `src/components/HeroSection.tsx` — update primary CTA text/target, remove `#waitlist` anchor
- `src/app/page.tsx` — swap LeadCapture for GetStarted
- `src/app/api/waitlist/route.ts` — return 301 redirect to `cms.revealui.com/signup`
- `src/app/blog/page.tsx` — NEW: blog index (stretch goal)
- `src/app/blog/[slug]/page.tsx` — NEW: post page (stretch goal)
- `src/components/BlogPost.tsx` — NEW: Lexical renderer (stretch goal)

**CMS (`apps/cms/`):**
- `src/app/(frontend)/page.tsx` — replace landing page with redirect to /login
- `src/lib/components/CmsLandingPage.tsx` — DELETE
- `src/app/(frontend)/login/page.tsx` — add branding to AuthLayout
- `src/app/(frontend)/posts/page.tsx` — add 301 redirect to revealui.com/blog
- `src/app/(frontend)/posts/[slug]/page.tsx` — add 301 redirect to revealui.com/blog/[slug]

**Packages:**
- `packages/presentation/src/components/BuiltWithRevealUI.tsx` — NEW: badge component (presentational only)
- Repo root: `AGENTS.md` — UPDATE (review + update capabilities)

### Hard Launch

**Marketing:**
- Pricing page: "For AI Agents" card section
- Blog ships here if deferred from soft launch

**API:**
- `src/routes/attribution.ts` — NEW: badge verification endpoint
- Agent Card content review/update

**External:**
- Registry submissions (a2a-registry.org, Smithery, mcpt, etc.)
- 1 Vercel template gallery submission

### Full Launch

**Marketing:**
- Block renderer system (~200 LOC)
- CMS Pages integration for marketing content

**API:**
- x402 V2 header migration

**External:**
- Discourse deployment + SSO configuration
- Additional Vercel templates (stretch)

---

## Pre-Launch Checklist (Friday morning)

- [ ] `/openapi.json` returns complete spec
- [ ] `AGENTS.md` updated with current capabilities
- [ ] `cms.revealui.com` without session shows login (not landing page)
- [ ] `revealui.com` "Get Started" button links to `cms.revealui.com/signup`
- [ ] `revealui.com` "Log in" link works
- [ ] `cms.revealui.com/posts` redirects to `revealui.com/blog` (or returns 404 if blog deferred)
- [ ] At least 1 blog post published in CMS (if blog is shipping)
- [ ] `BuiltWithRevealUI` component renders correctly in light/dark themes
- [ ] All auth flows work: signup → verify email → login → admin dashboard
- [ ] Pricing page loads with live Stripe prices (or fallbacks)

## Rollback Plan

If soft launch has critical issues:
- **Blog broken:** Remove `/blog` route from nav. Blog is a stretch goal — site works without it.
- **CMS login gate broken:** Revert `(frontend)/page.tsx` to render CmsLandingPage. One-line revert.
- **Signup flow broken (CORS):** Marketing "Get Started" button can temporarily link to `revealui.com/signup` (create a proxy page that redirects, avoiding cross-origin issues).
- **Badge component broken:** It's opt-in and presentational — just don't ship it in CLI templates until fixed.

---

## Success Metrics

| Metric | Baseline | Soft Launch | Hard Launch | Full Launch |
|--------|----------|-------------|-------------|-------------|
| Signups | 0 (waitlist only) | 50 | 200 | 500 |
| Badge adoptions | 0 | 5 | 50 | 150 |
| MCP registry listings | 0 | 0 | 7 (all servers) | 7+ community |
| A2A registry listings | 0 | 0 | 1 | 1+ marketplace |
| Blog posts | 0 | 1-3 | 8-10 | 12+ |
| npm downloads (create-revealui) | measure current | establish baseline | 2x | 5x |
| Marketplace published servers | 0 | 0 | 0 | 5 (community) |

---

## Non-Goals

- Docs site changes (stays as-is, markdown/Vite)
- Pricing model changes (tiers stay the same)
- New features in the CMS engine
- Mobile app or native clients
- Additional CLI templates beyond the marketing site reference (deferred)
