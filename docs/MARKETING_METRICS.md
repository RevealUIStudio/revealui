---
title: "Marketing Metrics — Pinned Truth"
description: "Single source of truth for every metric, count, and status claim used in the marketing app and public-facing copy. Updated when the code changes; validated by claim-drift CI gate."
category: internal
audience: maintainer
last-verified: 2026-05-18
verified-via: pnpm tsx scripts/validate/claim-drift.ts
---

# Marketing Metrics — Pinned Truth

This doc is the **single source of truth** for every metric, count, package name, license string, and status label that appears in the marketing app (`apps/marketing/`) and in customer-facing copy (`README.md`, `docs/PRO.md`, `packages/mcp/README.md`).

If a number appears in marketing copy, it MUST match the value below. If a value below is wrong, update **here first**, then run `pnpm tsx scripts/validate/claim-drift.ts` to verify the CI gate still passes, then propagate the new value into marketing content in a follow-up commit on the same branch.

**Why this doc exists.** Without it, every page invents its own count (witness the pre-Phase-1 state: Hero said "13 first-party MCP servers", Marketplace said "12", Pricing said "13", blog post 07 said "12 including the adapter base class"). Phase 2 of the marketing-overhaul lane pinned the canonical numbers here so Phase 3 can mechanically propagate them.

---

## 1. Codebase metrics (validated by claim-drift CI gate)

Source: `pnpm tsx scripts/validate/claim-drift.ts` on `origin/test` 2026-05-18 (commit `b0c6bbc81`).

