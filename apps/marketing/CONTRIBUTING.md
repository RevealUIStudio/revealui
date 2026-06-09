---
title: "Contributing to the marketing site (`apps/marketing`)"
description: "`revealui.com` is a Vite + React SPA built on `@revealui/router`. Copy lives in"
visibility: internal
status: verified
audience: contributor
---

# Contributing to the marketing site (`apps/marketing`)

`revealui.com` is a Vite + React SPA built on `@revealui/router`. Copy lives in
typed `app/content/*.ts` modules; the route components in `app/routes/*.tsx` are
pure renderers that consume that content. **Edit copy in `app/content/`, not in
JSX.**

## Where copy lives

| File | Owns |
|---|---|
| `content/site.ts` | URLs, brand strings, and the canonical `METRICS` object |
| `content/home.ts`, `primitives.ts`, `products.ts` | landing + `/products` copy |
| `content/pricing.ts`, `pricing-faq.ts`, `pricing-teaser.ts` | `/pricing` copy (tier data re-exported from `@revealui/contracts/pricing`) |
| `content/marketplace.ts`, `capabilities.ts`, `proof.ts` | marketplace + proof sections |
| `content/roadmap.ts` | `/roadmap` page (Recently shipped / Coming next) |
| `content/fair-source.ts`, `sponsor.ts`, `nav.ts`, `contact.ts` | the remaining surfaces |

## Numbers are single-sourced

Every count (packages, MCP servers, DB tables, UI components, …) lives once, in
`METRICS` in `content/site.ts`. **Never hardcode a count in another content
file — import `METRICS` instead.**

`METRICS` mirrors `docs/MARKETING_METRICS.md` §1, the canonical pinned-truth
doc. The values are gate-enforced: `scripts/validate/claim-drift.ts` computes
each count from the codebase and fails CI if `METRICS` drifts. To change a
number:

1. Make the underlying code change (add a package, ship an MCP server, …).
2. Update `docs/MARKETING_METRICS.md` §1.
3. Update `METRICS` in `content/site.ts` to match.
4. Run `pnpm tsx scripts/validate/claim-drift.ts` — it must exit 0.

Marketing copy then reflects the new number automatically — no per-page edit.

## Voice

Customer-facing copy follows the five voice rules summarized in
`docs/MARKETING_METRICS.md` (lead with what ships today; specifics over
adjectives; identify the reader by stack; surface trade-offs in plain English;
no marketing-speak, emojis, or exclamation points). `claim-drift` also enforces
honest framing: no inflated counts, no unattributed fleet-product mentions, no
internal-codename leaks, and no unqualified aspirational features.

## Tests

- `app/content/__tests__/content.test.ts` — structural contracts (five
  primitives, capability count + file citations, roadmap honesty, `METRICS`
  invariants).
- `app/__tests__/routes.test.ts` — every advertised path resolves to a
  component, and the legacy `/coming-soon` → `/roadmap` redirect stays in
  `vercel.json`.

Run `pnpm --filter marketing test`. New copy should keep both suites green and
leave `pnpm tsx scripts/validate/claim-drift.ts` at exit 0.
