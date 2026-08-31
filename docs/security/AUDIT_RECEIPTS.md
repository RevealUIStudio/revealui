---
visibility: public
status: verified
title: "Audit receipts (GAP-355 Stage 4)"
description: "What signed rows, Merkle roots, and offline verify mean by tier"
category: security
audience: developer
---

# Audit receipts

How RevealUI proves agent and admin actions, what Free vs Pro get, and how to check a root without calling us.

## Honesty table (Stage 4)

| Surface | Free | Pro+ |
|---------|------|------|
| Append-only signed `audit_log` rows | Yes (when signing is configured) | Yes |
| Published public key (`GET /api/audit/public-key`) | Yes | Yes |
| Per-row offline verify (signature + public key) | Yes | Yes |
| Worker Merkle roots over ranges | No | Yes (`audit_anchors`) |
| Download roots + inclusion proofs (`GET /api/audit/anchors*`) | 403 | Yes |
| Offline CLI (`pnpm verify:audit-anchor`) | Yes (if you hold a root from somewhere) | Yes |
| **Verification as a paid product** | Never | Never |

Checking a receipt is free. **Root delivery** (the customer holds a sealed Merkle root for a `seq` range) is Pro via the `auditLog` feature flag.

Positioning foil: "If an agent did it, there's a receipt." That is true for Pro customers with delivered roots and for row-level signatures everywhere signing is on. It is **not** a free-tier claim that every plan already downloads sealed range roots.

## Building blocks (code)

| Piece | Path |
|-------|------|
| Row Ed25519 sign / verify | `packages/security/src/audit-signing.ts` |
| Merkle + inclusion proofs | `packages/security/src/audit-merkle.ts` |
| Offline pure verify | `packages/security/src/audit-anchor-verify.ts` |
| Table | `packages/db/src/schema/audit-anchors.ts` |
| Worker sweep | `apps/server/src/jobs/audit-anchor-sweep.ts` |
| API list + proof | `apps/server/src/routes/audit.ts` |
| CLI | `pnpm verify:audit-anchor` |

## Lag

`GET /api/audit/anchors` returns a `lag` object:

- `lastAnchoredSeqTo`
- `unanchoredSignedCount`
- `oldestUnanchoredAt`
- `legacyFloor` (the pre-enforcement floor for this tenant, 0 when there is no legacy era)
- `preFloorSignedCount` (signed rows at or below the floor: row-verifiable, never in a root)

Until the worker seals the tail (batch size or max lag), those signed rows are real but not yet in a customer-held root. UI and copy should not treat the foil as true for the unanchored tail. The `unanchoredSignedCount` tail covers rows above the last anchor only; rows below the floor are reported separately via `preFloorSignedCount`, never counted as unanchored tail.

## Legacy floor (pre-enforcement rows)

Anchors attest the signed era only. A deployment that wrote audit rows before signed writes were enforced carries a closed legacy era: unsigned rows, sometimes interleaved with early signed rows. Every unsigned row is a permanent hole in the sequence, so the sweep derives a per-tenant floor (the highest unsigned `seq`) and anchors from `floor + 1` forward. The floor is only consulted while a tenant has no anchors at all.

Below the floor:

- Unsigned legacy rows are never retro-signed. A backfilled signature would be indistinguishable from tampering, which is the exact failure receipts exist to prevent.
- Signed rows interleaved below the floor remain verifiable per row with the offline check, but no Merkle root covers them.

The floor never spans live history. A `seq` hole that appears above an existing anchor still stalls the sweep and raises the gap metric.

## System scope (GAP-427 ruling 2026-07-27)

Not every audit row has a tenant. System and operator-level events (agent
spawns outside an account context, platform-level actions) write `audit_log`
rows with `tenant = null`. Those rows anchor too: each sweep runs one
additional pass, after the per-tenant loop, that anchors them under the
reserved `__system__` scope. `audit_anchors.tenant` carries the
`SYSTEM_ANCHOR_SCOPE` ('__system__') sentinel value for these anchors (the
column is `NOT NULL`); `audit_log.tenant` itself is untouched and stays null
on the underlying rows.

The system pass is not entitlement-gated (`auditLog`/Pro+ is a per-account
check; system events are the operator's own audit trail, not a customer's)
and never writes a usage meter (no account FK backs a null tenant).

The same legacy-floor semantics apply: while the system scope has zero
anchors, the sweep derives a floor from the highest **unsigned** null-tenant
row and anchors from `floor + 1` forward. Rows at or below that floor are
pre-enforcement legacy rows and are never retro-signed, for the same reason
as the per-tenant floor above.

## Pre-customer genesis (ADR-009)

Before the first paying customer, the operator may start a **receipts epoch**
instead of carrying an unsigned floor forever:

- Do not retro-sign unsigned rows.
- Do not open a second live `audit_log` table.
- Optional cold dump of `audit_log` + `audit_anchors` (archive file, not a
  live query path).
- `TRUNCATE audit_log, audit_anchors RESTART IDENTITY` (both tables; leftover
  roots over vanished seqs are worse than unsigned rows).
- GAP-417 signed-only rails stay. Next append is seq 1 and signed.

Operator: `pnpm genesis:audit-receipts` (dry-run). Apply requires
`AUDIT_RECEIPTS_GENESIS_CONFIRM` and `--attest-no-paying-customers`. After
the first paying customer, genesis needs a new ADR.

Fleet-wide other stores (Stripe, other Neon tables, RevDev, RevForge, Agency)
are GAP-486, not this truncate.

## Offline verify

```bash
pnpm verify:audit-anchor -- \
  --public-key ./audit-public.pem \
  --anchor ./anchor.json \
  [--proof ./proof.json]
```

No network. No database. Exit 0 only if the root signature (and optional inclusion proof) verify.

Public key source: `GET /api/audit/public-key` or revvault `revealui/prod/audit/signing-public-key` (see `docs/SECRETS.md`).

## Related

- Stage design: private gap-spec GAP-355 Stage 4
- Secrets: `docs/SECRETS.md` (audit signing key pair)
- Claims ledger: moved to the docs site (this tree)
