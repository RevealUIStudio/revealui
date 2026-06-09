---
visibility: public
status: verified
title: "Audit Chain"
description: "Tamper-evident audit log — how RevealUI signs every action so the record cannot be altered without detection"
category: security
audience: developer
---

Every action by every human and every agent signs into an append-only `audit_log` table with an HMAC-SHA256 hash chain. Tampering with any row breaks the chain. This page documents the schema, the signing semantics, and how to verify the chain.

## Schema

The schema lives at [`packages/db/src/schema/audit-log.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/db/src/schema/audit-log.ts). It is append-only — no UPDATE or DELETE should ever be performed against it.

| Field | Type | Purpose |
|---|---|---|
| `id` | text (UUID) | Unique entry ID |
| `timestamp` | timestamp with TZ | When the event occurred |
| `event_type` | text | e.g. `agent:task:started`, `agent:tool:called` |
| `severity` | text (`info` / `warn` / `critical`) | CHECK-constrained at the DB level |
| `agent_id` | text | The principal that triggered the event (human or agent) |
| `task_id` | text (nullable) | Task correlation if applicable |
| `session_id` | text (nullable) | Session or orchestration run ID |
| `payload` | jsonb | Event-specific data |
| `policy_violations` | jsonb (text[]) | Policy IDs triggered by this event |
| `signature` | text (nullable) | HMAC-SHA256 signature for tamper detection |
| `previous_signature` | text | Signature of the prior entry — the chain link |

`signature` is nullable for backwards compatibility with rows that predate the chain. New writes always include both signatures.

## Algorithm

**HMAC-SHA256.** The algorithm is hardcoded — there is no `hash_algorithm` field. The convention is captured in the schema's source comment:

> `/** HMAC-SHA256 signature for tamper detection (nullable for backwards compat) */`

If the algorithm ever rotates, both the new and old chains stay verifiable through their respective key generations.

## How the chain works

Each entry's `signature` is an HMAC-SHA256 over its own row content combined with the previous entry's `signature`. Tampering with any row breaks two things at once:

1. The row's own `signature` no longer matches its content (HMAC verification fails on read).
2. The next row's `previous_signature` no longer matches this row's `signature` (chain link fails on chain walk).

The chain is verifiable in two directions:

- **Forward walk** — verify each entry's HMAC against its content, then check that the next entry's `previous_signature` matches the current entry's `signature`.
- **Backward walk** — start at the most recent entry, verify back to the genesis row.

## What signs in

Every mutation across the five primitives writes a row:

- **Users** — auth events, RBAC role changes, GDPR consent and deletion events.
- **Content** — collection mutations, draft/live transitions, media uploads.
- **Products** — catalog edits, pricing tier changes, license events.
- **Payments** — Stripe webhook events, subscription transitions, refunds.
- **Intelligence** — agent task lifecycle (`started`, `tool:called`, `completed`, `errored`), policy violations, memory writes.

Agents and humans use the same signing path. There is no separate "agent audit" surface — they are principals on the same chain.

## Tamper-detection guarantees

- **Detectable, not preventable.** Anyone with database write access can append rows; the chain proves whether existing rows have been altered. Combine with row-level security and database-user separation for prevention.
- **Append-only at the application layer.** No application code path writes UPDATE/DELETE against `audit_log`. In production, enforce this at the database layer by revoking UPDATE/DELETE privileges on the application's connection role.
- **HMAC key isolation.** The signing key lives outside the database. Rotating the key rotates the chain forward — the historical chain remains verifiable under the prior key generation.

## Related code

- [`packages/db/src/schema/audit-log.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/db/src/schema/audit-log.ts) — the schema source of truth.
- [`packages/security/src/audit.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/security/src/audit.ts) — security-event emission layer (auth, user, data, GDPR event types).

## Further reading

- [ARCHITECTURE.md §Security & Access Control](../ARCHITECTURE.md#security--access-control) — broader security architecture
- [methodology.md](../methodology.md) — engineering postures (audit-first SDLC, verify-before-claim)
- [technology-stack.md](./technology-stack.md) — full tech stack reference
