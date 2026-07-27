-- GAP-447: existence-classified hole traversal for the audit anchor sweep.
-- Records the burned (permanently absent) seqs + foreign-scope-row count an
-- anchor traversed within its [seq_from, seq_to] range, so a customer/ops
-- verifier can re-check that recorded-burned seqs are still absent. NULL
-- means no holes were traversed (the pre-GAP-447 shape and still the common
-- case) — hand-written for the ADD COLUMN IF NOT EXISTS idempotent form,
-- following the 0011/0015/0030 precedent. Companion Drizzle schema change at
-- packages/db/src/schema/audit-anchors.ts adds the `holes` jsonb column.

ALTER TABLE "audit_anchors" ADD COLUMN IF NOT EXISTS "holes" jsonb;
