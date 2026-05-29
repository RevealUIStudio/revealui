---
title: Threat Model
description: STRIDE-style threat model for the RevealUI security stack across four trust boundaries — Human↔App, App↔External services, Agent↔Tool (MCP), Agent↔Agent (RevDev daemon).
last-updated: 2026-05-16
---

# Threat Model

## 1. Purpose

This document is the threat-modeling skeleton for the RevealUI security stack. It catalogs assets, trust boundaries, and STRIDE-categorized threats per boundary, with named mitigations citing the file path (and `:line` where the citation is stable) at which each control lives. Residual risks point to [LIMITATIONS.md](./LIMITATIONS.md).

It is a working document. Comprehensive coverage will accrete over multiple sessions as new features ship; pre-merge threat-model updates are expected for any change that touches the boundaries enumerated in §4.

## 2. Scope and assumptions

**In scope:**
- The RevealUI monorepo as it ships from `RevealUIStudio/revealui`
- The `AuditPolicyEngine` and MCP dispatch boundary in `@revealui/ai` and `@revealui/mcp`
- The RevDev daemon's RPC interface (`revdev/packages/daemon`)
- Secret handling via revvault and Vercel environment variables
- Production deployment topology: Vercel-hosted Next.js + Hono on Vercel functions, NeonDB primary, Supabase legacy, Stripe payments

**Out of scope:**
- Self-hosted customer deployments — see [LIMITATIONS.md §3.7](./LIMITATIONS.md)
- LLM provider trust model — covered by provider selection (open-source models on local inference for the fleet runtime)
- Physical / embodied / real-time control — see [LIMITATIONS.md §3.8](./LIMITATIONS.md)

**Trust assumptions** are enumerated in [LIMITATIONS.md §5](./LIMITATIONS.md). If any is violated, the controls in this model may not hold.

## 3. Assets

| Asset | Description | Where it lives |
|-------|-------------|----------------|
| User PII | Email, name, password hash, OAuth tokens, TOTP secrets | NeonDB `users` table + Supabase legacy auth |
| Session state | Active session cookies, signing key | NeonDB `sessions` table; signing key in revvault under the `revealui/prod/session-secret` path |
| Payment data | Stripe customer IDs, subscription IDs, webhook event metadata (no PAN — never stored) | NeonDB `billing_*` tables; Stripe is canonical |
| Application secrets | Database URLs, Stripe keys, OAuth client secrets, webhook signing secrets | Revvault (canonical), Vercel env vars (mirror) |
| Audit trail | Append-only tamper-evident log of agent and admin actions | NeonDB `audit_log` table, HMAC chain |
| Content | User-published content under their RevealUI-powered site | NeonDB `content_*` tables |
| ~~RevealCoin (RVC) keypairs~~ | Project cancelled 2026-05-29; keypairs rotated-and-destroyed via revvault `_decommissioned/revealcoin-2026-05-29/` namespace. No live custody. | (decommissioned) |
| npm packages | OSS + Pro packages published under `@revealui/*` | npm registry; build artifacts in GitHub Actions |
| Source code | The monorepo itself | GitHub `RevealUIStudio/revealui`, branch protection on `main` and `test` |

## 4. Trust boundaries

Adapted from the four-boundary structure that recurs in modern agentic threat models. Each boundary is enumerated in §5 with STRIDE.

| ID | Boundary | Crosses |
|----|----------|---------|
| **B1** | Human ↔ App | Browser sessions to Next.js / Hono entry points |
| **B2** | App ↔ External services | Outbound to Stripe, Vercel, Neon, Supabase, OAuth providers, LLM providers, npm registry |
| **B3** | Agent ↔ Tool (MCP) | Agents in `@revealui/ai` dispatching to MCP servers in `@revealui/mcp` |
| **B4** | Agent ↔ Agent (Daemon) | Cross-agent coordination via the RevDev daemon RPC interface |

(`B0` — Internal monorepo build / CI / GitHub Actions — is in scope but not enumerated here; covered by branch protection + supply-chain controls in [INFORMATION_SECURITY_POLICY.md §7](./INFORMATION_SECURITY_POLICY.md).)

## 5. STRIDE per boundary

Mitigations cite file paths. Where a mitigation is planned but not shipped, it is marked → [LIMITATIONS.md](./LIMITATIONS.md) with a pointer to the relevant roadmap item.

