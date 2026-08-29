---
title: "ADR-009: Audit receipts genesis (pre-customer epoch start)"
description: "TRUNCATE audit_log and audit_anchors once before paying customers so the live receipt chain has no unsigned floor"
visibility: public
status: accepted
audience: developer
---

**Date:** 2026-08-29  
**Status:** Accepted  
**Lane:** secret-path-hardening  
**Related:** GAP-355 receipts; GAP-417 unsigned production rows; GAP-486 fleet genesis scan

## Context

Production `audit_log` still has 177 unsigned rows (system-scope, interleaved through seq 1-9468). GAP-417 rails already refuse **new** unsigned production writes. The unsigned count is not growing.

`docs/security/AUDIT_RECEIPTS.md` forbids retro-signing: a backfilled signature is indistinguishable from tampering. A live second table is a second door.

There are no paying customers. A permanent legacy floor through seq 9468 is a pre-launch scar, not a security property we want to carry into first sale.

Migration 0026's append-only trigger blocks UPDATE and DELETE. TRUNCATE is intentionally not blocked (owner DDL; the row trigger does not fire).

## Decision

**Receipts genesis, once, before first paying customer.**

1. Optional cold dump of `audit_log` + `audit_anchors` to the fleet archive (a file, not a live query path).
2. `TRUNCATE audit_log, audit_anchors RESTART IDENTITY` in one statement (both tables; leftover anchors over vanished seqs would be worse than unsigned rows).
3. Keep GAP-417 signed-only rails. Next append is seq 1 and signed.
4. Legacy-floor **code** stays as a backstop if unsigned rows ever appear again. After genesis, production should not need it.
5. After the first paying customer, genesis is forbidden without a new ADR (legal/forensic bar).

Rejected:

| Option | Why not |
|--------|---------|
| Retro-sign the 177 | Receipt doctrine: looks like tamper |
| Live `audit_log` v2 | Dual-home; every reader can pick the wrong table |
| Accept the floor forever | Wrong before first customer; owner rejected |
| Truncate `audit_log` only | Orphan `audit_anchors` roots |

## Operator path

Dry-run (default):

```bash
revvault run --env POSTGRES_URL=revealui/prod/db/postgres-url -- \
  pnpm genesis:audit-receipts
```

Apply (owner):

```bash
AUDIT_RECEIPTS_GENESIS_CONFIRM=TRUNCATE_AUDIT_LOG_AND_AUDIT_ANCHORS \
revvault run --env POSTGRES_URL=revealui/prod/db/postgres-url -- \
  pnpm genesis:audit-receipts -- --apply --attest-no-paying-customers
```

Script: `scripts/security/audit-receipts-genesis.ts`. Fail-closed without both the confirm env and the attest flag. Never prints the database URL.

## Consequences

- Live unsigned count becomes 0. Seq restarts at 1.
- Pre-genesis dogfood history is gone from the live chain (cold dump if taken).
- GAP-417 can close after a post-apply count-only verify.
- GAP-486 tracks the rest of the fleet (Stripe, other Neon tables, RevDev, RevForge, Agency). Do not wipe revvault.
