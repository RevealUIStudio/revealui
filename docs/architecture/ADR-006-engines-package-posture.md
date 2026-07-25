---
title: "ADR-006: @revealui/engines package posture (incubate, not app entry)"
description: "Fleet-redundancy Phase 3 / C10 — honest status for the five-primitives facade"
visibility: public
status: accepted
audience: developer
---

**Date:** 2026-07-23  
**Status:** Accepted  
**Lane:** fleet-redundancy Phase 3 (C10)  
**Related:** ADR-003 Fair Source; remediation spec `2026-07-20-fleet-redundancy-remediation` §Phase 3

## Context

`@revealui/engines` was marketed as the unified entry for the five business primitives (`users`, `content`, `products`, `payments`, `agents`). A 2026-06-27 reaudit and 2026-07-23 re-verify found:

- **Zero production app importers** of `@revealui/engines` (apps import `@revealui/auth`, `@revealui/db`, `@revealui/services` directly).
- Package is `"private": true` and **not published on npm** (already noted in `docs/FAIR_SOURCE.md` / `docs/PRO.md`).
- References remain in Pro package lists and claims copy as a Fair Source / Pro package.

Keeping silent “the one import” framing while apps bypass the facade is claims and architecture drift.

## Decision

**Option C — Incubate (default).** Do **not** migrate apps onto the facade in this program.

1. **Honest package posture:** engines is an **incubating** unified barrel for future consumers and external kit experiments. It is **not** the required application entry point today.
2. **Keep the package** in the monorepo under FSL-1.1-MIT; keep `private: true` until a real consumer and publish decision exist.
3. **Claims / docs:** may list engines as a Pro/FSL package and as optional unified barrel; must **not** claim apps “import the five primitives from `@revealui/engines`” until that is true.
4. **Optional honesty check (Phase 6):** if marketing claims “engines as the app entry,” fail claim-drift or add a consumer-count check.

### Rejected alternatives

| Option | Why not now |
|--------|-------------|
| **A — Adopt** (migrate apps onto engines) | Multi-PR blast radius; no product urgency; apps are healthy on direct imports |
| **B — Abandon** (delete package / strip from Pro lists) | Package is useful as a composed surface for kits; deletion is premature |

## Consequences

- Apps continue importing leaf packages; no forced refactor.
- Fleet-redundancy C10 closes as **decision recorded**; no code migration in this ADR.
- Future “adopt engines” requires a separate ADR with a migration plan and claim updates in the same PR train.

## Verification

- `grep` for production imports of `@revealui/engines` remains empty outside `packages/engines` and tests (code-over-docs).
- **Phase 6 gate:** `pnpm validate:engines-posture` (CI phase 1) fails on app importers, non-private package.json, or surface docs that call engines the unified app entry without incubating/optional language.
- Package README / index comment state incubating posture (same change set as this ADR or immediate follow-up).
