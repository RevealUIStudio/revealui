---
title: "GAP-381 D-D — public connect-guide copy sign-off"
description: "Copy-voice and honesty checklist for Cursor/VS Code/ACP connect guides before treating them as customer-facing complete."
visibility: internal
status: verified
audience: maintainer
---

# GAP-381 D-D — public connect-guide copy sign-off

**Decision (design §8 D-D):** copy review for enforcement-tier and Cursor/Grok
data-flow caveats **before anything public ships**.

Guides are already on **main** (promote #2473). This sheet records agent review
plus owner countersign.

## Surfaces

| Doc | Path |
|-----|------|
| Cursor | `docs/guides/connect-cursor.md` |
| VS Code | `docs/guides/connect-vscode.md` |
| ACP | `docs/guides/connect-acp.md` |
| SECRETS aliases | `docs/SECRETS.md` (device-token paths) |

## Hardlines (agent + owner)

| Rule | Check | Agent 2026-08-08 | Owner |
|------|--------|------------------|-------|
| No em dashes in public copy | `no-em-dashes` | PASS (scan clean) | |
| Human voice / full clauses | `copy-voice` | PASS (guides use full sentences; "governed and audited" framing) | |
| RevealUI does not host frontier models | positioning | PASS (stated on Cursor/VS Code guides) | |
| Cursor closed-source + cloud-coupled | honesty | PASS (Honest limits section) | |
| Grok/Cursor training data caveat | honesty | PASS (connect-cursor) | |
| Receipts = RevealUI layer only | honesty | PASS | |
| User hooks advisory until org pin | I-5 / enforcement tier | PASS (Cursor + VS Code) | |
| Marketplace not required for VS Code | D-C honesty | PASS | |
| I-1 ACP identity display-only | ACP guide | PASS | |
| I-6 no collection bypass | ACP guide | PASS | |
| Token never in committed config | all three | PASS (`${env:}` / `${input:}`) | |
| Citations / claim lines where gated | validate:claims | PASS (PR #2469 iteration) | |

## Agent review notes (2026-08-08)

No further copy edit required for hardline compliance. Optional future polish
(not blockers): shorten Cursor hook JSON block with a "generate via CLI" callout
if a one-command generator is documented end-to-end for non-monorepo users.

## Owner countersign

Read the three guides aloud once. Confirm you would show them to a prospect.

| Field | Value |
|-------|--------|
| Owner | Joshua Vaughn (RevealUI Studio) |
| Date | 2026-08-09 |
| Result | APPROVE |

Session authorization: owner directed "do all optional leftovers" after live
Phase E walk A–D (including A5 honesty and D revoke/remint). Agent hardline
row stays PASS 2026-08-08; no REQUEST-CHANGES items.

On APPROVE, mark D-D complete in GAP-381.yml residual progress (done 2026-08-09).
