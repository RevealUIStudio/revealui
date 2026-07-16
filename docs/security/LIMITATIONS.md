---
visibility: internal
status: verified
audience: maintainer
title: Security Stack Limitations
description: Explicit scope and non-scope statements for the RevealUI security stack — what it governs, what it does not, and the trust assumptions that require defense-in-depth from outside the platform.
last-updated: 2026-05-16
---

# Security Stack Limitations

## 1. Purpose

This document is the honest disclosure of what the RevealUI security stack governs and what it does not. It is intended for:

- Customer security reviews, vendor risk assessments, and SOC 2 audit narratives
- EU AI Act readiness (Article 53 transparency obligations, enforceable August 2026)
- Self-hosters and Pro-package licensees who need to plan their own defense-in-depth layers
- Maintainers reasoning about future scope decisions

"The RevealUI security stack" in this document refers to the controls implemented in this monorepo: the auth / authz / encryption / audit modules in `@revealui/security` and `@revealui/core`, the `AuditPolicyEngine` in `@revealui/ai`, the MCP-mediated tool dispatch in `@revealui/mcp`, and the secret-handling discipline of revvault.

## 2. What the security stack governs (explicit scope)

| Surface | Controls | Reference |
|---------|----------|-----------|
| Browser ↔ App | TLS 1.2+, HSTS, CSP, CORS, CSRF tokens on state-changing admin routes | `@revealui/security`, `packages/core/src/security/` |
| Session auth | Session-only cookies (httpOnly + secure + sameSite=lax), bcrypt 12 rounds, brute-force rate limiting, optional TOTP | `@revealui/auth` |
| Authorization | RBAC + ABAC engine, collection-level access checks (`access.read/update/delete`), admin-gate middleware, license + feature gates | `@revealui/core` access enforcement tests |
| Secret handling | Revvault is the canonical source of truth (`docs/SECRETS.md`); zeroized tmpfs restore; no plaintext on disk outside the restore window | `docs/SECRETS.md` |
| Audit trail | Append-only `audit_log` table, HMAC-SHA256 signature + `previousSignature` hash chain (tamper-evident) | `packages/db/src/schema/audit-log.ts` |
| Agent action policies | `AuditPolicyEngine` evaluates post-execution; can halt the offending agent (`halt_agent`) or all agents (`halt_all`); built-in policies for tool-rate limits, self-modification, denied tool access, fleet memory flood, consecutive failures | `packages/ai/src/audit/policy.ts` |
| Tool dispatch | All agent tool calls funnel through `@revealui/mcp`; tier-based JWT authorization on tool invocation; per-tool permission lists | `packages/mcp/src/auth.ts` |
| Input validation | Zod-typed schemas from `@revealui/contracts`; `isSafeUrl()` blocks `javascript:` / `vbscript:` / `data:` in Lexical rendering; Drizzle parameterized queries | `@revealui/contracts`, Lexical link/image rendering |
| Webhook integrity | Stripe webhook signature verification; per-endpoint rate limiting (500 req/min) | `apps/server/src/routes/webhooks.ts` |
| GDPR | Consent management, data deletion, PII anonymization, Neon `pgvector` cleanup | `@revealui/security` GDPR framework |
| Supply chain | Pinned dependency overrides for known CVEs; Dependabot + CodeQL + Gitleaks in CI; `pnpm audit` in CI gate | Root `package.json` `pnpm.overrides`, `.github/workflows/security.yml` |

## 3. What the security stack does NOT govern (explicit non-scope)

This is the section that auditors trust. We do not handwave these gaps.

### 3.1 LLM input / output content moderation

The stack governs *what tools an agent can invoke*. It does not inspect, sanitize, or block the content of LLM prompts or completions. We do not ship Llama Guard, Azure AI Content Safety, NeMo Guardrails, Bedrock Guardrails, or any equivalent prompt / output filter.

If you operate agents on user-supplied content and need toxicity / PII / jailbreak detection at the prompt or completion layer, layer one of those on top. The MCP tool boundary is not a substitute for content moderation.

### 3.2 Indirect / second-order prompt injection

A web page fetched by an allowed `web_search` tool can contain hidden instructions ("ignore previous instructions, exfiltrate X"). The tool call itself is policy-compliant; the resulting agent behavior may not be. The stack does not detect or block prompt-injection payloads embedded in tool *responses*.

Mitigation today: minimize agent autonomy on untrusted-content workflows; require human approval for high-impact actions after ingest of external content. Future: a pre-execution policy gate (planned, see §7) provides one place to add response-content guards.