### 5.1 B1 — Human ↔ App

| Threat | Example | Mitigations |
|--------|---------|-------------|
| **Spoofing** | Attacker forges a session cookie | Signed cookies (httpOnly + secure + sameSite=lax); session signing via `SESSION_SECRET` (revvault path `revealui/prod/session-secret`); bcrypt-hashed passwords (12 rounds); optional TOTP MFA |
| **Tampering** | XSS injects JS to read admin state | CSP headers (`@revealui/security`); `isSafeUrl()` blocks `javascript:` / `vbscript:` / `data:` in Lexical link + image rendering; React 19 default escaping; CSRF tokens on state-changing admin routes (revealui#840, #853) |
| **Repudiation** | Admin denies making a destructive change | `audit_log` table with HMAC + previousSignature chain (`packages/db/src/schema/audit-log.ts`); admin actions logged with actor + timestamp |
| **Information Disclosure** | API leaks PII to an unauthenticated caller | RBAC + ABAC engine; `access.read` enforced in find / findByID; admin gate via `revealui-role` cookie in `proxy.ts`; `overrideAccess` stripped from external requests |
| **Denial of Service** | Brute-force auth or webhook flood | Brute-force progressive lockout on auth endpoints; 100 req/min rate limit on `/api/webhooks`; Vercel-side DDoS protection |
| **Elevation of Privilege** | Authenticated user accesses admin routes | Admin proxy gate (defense-in-depth on top of role checks); license + feature gates (`isLicensed('pro')`, `isFeatureEnabled()`); access-enforcement tests verify role isolation (`packages/core/src/__tests__/auth/`) |

### 5.2 B2 — App ↔ External services

| Threat | Example | Mitigations |
|--------|---------|-------------|
| **Spoofing** | Forged Stripe webhook | Stripe webhook signature verification with `STRIPE_WEBHOOK_SECRET`; livemode guard on webhook events (revealui#789) |
| **Tampering** | MITM on an outbound API call | TLS 1.2+ enforced on all outbound (Vercel function runtime, Node 24 defaults); HSTS on inbound |
| **Repudiation** | Vendor denies receiving a request | All outbound calls go through `@revealui/services` with structured logging; Sentry captures errors (revealui#823, #787 GAP-S1) |
| **Information Disclosure** | A secret leaks via logs or error traces | `pnpm audit:console` finds production console statements (warn); Gitleaks in pre-commit + CI; revvault paths logged, never values; `pnpm audit:any` tracks unsafe `any` types that could mask leaks |
| **Denial of Service** | Upstream provider outage cascades | `@revealui/resilience` circuit breaker + retry + bulkhead; `@revealui/cache` ISR + edge cache; Stripe circuit breaker in `@revealui/services`; reconciliation crons with Sentry failure alerts (revealui#787 GAP-S2) |
| **Elevation of Privilege** | Compromised secret grants over-broad upstream access | Revvault is the canonical store; per-environment scoping (prod / dev); revvault-vercel-sync keeps the canonical-mirror invariant (revealui#784, revvault#40); secret-rotation runbooks per provider in [INCIDENT_RESPONSE.md §7](./INCIDENT_RESPONSE.md) |

### 5.3 B3 — Agent ↔ Tool (MCP dispatch)

| Threat | Example | Mitigations |
|--------|---------|-------------|
| **Spoofing** | Tool call masquerading as a different agent's call | Agent identity threaded into MCP call context; tool-call audit emits `agentId` + `sessionId` + `taskId` per call (`packages/ai/src/audit/types.ts`) |
| **Tampering** | Tool response modified to inject a malicious instruction | Tool responses are not signed by tool authors today; mitigation deferred — see [LIMITATIONS.md §3.2](./LIMITATIONS.md) |
| **Repudiation** | Agent denies having called a destructive tool | Every tool call emits an `agent:tool:call` audit entry (`packages/ai/src/audit/types.ts`); HMAC chain prevents post-hoc edit |
| **Information Disclosure** | Tool exfiltrates secret-bearing context | Tier-based authorization (`packages/mcp/src/auth.ts`) gates tool access per JWT tier (free / pro / max / enterprise); per-tool permission lists in the same file; agent capability tags restrict which agents can call which tools (`packages/ai/src/orchestration/agent.ts`) |
| **Denial of Service** | Agent floods a tool to exhaust quota | `toolCallRateLimit` policy in `AuditPolicyEngine` (`packages/ai/src/audit/policy.ts`); circuit breaker on `@revealui/services` calls; per-route Hono rate limits |
| **Elevation of Privilege** | Agent invokes a higher-tier tool it shouldn't have | License + tier check at `packages/mcp/src/auth.ts`; `deniedToolAccess` policy halts the agent on a denied call; `selfModificationBlock` halts an agent attempting to mutate its own instructions |

**Known residual risks for B3** — see [LIMITATIONS.md §3.1 (LLM content moderation), §3.2 (indirect prompt injection), §3.3 (knowledge-flow exfiltration), §4.1 (post-execution audit timing)](./LIMITATIONS.md).

### 5.4 B4 — Agent ↔ Agent (RevDev daemon)

| Threat | Example | Mitigations |
|--------|---------|-------------|
| **Spoofing** | One agent impersonates another over the daemon socket | Socket-bound identity at `session.register` / `session.attach` (`revdev/packages/daemon/src/server.ts`); future per-RPC Ed25519 verification → [LIMITATIONS.md §4.3](./LIMITATIONS.md) |
| **Tampering** | RPC arguments modified in transit | Unix-domain socket — host-local trust boundary; in-flight tampering requires host-level compromise (out of scope) |
| **Repudiation** | Agent denies posting a coordination message | All RPC methods log to the daemon event store with `agentId` + `method` + timestamp; coordination operations (mail, files, tasks) maintain their own provenance |
| **Information Disclosure** | One agent reads another agent's mailbox | Mail / Files / Tasks scoped by `agentId` in the daemon's PGlite store; cross-agent reads require explicit broadcast or assignment |
| **Denial of Service** | Agent spams the daemon with RPCs | License-guarded RPC dispatch (`revdev/packages/daemon/src/guard.ts`); `IDENTITY_EXEMPT` set bounds methods callable pre-registration |
| **Elevation of Privilege** | Agent claims a license tier it isn't entitled to | License is verified by `guardRpcMethod()` per dispatch; revvault holds canonical license state |

**Known residual risks for B4** — see [LIMITATIONS.md §4.3 (socket-bound identity)](./LIMITATIONS.md).

## 6. Cross-cutting controls

Controls that apply across multiple boundaries.

| Control | Mechanism | Coverage |
|---------|-----------|----------|
| Tamper-evident audit | HMAC-SHA256 signature + `previousSignature` hash chain | All admin actions, all agent tool calls, all policy violations |
| Secret hygiene | Revvault canonical; tmpfs restore; zeroized on exit; pre-commit Gitleaks; CI Gitleaks | All boundaries; `docs/SECRETS.md` is the path index |
| Dependency hygiene | Pinned `pnpm.overrides`; Dependabot; CodeQL; `pnpm audit` in CI | All packages; B2 supply-chain protection |
| GDPR data subject rights | `@revealui/security` GDPR framework; cross-DB cleanup via `@revealui/db/cleanup` | B1 PII, B2 PII-in-Stripe (revealui#789 GDPR `stripe.customers.del`) |
| Pre-launch checklist | `pnpm preflight` — 15-point check | All boundaries before production deploy |

## 7. Residual risks

The threats this model does NOT mitigate are enumerated in [LIMITATIONS.md §3 (non-scope)](./LIMITATIONS.md) and [§4 (architectural design choices that constrain coverage)](./LIMITATIONS.md). The roadmap items in [LIMITATIONS.md §7](./LIMITATIONS.md) are the planned reductions of those residuals.

## 8. Maintenance

This document is reviewed and updated:

- When a new trust boundary is introduced (e.g., when the marketplace opens, "B5 = App ↔ Third-party MCP marketplace" becomes a new boundary)
- When a mitigation in §5 changes file path — citations must stay accurate
- After any P0 / P1 incident — add the attack path to the relevant boundary's STRIDE row if not already covered
- At minimum, every 6 months

Last reviewed: 2026-05-16.

For limitations and residual risks, see [LIMITATIONS.md](./LIMITATIONS.md).
For vulnerability reporting, see [/SECURITY.md](/SECURITY.md).
For incident runbooks, see [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).
For the active security policy, see [INFORMATION_SECURITY_POLICY.md](./INFORMATION_SECURITY_POLICY.md).
