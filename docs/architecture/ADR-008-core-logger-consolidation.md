---
title: "ADR-008: Core logger consolidation (canonical + legacy surfaces)"
description: "Fleet-redundancy C3 — decide the canonical structured logger and how to retire core-internal duplicates without breaking isolation"
visibility: public
status: accepted
audience: developer
---

**Date:** 2026-07-24  
**Status:** Accepted  
**Lane:** fleet-redundancy Phase 3 parallel (C3)  
**Related:** remediation spec `2026-07-20-fleet-redundancy-remediation` §C3; Phase 4 logger note in the same spec

## Context

Fleet-redundancy audits (2026-06-09, 2026-06-27 re-verify) flagged **logger triplication** as high severity. Re-audit against code on 2026-07-24 shows **four intentional-or-accidental surfaces**, not one mess:

| Surface | Path | Role | Production importers (approx.) |
|---------|------|------|--------------------------------|
| **Canonical structured** | `@revealui/utils/logger` | Full `Logger` class, `child()`, handlers, `LogLevel` includes `fatal` | `db`, `security`, `services` email, via re-export below |
| **Core facade** | `@revealui/core/observability/logger` | Re-exports utils + core helpers (`createRequestLogger`, `logPerformance`, …) | Heavy: `ai`, `mcp`, `services` stripe, admin/server patterns |
| **Legacy instance** | `packages/core/src/instance/logger.ts` | Varargs `RevealUILogger`; silences info/warn in production | **8** core modules (`revealui.ts`, `api/rest`, database, storage, collections update, …) |
| **Legacy client/server pair** | `packages/core/src/utils/logger-client.ts` + `logger-server.ts` | Client-safe console logger vs server logger with request-id via `async_hooks` | monitoring (`zombie-detector`, `alerts`, `cleanup-manager`); barrel `core/utils/logger` → client; `core/server` re-exports server |
| **Isolated CLI** | `packages/setup/src/utils/logger.ts`, `packages/scripts/logger.ts` | Colored CLI loggers; `LogLevel` includes `silent` | setup + scripts only |

### LogLevel divergence (code-over-docs)

| Source | Union |
|--------|--------|
| `@revealui/utils/logger` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` |
| `core/utils/logger-client` / `logger-server` | `'debug' \| 'info' \| 'warn' \| 'error'` |
| setup / scripts | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` |

### What is intentional

- **setup / scripts** loggers: package isolation (no dependency on `@revealui/utils`). Same class of decision as scripts avoiding a reverse dep on db through shared pg-pool helpers. **Do not** route them through utils.
- **observability/logger re-export of utils**: already the right long-term shape for app/package consumers of core (breaks circular deps; documented in-file).

### What is accidental debt

- **instance/logger** vs **utils/logger-{client,server}** vs **utils/logger (structured)** inside `@revealui/core`: three runtime behaviors for the same product need (console logging with optional context).
- **client/server pair** does not share implementation with `@revealui/utils/logger` (no child loggers, no fatal, different silencing rules).
- **license.ts** imports `./utils/logger.js` (client re-export) while most of the monorepo uses `observability/logger` (utils).

A mechanical “delete two and re-export one” PR without this decision would either invert package edges or break client-bundle safety / request-id enrichment.

## Decision

### 1. Canonical logger (product code)

**Canonical structured logger:** `@revealui/utils/logger`.

**Preferred import for packages that already depend on core:**

```ts
import { logger, createLogger } from '@revealui/core/observability/logger'
```

That path remains a **thin facade** over utils (plus core-only middleware helpers). New code must not invent a fourth implementation.

**Packages that must not depend on core** (`db`, `security`, leaf utils consumers): import `@revealui/utils/logger` directly (already the case).

### 2. Explicit non-goals for setup/scripts

`packages/setup` and `packages/scripts` keep their own loggers indefinitely (or until a zero-dep shared **CLI** logger package is designed). They are **not** part of the core consolidation migration.

### 3. Deprecation path inside core (follow-up PRs, not this ADR)

| Step | Work | Acceptance |
|------|------|------------|
| **D1** | Mark `instance/logger.ts` and `utils/logger-client.ts` / `logger-server.ts` with `@deprecated` + ADR-008 pointer; keep behavior | tsc green; no behavior change |
| **D2** | Migrate `instance/logger` call sites to `observability/logger` (or inject `RevealUILogger`-compatible adapter) | core tests green; production silencing rules documented if changed |
| **D3** | Migrate monitoring + `core/server` exports from `logger-server` to observability/utils; preserve request-id enrichment via utils context or middleware | monitoring tests green; no client import of server logger |
| **D4** | Delete or reduce legacy modules to re-exports; collapse `core/utils/logger` barrel to client-safe facade over utils if still needed for browser | one structured implementation; claim/docs updated |

**Client-safe requirement:** any browser-reachable path must not import `logger-server` (Node `async_hooks`). Prefer `@revealui/core/utils/logger/client` only as a temporary alias until D3/D4; long-term client code should use a browser-safe subset of `@revealui/utils/logger` or a dedicated client entry if utils grows Node-only APIs.

### 4. LogLevel unification (follow-up)

- Keep **utils** as source of truth for structured levels (`fatal` included).
- Treat **silent** as a CLI-only concept (setup/scripts), not part of product `LogLevel`.
- Do not force `fatal` onto setup/scripts.

### 5. What this ADR does *not* authorize

- A single mega-PR rewriting all ~importers without D1 markers and per-step tests.
- Moving setup/scripts onto `@revealui/utils`.
- Changing production console silencing without an explicit product decision in the D2 PR description.

## Consequences

- **C3 closes as decision recorded.** Implementation is D1→D4, separately PR’d, base `test`.
- New core features should use `observability/logger` (or utils directly when core is not a dependency).
- Phase 4 “canonical utils logger for core variants” in the remediation spec is **this ADR’s D2–D4**, not a second design track.
- Agent rules that say “use `@revealui/utils` logger” remain correct for monorepo product packages; core-internal legacy paths are debt, not the recommended API.

## Verification (this change set)

- ADR-008 present under `docs/architecture/`.
- Legacy core logger modules carry a short header pointing at ADR-008 (no behavior change).
- Fleet-redundancy plan next-action no longer lists “write C3 ADR” as open design.

## Verification (future D2–D4)

- `grep` for `instance/logger` and `utils/logger-server` under `packages/core/src` (excluding tests and deprecation shims) trends to zero.
- Client-bundle safety gate remains green (no server logger on client graphs).
