---
title: "ADR-007: C11 unwired subsystems — incubate MCPHypervisor, ai skills, ai observability"
description: "Fleet-redundancy Phase 3 / C11 residual — honest status for built-but-unwired MCP and AI surfaces"
visibility: public
status: accepted
audience: developer
---

**Date:** 2026-07-23  
**Status:** Accepted  
**Lane:** fleet-redundancy Phase 3 (C11 residual INCUBATE)  
**Related:** ADR-006 engines posture; remediation spec `2026-07-20-fleet-redundancy-remediation` §C11

## Context

Fleet-redundancy C11 triaged built-but-unwired subsystems. DELETE/WIRE subsets shipped (requireMfa, SecurityAlertService, legacy Supabase MCP deleted, cache edge, paywall server adapters, core in-memory tracing). Residual surfaces still present in tree:

| Surface | Code | App runtime path (2026-07-23) |
|---------|------|-------------------------------|
| `MCPHypervisor` | `packages/mcp/src/hypervisor.ts` | No app constructs or starts the singleton; tools/tests + optional AI adapter interface only |
| `@revealui/ai/skills` | `packages/ai/src/skills/` | Exported; no app imports the skills registry/loaders as a product path |
| `@revealui/ai/observability` | `packages/ai/src/observability/` | Exported; package-internal / tests, not app-mounted |

Marketing and package copy still describe the MCP hypervisor as the live agent tool path. That overstates current wiring (code-over-docs).

## Decision

**Incubate (do not wire, do not delete) in this program.**

1. **Keep the code.** Hypervisor, skills, and AI observability remain in the monorepo under their existing licenses (FSL for mcp/ai). They are valid library surfaces for future WIRE tickets and external kits.
2. **Honest posture:** each surface is **incubating / not app-mounted**. Product and admin paths that need MCP or agent tooling today use explicit launchers, `revealui-mcp`, or app-local wiring — not a process-wide hypervisor bootstrap.
3. **Claims / docs:** may name hypervisor, skills, and AI observability as **framework capabilities that exist in source**. Must **not** claim production apps “run the MCP hypervisor” or “load agent skills via `@revealui/ai/skills`” until a consumer path is greppable in `apps/`.
4. **No silent wire.** Mounting the hypervisor at app startup, or registering skill catalogs in product routes, is a separate WIRE ticket with product acceptance — not a side effect of this ADR.

### Rejected for this residual

| Option | Why not now |
|--------|-------------|
| **WIRE** (start hypervisor in server/admin) | Product design + credential resolver + metering ownership; multi-session |
| **DELETE** | Large tested surface; AI adapter still types against a tool source; premature |

## Consequences

- C11 residual INCUBATE closes as **decision recorded + honesty markers**.
- Future WIRE PRs must update claims and this ADR status (or supersede) in the same train.
- Phase 3 parallel work (C3 logger ADR, C5 `createVitestConfig`) is unaffected.

## Progress — GAP-406 WIRE (2026-07-24)

**WIRE train** (opt-in; default process still no-op when env unset):

| Item | Status |
|------|--------|
| Opt-in env `REVEALUI_MCP_HYPERVISOR=1` | Shipped — sinks on process singleton |
| `setUsageMeterSink` → `usage_meters` | Shipped when `tenantId` present on event |
| `setAuditSink` → `recordMcpToolAudit` | Shipped |
| Process-local spawn | Phase 2: `REVEALUI_MCP_HYPERVISOR_SPAWN=1`; default servers `contracts,docs`; override via `REVEALUI_MCP_HYPERVISOR_SERVERS` |
| Credential resolver | Phase 3: vault path `mcp/<tenant>/<server>/env` (JSON env map); missing → null |
| `@revealui/ai/skills` | Phase 4: `REVEALUI_AI_SKILLS=1` → `AgentSkillProvider` on agent-stream runtime |
| `@revealui/ai/observability` | Phase 4: `REVEALUI_AI_OBSERVABILITY=1` → `AgentEventLogger` on agent-stream start |

`validate:incubate-posture` allowlists wire modules under `apps/server/src/lib/*-wire.ts` (and agent-stream consumer for skills/observability).

## Verification

- Production mounts of incubating surfaces go only through allowlisted GAP-406 wire modules (env-gated).
- Package headers still note library surfaces; app default remains off without env flags.
- **Phase 6 gate:** `pnpm validate:incubate-posture` fails on non-allowlisted app imports. Standing ticket: GAP-406 (close when residual product follow-ups done or abandoned).
- **Clone advisory:** `pnpm audit:clones` reports exact multi-file clones under `packages/` (optional prevention; advisory exit 0).
- **Follow-up (not this train):** tenant spawn env isolation (avoid host `process.env` merge); deeper skill catalog install; durable event storage for observability.
