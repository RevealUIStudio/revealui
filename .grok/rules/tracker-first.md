# Tracker First (all models / providers)

Open the fleet **TRACKER** before inventing work:

`docs/TRACKER.md` (generated from `docs/initiatives/*.yml` via `node scripts/initiatives-render.js`)

## Rules

1. **Day-to-day free surfaces live only on TRACKER.** Gaps and lanes are the execution units; initiatives group them.
2. **Do not invent parallel queues** in harness homes (`~/.claude`, `~/.grok`), root `TODO.md`, or chat-only lists.
3. **CURRENT-HANDOFF** is session deltas only. **MASTER_PLAN** is strategy only.
4. **Product I/O** goes through RevealUI MCP (governed user + receipts), not per-harness side channels.
5. Shared policy is authored once (Plane A / `@revealui/harnesses` content definitions). Adapters **consume**; they do not full-copy hardlines.

## Claim work

Register a workboard note for an existing gap or lane id from TRACKER. Status lives on the gap YAML or lane plan — never hand-copied into TRACKER tables.

## References

- ADR `2026-07-22-single-fleet-tracker`
- ADR `2026-07-21-harness-policy-runtime-launch-planes`
- GAP-318, GAP-406
