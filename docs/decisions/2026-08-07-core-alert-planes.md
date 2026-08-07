---
title: "Core alert planes: monitoring vs observability vs cron"
description: "Document intentional ownership of the three alert surfaces in @revealui/core so agents do not merge them blindly or reintroduce dual cron paths."
visibility: public
status: verified
audience: maintainer
owner: RevealUI Studio
last_verified: 2026-08-07
---

# ADR: Core alert planes (monitoring vs observability vs cron)

**Date:** 2026-08-07  
**Status:** Accepted  
**Related:** fleet-redundancy C12 residual (2026-08-07 audit); cron SSOT already in `observability/cron-failure-alert`

## Context

The 2026-08-07 fleet redundancy audit flagged two files both named `alerts.ts` under `@revealui/core`:

| Path | Primary export | Known consumer |
|------|----------------|----------------|
| `monitoring/alerts.ts` | `sendAlert` / `sendAlerts` / `alertManager` | `apps/admin` health-monitoring route |
| `observability/alerts.ts` | `AlertingSystem` / `alerting` | `apps/server` bootstrap |
| `observability/cron-failure-alert.ts` | `sendCronFailureAlert` | admin + server cron jobs |

Raw scans treat basename collisions as debt. These three surfaces are **not** the same product: one is ops/health delivery, one is rule/threshold evaluation, one is the cron failure fan-out already consolidated.

## Decision

**Keep three intentional planes with fixed ownership.** Do not invent a fourth path. Do not reintroduce admin/server dual cron helpers.

### 1. Cron failures — single module

Use **only** `@revealui/core/observability/cron-failure-alert` (`sendCronFailureAlert`).  
Apps inject Sentry + optional email. No parallel `cron-alert.ts` / `cron-alerts.ts` in apps.

### 2. Observability rules — `AlertingSystem`

Use **`@revealui/core/observability/alerts`** when you need named rules, cooldowns, channels, and firing/resolved lifecycle (server runtime thresholds).

### 3. Monitoring / process health delivery — `sendAlert`

Use **`@revealui/core/monitoring`** (`sendAlert` / `sendAlerts`) for process-health and ops-style alert delivery already wired through the monitoring package (admin health-monitoring).

### Import guidance

| Need | Import |
|------|--------|
| Cron job failed | `cron-failure-alert` |
| Metric rule fired / resolved | `observability/alerts` (`AlertingSystem`) |
| Process/health ops alert | `monitoring` (`sendAlert`) |

## Consequences

### Positive

- Agents stop treating the basename collision as accidental clone debt.
- Cron dual cannot return under "just mirror admin into server."
- Future consolidation (if any) has a clear target map.

### Negative / deferred

- Two `Alert`-shaped types remain in different planes (monitoring types vs observability types). Full type unify is design-class and out of scope here.
- Call sites must pick the plane consciously; a single mega-export would hide the wrong default.

## Out of scope

- Folding `monitoring/alerts` into `AlertingSystem` (behavior + Sentry DI differ).
- Changing presentation or AI deprecation paths.