| Metric | Canonical value | Source of truth (script ref) | Notes |
|---|---|---|---|
| Packages in `packages/` | **26** | `countPackages()` — `.ts`-bearing dir | Stale memory `reference_npm_account_topology` ("36") superseded by this. |
| Apps in `apps/` | **4** | `countApps()` | admin / server / docs / marketing. Was 5 (one app removed per PR #936 + #946 + #947). |
| Workspaces (monorepo total) | **30** | `countWorkspaces()` (= 26 packages + 4 apps) | |
| Test files | **912** | `countTestFiles()` — `*.test.ts` / `*.spec.ts` walking | Marketing copy should say "900+ tests" or quote the exact ground-truth number, never "20,000+" (the stale claim). |
| UI components in `packages/presentation/` | **59** | `countUIComponents()` | Marketing copy says "59 native React components" or similar. |
| **MCP servers** | **14** | `countMCPServers()` — `.ts` files in `packages/mcp/src/servers/` excluding `_`-prefixed | Includes `adapter.ts` (BaseAdapter + Vercel/Stripe/Neon subclasses); confirmed by `packages/mcp/README.md` + `CHANGELOG.md` 12→13 bump. |
| DB tables (Drizzle pgTable) | **85** | `countDbTables()` — `pgTable(` declarations across `packages/db/src/schema/*.ts` | Was 86; corrected to the live count. `site.ts` METRICS is now gate-enforced by claim-drift. |
| Access-control enforcement tests | **59** | `countEnforcementTests()` — `it(`/`test(` in `packages/core/src/__tests__/auth/` + `collections/operations/__tests__/access-enforcement.test.ts` | Quoted by the blog, both security attestations (`INFORMATION_SECURITY_POLICY`, `ASSET_INVENTORY`), `LAUNCH-CHECKLIST`, and marketing primitives. Gate-enforced so all surfaces move together. |
| License: MIT packages | **20** | `licenseSplit.mit` | |
| License: FSL-1.1-MIT packages | **5** | `licenseSplit.fsl` | @revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services |
| License: internal/none | **1** | `licenseSplit.internal` | `test` workspace package (private) |

**Marketing copy rule:** when a number appears, quote it as the canonical value. When a phrase says "more than N" or "N+", use the validated number as N. Don't round, don't approximate, don't add bonus framing like "(plus the adapter)" — the validator enforces the bare integer.

## 2. Pricing canonical source

Canonical: `packages/contracts/src/pricing.ts`.
Server fallback (when Stripe unreachable): `apps/server/src/routes/pricing.ts:50-82`. Phase 2.6 adds a vitest that asserts both stay in sync.

### Track A — Subscriptions (monthly)

| Tier | Price | Sites | Users | Agent tasks/mo | API rate (req/min) |
|---|---|---|---|---|---|
| Free | $0 | 1 | 3 | 1,000 | 200 |
| Pro | $49 | 5 | 25 | 10,000 | 300 |
| Max | $149 | 15 | 100 | 50,000 | 600 |
| Enterprise | $299 | unlimited | unlimited | unlimited | 1,000 |

### Track B — Agent task credits (one-time)

| Tier | Tasks | Price | Cost per task |
|---|---|---|---|
| Starter | 10,000 | $10 one-time | $0.001/task |
| Standard | 60,000 | $50 one-time | $0.00083/task (17% off Starter) |
| Scale | 350,000 | $250 one-time | $0.00071/task (29% off Starter) |

### Track C — Perpetual licenses (one-time + support)

| Tier | Price | Annual support renewal |
|---|---|---|
| Pro Perpetual | $299 | $99/yr |
| Agency Perpetual | $799 | $199/yr |
| Enterprise Perpetual | $1,999 | $499/yr |

**Status:** marked `comingSoon: true` in `packages/contracts/src/pricing.ts`. Marketing must label Track C "Coming soon" at H2 weight (no corner badges).

### Track D — Professional Services

| Service | Price | Notes |
|---|---|---|
| Architecture Review | $3,500 | one-engagement |
| Launch Package | $7,500 | one-engagement |
| Migration Assist | $300/hr | hourly |
| Consulting Hour | $300/hr | hourly |

**Status:** sold through agency, not self-serve. Marketing copy on `/pricing` says "Talk to founder" / contact link, not "Buy now."

## 3. Status claims (per locked owner answer Q3 — 3-state vocabulary)

| Surface | Allowed labels |
|---|---|
| Marketing site (every page) | `Shipped` / `In flight` / `Planned` |
| Per-product READMEs | Maturity terms OK (`Alpha` / `Beta` / `GA`) — separate axis from shipping status |

### Status of marketing-relevant systems (2026-05-18)

| Feature | Status | Notes |
|---|---|---|
| Stripe live payments | **In flight** | 3 of 5 pre-flip gates remain (Cat C heal + stripe:seed re-run + owner flip directive). Marketing copy may NOT claim "live payments today" / "accept payments immediately" — only "Stripe billing wired; live keys in flight." |
| Dashboard Agent Chat | **Shipped** | Live at admin.revealui.com. |
| Documentation Site | **Shipped** | docs.revealui.com. |
| x402 Agent Payments | **Planned** | `X402_ENABLED=false` default; code-complete but dormant. "Designed; gated on Stripe live." |
| MCP Marketplace (third-party publishing) | **Planned** | First-party catalog (14 servers) shipped; third-party publishing + revenue share not built. NO "80/20 revenue share" claims. |
| Perpetual Licenses (Track C) | **Planned** | `comingSoon: true` in contracts. |
| Self-Hosted Docker Images (RevealUI Fleet) | **Planned** | Designed, not built. |
| Visual Builder | **Planned** | Backlog. |
| Enterprise SSO / SAML | **Planned** | Designed, not built. |
| Cloudflare adoption | **Planned** | Deferred post-launch per memory. |

## 4. Brand

| Surface | Value |
|---|---|
| Primary brand color (`--rvui-brand`) | `oklch(0.58 0.150 240)` (cobalt-300, dark mode default — AA-lifted 2026-05-19) |
| Light mode brand | `oklch(0.36 0.190 240)` |
| Source-of-truth file | `packages/presentation/src/tokens.css:109-116` (dark) + `:198-206` (light) |
| Memory | `project_fleet_brand_emerald_convergence` (to be renamed post-merge: cobalt landed 2026-05-19) |

Marketing copy may say "cobalt" (or "Electric Verdigris") descriptively but the token name is `--rvui-brand`. Do NOT introduce new color variables in marketing CSS — consume the token via Tailwind config + `@revealui/presentation` import.

## 5. Fleet product roster (per locked Q3 vocabulary)

| Product | Marketing-site label | Per-product maturity (READMEs) | Notes for marketing |
|---|---|---|---|
| RevealUI | Shipped | Beta — no paying users yet | The core runtime |
| RevDev | Shipped (Studio + Console + Daemon all shipping) | Alpha | Dev harness; dogfooded via studio-dogfood lane |
| RevVault | Shipped | Beta (MIT CLI + Pro desktop app) | Secret management |
| RevForge | Shipped | Beta (operator-only stamping tool) | Produces customer-stamped Fleet kits |
| RevCon | Shipped | Alpha (MIT) | Editor config sync |
| RevSkills | Shipped | Active (MIT) | Claude Code skills library |
| RevKit | Planned | Pro (planned) | Portable WSL dev env |
| RevMarket | Planned | Code-complete, dormant | MCP marketplace; X402_ENABLED=false |

Customer-stamped Fleet kits are NOT fleet products — they are per-customer brand instances produced via RevForge.

## 6. Open-weight inference defaults (per memory)

Canonical defaults (when "open-model AI" is mentioned in marketing): Gemma 4, Phi-4-mini (via Ollama), DeepSeek-R1, Qwen-VL, Nemotron-3-nano, Nemotron-3-omni (via Ubuntu Inference Snaps).

**Hard rule per memory `project_suite_roadmap`:** Anthropic SDK is NEVER imported by RevealUI runtime code. Marketing copy may say "Claude / Anthropic" as one of the supported model providers (the Claude API integration runs out-of-band) but never as the default. Default is open-weight.

## 7. Brand language guardrails (per `brand-naming.md` + locked Q1)

- **RevealUI** = the framework/runtime (customer-facing).
- **RevFleet** = the umbrella product family (8 active products).
- **`RevForge`** = the stamping tool (NOT bare `Forge`).
- **"Studio"** alone is ambiguous (collides with RevDev Studio app + RevealUI Studio agency); always qualify as "RevealUI Studio" or "RevDev Studio."
- **Positioning (Q1 lock-in):** `shifts.md` primary + secondary —
  - "The OSS business runtime where your agents are first-class users."
  - "Auth, billing, content, and AI primitives — governed by one policy, audited by hash-chained logs, owned by you. From `npx create-revealui` to first paying customer in a weekend."

## 8. Voice rules (per `.jv/docs/lanes/_closed/messaging-funnel-audit/voice-and-headline-rules.md`)

Five testable rules — Phase 5 audits every page against these:

1. **Lead with what ships today.** Every page's first sentence under H1 names a capability with a verifiable artifact.
2. **Specifics over adjectives.** "Fast" → "14 first-party MCP servers." "Secure" → "Ed25519-signed license JWTs."
3. **Identify the reader by their stack, not job title.**
4. **Surface the trade-off, don't bury it.** "Three yeses and one no" pattern.
5. **No marketing-speak, no emojis, no exclamation points.** Banned adjective table in `voice-and-headline-rules.md` §1.

## 9. How to update this doc

1. Make the underlying code change (add a package, ship an MCP server, etc.).
2. Run `pnpm tsx scripts/validate/claim-drift.ts` — confirm the new actual values.
3. Update this doc with the new canonical numbers.
4. Run the validator again — confirm `Claims scanned: N, Mismatches: 0`.
5. If marketing copy needs updating, do so in a follow-up commit on the same PR (mechanical find-and-replace).
6. Update `last-verified` field in frontmatter.

## 10. Drift report convention

When this doc disagrees with marketing copy, file a `gh issue` titled `marketing-drift: <metric> says <X> on <surface>, MARKETING_METRICS.md says <Y>`. Tag with `area:marketing` + `kind:drift`. Phase 6 of the marketing-overhaul lane wires the claim-drift CI gate to also cover `apps/marketing/app/content/*.ts` so this drift is caught automatically.

---

**Related references:**
- Lane plan: `.jv/docs/lanes/marketing-overhaul/plan.md`
- Voice rules: `.jv/docs/lanes/_closed/messaging-funnel-audit/voice-and-headline-rules.md`
- Positioning shifts: `.jv/docs/lanes/_closed/messaging-funnel-audit/shifts.md`
- Brand naming: `.jv/docs/brand-naming.md`
- Validator source: `scripts/validate/claim-drift.ts`
- Pricing canonical: `packages/contracts/src/pricing.ts`
- Brand tokens: `packages/presentation/src/tokens.css`