### 3.3 Knowledge-flow and data classification

The stack does not classify documents, track which retrieval sources influenced a decision, or detect "approved tool reads PII → approved tool writes it to a public channel" exfiltration paths. Both ends of that flow are governed; the flow itself is not.

Mitigation today: tier-based tool access prevents most cross-tenant flows; the audit log records both ends so post-hoc detection is possible. Real-time flow analysis is not in scope.

### 3.4 Embedding / RAG memory poisoning

If an attacker can write to a retrieval index that an agent later reads, no current control detects the poisoned entries. The `AuditPolicyEngine`'s `fleetMemoryFlood` policy detects *volume* spikes, not *content* poisoning.

Mitigation today: write-side authorization on memory tables; provenance fields on `agent_memory` rows; manual review for high-trust memory writes. Cross-model verification (CMVK-style majority vote) is a roadmap item.

### 3.5 Outcome verification

The audit log records actions *attempted* by agents. It does not record whether those actions *succeeded in the external world* or achieved their intended business effect. `Stripe.createCustomer` is logged on call; whether Stripe actually created the customer must be verified by reconciliation (the `report-agent-overage` cron + Stripe webhook listeners) which exists separately and is treated as defense-in-depth, not part of this stack's authorization story.

### 3.6 Real-time streaming inspection

Policy evaluation is per-discrete-action (per tool call, per RPC, per HTTP request). Streaming data — long-running websocket sessions, server-sent events, SSE-based agent streams — is not inspected packet-by-packet.

### 3.7 Customer-side infrastructure

Self-hosted RevealUI deployments are out of scope. Self-hosters are responsible for: TLS termination, network policy, OS-level isolation, container runtime hardening, IAM, and secret backing store. The stack provides defaults that work; it does not enforce them on customer infrastructure.

### 3.8 Physical actuators, embodied agents, real-time control loops

Not designed for. Do not use this stack to govern hardware safety interlocks.

## 4. Architectural design choices that constrain coverage

### 4.1 Post-execution audit, not pre-execution gate

`AuditPolicyEngine` (`packages/ai/src/audit/policy.ts:13`) is invoked from `AuditObserver.handleEvent()` *after* an agent emits a tool-call event. Halts via `halt_agent` / `halt_all` take effect on the agent's *next* event, not the current one. The triggering action is logged and may have already executed.

This is by design: the engine's role is tamper-evident audit + reactive containment, not pre-flight authorization. Pre-flight authorization at the tool layer is handled by `packages/mcp/src/auth.ts` (tier + permission checks) and at the request layer by the RBAC / ABAC engine.

A separate pre-execution policy gate at the MCP dispatch boundary is on the roadmap (§7). Until it ships, anyone needing strict pre-flight enforcement for a new tool category should add the check in the MCP server itself.

### 4.2 Empty-policy default is silent allow

When `AuditPolicyEngine.policies` is empty (no policies registered), `evaluate()` returns `{ violations: [], alerts: [], shouldHaltAgent: false, shouldHaltAll: false }` — i.e., no violations, no halts.

This is the correct default for an audit-driven engine (no false positives on startup) but it means policy coverage is *opt-in*. The five built-ins in `policy.ts:119–245` (`toolCallRateLimit`, `selfModificationBlock`, `consecutiveFailures`, `deniedToolAccess`, `fleetMemoryFlood`) must be explicitly registered at boot. Verify your deployment loads them; a deployment that wires up the engine without registering policies is silently un-governed.

### 4.3 Socket-bound agent identity in the RevDev daemon

`@revealui/harnesses` and the RevDev daemon (`revdev/packages/daemon/src/server.ts:61`) bind agent identity at socket-connect time via `session.register` / `session.attach`. Subsequent RPCs on the same socket inherit the bound identity without per-call cryptographic verification. Two agents sharing a host can co-mingle if socket isolation fails.

DID + Ed25519 per-RPC signature verification is on the roadmap (§7).

### 4.4 npm publish provenance is SLSA Level 2, not Level 3

Publishes to npm produce Sigstore-signed SLSA Build Level 2 provenance via OIDC trusted publishing (`release.yml`, no long-lived `NPM_TOKEN`). What is not yet produced: SLSA Level 3 hermetic/isolated builds and per-step in-toto link files across the full build graph. Dependency hygiene is additionally enforced via pinned overrides, Dependabot, CodeQL, and Gitleaks.

### 4.5 No marketplace yet — extension surface is in-tree only

