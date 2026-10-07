---
title: "marketing"
description: "Public marketing site for RevealUI — homepage, licenses, pricing, templates, claims, contact, support, status, and policies. Lives at `revealui.com` (and the `community.revealui.com` host redirects to GitHub Discu..."
visibility: internal
status: verified
audience: maintainer
---

# marketing

Public marketing site for RevealUI — homepage, licenses, pricing, templates, claims, contact, support, status, and policies. Lives at `revealui.com` (and the `community.revealui.com` host redirects to GitHub Discussions via `vercel.json`).

## Stack

- Vite + React 19
- `@revealui/router` (file-based routing + SSR-capable, currently SPA mode)
- `@revealui/presentation` (UI primitives + design tokens)
- Tailwind CSS v4
- Inter + Inter Tight + JetBrains Mono via `@fontsource-variable`
- `react-markdown` + `remark-gfm` for blog post rendering
- `@vercel/speed-insights` (client-side runtime)
- Cross-origin form posts to `apps/server` (no marketing-side API routes)
- OG images from `https://api.revealui.com/api/og?...` (Satori-rendered in apps/server)

## Develop

```bash
pnpm --filter marketing dev          # http://localhost:3000
pnpm --filter marketing typecheck
pnpm --filter marketing build
pnpm --filter marketing preview
```

`apps/server` should run on port 3004 for `/api/og`, `/api/contact`, `/api/waitlist` to work cross-origin in dev.

## Deploy

Vercel: push triggers preview, merge to `main` triggers production. Build configured in `vercel.json`. CF Pages-compatible by construction (Vite static + SPA fallback rewrites + redirect rules); CF Pages deployment not wired yet — defer per the existing CF posture.


## Active, moved, and retained content

`app/App.tsx` owns SPA registration. `vercel.json` owns direct-request redirects.
The route tests exercise the actual App registry and compare moved destinations
with the hosting rules. `public/sitemap.xml` lists active public pages;
`public/llms.txt` links directly to maintained destinations. These artifacts do
not register routes or turn retained source modules into public pages.

The homepage mounts Hero (including explicit `?hero=foundation`, `ownership`,
and `l2` previews), HOME_BENEFITS, illustrated receipt, PricingTeaser, and Footer.
Hero also uses HOME_GET_STARTED.cli. Every preview shares the default setup,
license, and cost disclosures; its client title and social card follow its H1.
These are query previews, with no automatic traffic split or experiment results.

HOME_PROBLEM, HOME_DEMO, HOME_FAQ, the rest of HOME_GET_STARTED, and
HOME_PRIMITIVES remain component/CMS content. HomePage does not mount those
sections or consume homepage CMS drafts. ProductsPage does consume its CMS
blocks, including HOME_FAQ through the products seed. Do not label these exports
as the live homepage or reintroduce setup, default-model, or unrestricted paid
ownership promises when reusing them.

The existing auto-discovered CMS seeds retain home, products, philosophy,
local-ai, services, fair-source, for-operators-how-it-works, and
for-operators-managed. Seed presence does not establish route availability.
The corresponding retained page components remain independently testable;
App renders moved routes for philosophy, local-ai, services, blog, fair-source,
roadmap, sla, and the two operator subpages. Product licenses stay on /products
and /pricing. Studio essays and implementation engagements live on
revealuistudio.com; technical guides live on docs.revealui.com. Legal HIPAA and
subprocessor paths show procurement notices and the maintained disclosure link.

Existing exceptions and removal evidence: the former query-only headlines
claimed all tools reported in, whole-business coverage, or that secrets stayed
local. Their owner is content/home.ts; all now describe supported primitives,
controlled infrastructure, or configured access. The former audience head
hardcoded stale headlines/social cards and preserved a subpage canonical on
return; use-audience-head now derives the selected hero and restores the home
canonical. The existing subpage head hook also replaces the home social image
and its alternate text on navigation. The old route test registered a separate subset of routes; it now
uses App registration, so discovery and redirect checks exercise the owning
runtime. No duplicate route catalog, seed loader, or configuration override was
introduced. This source reconciliation does not establish production deployment.
