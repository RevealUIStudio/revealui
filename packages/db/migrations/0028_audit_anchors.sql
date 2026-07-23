-- GAP-355 Stage 4 S4-1: audit_anchors table for per-tenant Merkle roots.
-- Design: docs/gap-specs/GAP-355-stage4-anchor-design.md
-- §9 rulings (owner session 2026-07-23, as recommended): skip null tenants;
-- batch size+time in later PRs; API delivery; Max+ receipt via auditLog flag.
-- Hand-written for idempotent ADD CONSTRAINT (see migrations-discipline.md).

CREATE TABLE IF NOT EXISTS "audit_anchors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant" text NOT NULL,
  "seq_from" bigint NOT NULL,
  "seq_to" bigint NOT NULL,
  "root" text NOT NULL,
  "root_signature" text NOT NULL,
  "leaf_count" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivered_at" timestamp with time zone,
  "delivery_channel" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "audit_anchors_tenant_seq_range_uidx"
  ON "audit_anchors" ("tenant", "seq_from", "seq_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_anchors_tenant_created_idx"
  ON "audit_anchors" ("tenant", "created_at");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "audit_anchors" ADD CONSTRAINT "audit_anchors_seq_range_check"
    CHECK ("seq_to" >= "seq_from");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "audit_anchors" ADD CONSTRAINT "audit_anchors_leaf_count_check"
    CHECK ("leaf_count" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
