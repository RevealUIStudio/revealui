---
title: "ADR: Collab Snapshot Durability — In-Process Debounce + Durable Queue Backup"
description: "Closes the pod-crash data-loss window on Yjs snapshot persistence by hedging the in-process setTimeout debounce with a durable queue-backup job (Option C)."
visibility: public
status: verified
audience: developer
---

**Date**: 2026-06-13
**Status**: Accepted (approach) — implementation deferred until prod evidence warrants
**Deciders**: RevealUI Studio (single-founder)
**Tracking issue**: [revealui#486](https://github.com/RevealUIStudio/revealui/issues/486)

---

## Context

`apps/server/src/collab/room-manager.ts` persists Yjs document snapshots via a per-room in-process debounce: each incoming edit clears any pending `setTimeout` and starts a new `DEBOUNCE_MS` timer, so one save fires after the last edit in a burst. That is correct debounce semantics, but a pod crash during the debounce window loses every edit since the last successful save — seconds of user work.

This ADR records the durability decision deliberated in revealui#486. It is not a bug fix: the existing debounce works. It closes the crash window.

## Why the obvious queue migration is wrong

`enqueue(..., { idempotencyKey: documentId, delayMs })` is backed by `ON CONFLICT DO NOTHING`, which is **leading-edge throttle, not debounce**: the save fires `DEBOUNCE_MS` after the *first* edit of a burst, and subsequent edits aren't re-saved until the next burst — user-work-loss in the common type/pause/type pattern. The durable-queue primitive is "each job runs once, idempotently"; debounce is "each scheduled job supersedes the previous." Different primitive.

## Options considered

- **A — Leading-edge throttle (accept the semantic change).** Smallest change, reuses the queue primitive directly, but saves don't re-fire until the next burst = data loss. **Rejected** — unacceptable for collab.
- **B — Delete-pending-job + re-enqueue per edit.** Preserves debounce but costs two DB round-trips per edit on a high-frequency hot path, races between concurrent producers, and defeats the queue's idempotency story. **Rejected** unless C and D both fail.
- **C — Hedge: keep in-process debounce AND add a durable backup job (chosen).** Preserve the `setTimeout` debounce for low-latency saves; additionally enqueue a `collab.persist` job with a long `delayMs` (~30s) on every edit. The debounce wins the happy path; the queued job fires only if the pod crashed before the debounce completed, and no-ops when `doc.updatedAt` is already fresh. Matches the "belt and suspenders" pattern used for the cron safety-net (the no-op-on-already-done handler from revealui#479).
- **D — Postgres LISTEN/NOTIFY durable debounce.** Truly durable but needs a long-lived listener process Vercel serverless can't host (a sidecar). Bigger scope. **Deferred** — only if C proves insufficient.
- **E — Event-sourced on `collab_edits` with materialized snapshots.** Zero crash loss + natural audit trail, but adds read-latency (replay), snapshot-compaction complexity, and a room-manager rewrite. **Deferred** as the long-term architectural story; tracked separately, does not block C.

## Decision

Adopt **Option C** as the v1 durability approach when the crash window is closed. The provenance direct-write logger (revealui#485) already makes edit *history* durable (the audit trail); this decision is specifically about snapshot durability — complementary, not overlapping.

**Implementation is deferred.** The existing debounce is not broken; build Option C when there is a reason to believe pod crashes are losing meaningful collab work in prod (empirical log evidence or a paying-customer report). On rollout, measure how often the queue-backup job performs a non-no-op save: >0/week justifies the crash-recovery path; 0/month → document C as stable and close the tracker.

## Consequences

- The `collab.persist` handler must compare `doc.updatedAt` to the job's edit timestamp and no-op when the debounce already won.
- One extra queue write per edit (acceptable; the write is cheap and off the user-visible latency path).
- Option E remains the long-term durable story if read-time replay ever becomes preferable; this decision does not preclude it.

## References

- Room-manager debounce: `apps/server/src/collab/room-manager.ts`
- Phase A queue primitive: revealui#471
- Phase C no-op-on-already-done handler pattern: revealui#479
- Provenance direct-write sibling: revealui#485
- Design rationale + full deliberation: internal design doc §11 Path 2
