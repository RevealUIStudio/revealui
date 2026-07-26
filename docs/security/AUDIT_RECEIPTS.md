---
visibility: public
status: verified
title: "Audit receipts (GAP-355 Stage 4)"
description: "What signed rows, Merkle roots, and offline verify mean by tier"
category: security
audience: developer
---

# Audit receipts

How RevealUI proves agent and admin actions, what Free vs Max get, and how to check a root without calling us.

## Honesty table (Stage 4)

| Surface | Free / Pro | Max+ |
|---------|------------|------|
| Append-only signed `audit_log` rows | Yes (when signing is configured) | Yes |
| Published public key (`GET /api/audit/public-key`) | Yes | Yes |
| Per-row offline verify (signature + public key) | Yes | Yes |
| Worker Merkle roots over ranges | No | Yes (`audit_anchors`) |
| Download roots + inclusion proofs (`GET /api/audit/anchors*`) | 403 | Yes |
| Offline CLI (`pnpm verify:audit-anchor`) | Yes (if you hold a root from somewhere) | Yes |
| **Verification as a paid product** | Never | Never |

Checking a receipt is free. **Root delivery** (the customer holds a sealed Merkle root for a `seq` range) is Max via the `auditLog` feature flag.

Positioning foil: "If an agent did it, there's a receipt." That is true for Max customers with delivered roots and for row-level signatures everywhere signing is on. It is **not** a free-tier claim that every plan already downloads sealed range roots.

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
- Claims ledger: https://revealui.com/claims