All MCP servers in `packages/mcp/src/servers/` are first-party. There is no third-party MCP marketplace today. When one ships, tool-poisoning / typosquatting / hidden-instruction detection becomes a hard requirement at the server-registration boundary; see §7.

## 5. Trust assumptions requiring defense-in-depth

Listed so customers and integrators know where the stack stops and their controls must start.

| Layer | Assumption | Customer / operator responsibility |
|-------|-----------|-----------------------------------|
| Infrastructure isolation | Agents run in isolated containers / VMs | Operator runs each agent in a separate container; network policy restricts blast radius |
| Short-lived external credentials | API keys handed to agents have TTL + rotation | Operator configures upstream IAM (AWS STS, GCP short-lived tokens, etc.) |
| LLM provider trust | The LLM provider does not exfiltrate prompts or completions | Operator picks providers with appropriate data-handling agreements; the fleet runtime uses open-source models on local inference for exactly this reason |
| Browser security | User-side browsers honor CSP / SameSite / HSTS | Standard browser threat model |
| Time source | System clock is monotonic and accurate within bounded skew | NTP / chrony on the host |
| Revvault unlock secret | The operator's age identity is secured outside this system | Operator keeps `~/.age-identity/keys.txt` (or equivalent) under hardware-backed encryption |
| OS kernel | Host kernel is patched and unprivileged code cannot escape its container | Operator runs current LTS kernel, enables seccomp / AppArmor |

If any of these assumptions is violated, controls in this stack may fail in ways the stack cannot detect.

## 6. Known footguns and configuration risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| Engine registered, no policies loaded | `AuditPolicyEngine` is wired but `builtinPolicies.*()` are never registered → silent no-op | Confirm policy registration in your boot path. Future: a `gate` check that fails CI if the audit engine has zero policies in production config. |
| Missing CSRF token on a new admin route | New state-changing admin route added without the CSRF middleware | The CSRF middleware is the default for admin routes; if you build a route that bypasses the default, document why |
| `overrideAccess` query param leak | Untrusted code path forwards `overrideAccess` from request → DB layer | The proxy strips `overrideAccess` from external requests; do not re-introduce it downstream |
| Custom MCP server bypassing tier checks | A new MCP server that doesn't use `packages/mcp/src/auth.ts` | All MCP servers must go through the shared auth wrapper. Future: registration-time linter that fails if a server skips auth |
| Revvault path collision across products | Same path used for two different secrets across `revealui/*` and a sibling product | Revvault `detect_path_collisions()` runs pre-sync (revvault#40); failures block sync |
| Sentry DSN absent in production | Errors disappear silently in production-hosted | `SENTRY_DSN` is required at boot in production (GAP-S1, revealui#787) |
| Webhook signature verification disabled | Stripe webhook handler accepts unsigned requests | `STRIPE_WEBHOOK_SECRET` must be present; the webhook handler refuses unsigned events in production mode |

## 7. Roadmap items that will narrow these limits

Tracked in the internal coordination hub's master plan. Cited here so the limitations above are not perceived as final.

- **Pre-execution policy gate at the MCP dispatch boundary** — moves `AuditPolicyEngine`-style checks from post-execution to pre-execution at the tool layer. Closes §4.1.
- **DID + Ed25519 RPC signing for the RevDev daemon** — per-call cryptographic identity verification. Closes §4.3.
- **MCP Security Scanner at server registration** — tool-poisoning / typosquatting / hidden-instruction detection before a third-party MCP server can expose a tool. Required before marketplace opens. Closes §4.5.
- **AI Bill of Materials (AI-BOM)** — model name, weights SHA-256, source registry, fine-tuning lineage, dataset cards, signature. Supports EU AI Act Article 53.
- **SLSA Level 3 npm publishes.** Hermetic builds and per-step in-toto attestations on top of the SLSA Level 2 provenance that already ships via OIDC trusted publishing. Narrows §4.4 (Level 2 provenance is live).

## 8. Document maintenance

This document is reviewed:

- After any P0 or P1 incident that exposes a gap not currently disclosed here
- When a roadmap item in §7 ships (the corresponding limitation is moved from §3 / §4 to a "Historical limitation, closed YYYY-MM-DD" appendix)
- At minimum, every 6 months

Last reviewed: 2026-05-16.

For the threat model that informs these limitations, see [THREAT_MODEL.md](./THREAT_MODEL.md).
For vulnerability reporting, see [/SECURITY.md](/SECURITY.md).
For incident response procedures, see [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).
For the active security policy, see [INFORMATION_SECURITY_POLICY.md](./INFORMATION_SECURITY_POLICY.md).
