---
title: "Margin governor enforce runbook (GAP-256 PR-8)"
description: "Flag matrix, dispatch schedule, freshness SLO, and owner flip. Does not flip enforce."
visibility: internal
status: verified
audience: maintainer
---

# Margin governor enforce runbook

**Who:** Owner. Agents may land code with flags default **off**; they do not flip production enforce.

**Schedule SSOT:** `apps/server/vercel.json` has one cron: `GET /api/cron/dispatch` at `0 6 * * *`. Live API is Fly; the same dispatcher is the worker. Snapshot, COGS breaker, waitlist drain, and paid-pending expire are **children of dispatch**. Do not add a second `vercel.json` cron (Hobby one-cron limit + GAP-300).

## Flag matrix

| Env | Default | Effect |
|-----|---------|--------|
| `MARGIN_GOVERNOR_ENABLED` | `false` | Master. Off → admit always. |
| `MARGIN_GOVERNOR_SHADOW` | `true` when first enabling | Log mode; never waitlist/lean. |
| `MARGIN_SNAPSHOT_CRON_ENABLED` | `false` | Allow snapshot writes. |
| `COGS_BREAKER_ENABLED` | `false` | Layer 3 enforce. |
| `ADMISSION_WAITLIST_DRAIN_ENABLED` | `false` | Expire stale waitlist claim rows. |
| `ADMISSION_PAID_PENDING_EXPIRE_ENABLED` | `false` | Suspend unpaid `paid_signup` after TTL (default 48h). |
| `ADMISSION_PAID_PENDING_EXPIRE_HOURS` | `48` | TTL for unpaid paid-pending reclaim. |

`MARGIN_GOVERNOR_ENABLED=true` **and** `MARGIN_GOVERNOR_SHADOW=false` **requires all of:**

1. Snapshot job listed in dispatch (it is) and `MARGIN_SNAPSHOT_CRON_ENABLED=true`.
2. Waitlist schema + claim + **paid_signup** path (shipped).
3. Free entitlement@t0 (shipped).
4. Freshness: latest `margin_snapshots.computed_at` younger than stale hours (default 36h) for 48h continuous in staging.
5. Owner Q1 thresholds (`WAITLIST_FLOOR_CENTS` / lean) countersigned.

This PR does **not** flip shadow off. Enforce is owner ops after the SLO.

## Drain and reclaim

- Waitlist drain: pending/invited rows with `expires_at` in the past → `expired`. Tokens already fail claim when past `expires_at`; drain keeps the table small.
- Paid-pending expire: `source=signup`, `maxAgentTasks=0`, `aiLocal=false`, breaker not tripped, account still `active`, clock (`lastEventAt` else `updatedAt`) older than TTL → `accounts.status=suspended` and `metering_status=paused`. Stripe webhook paid rebuild is unaffected (`source=stripe` is skipped).

Both no-op unless their enable flags are `true`.

## Checkout smoke

See [`checkout-smoke-production.md`](./checkout-smoke-production.md) pre-flight: hosted signup must stay uncapped, and governor shadow must stay on during a revenue smoke so waitlist 202 cannot strand a paying tester.
