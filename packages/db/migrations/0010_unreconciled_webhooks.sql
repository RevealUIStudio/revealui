-- Hand-written migration for the `unreconciled_webhooks` table.
--
-- CONTEXT: The table is defined in `packages/db/src/schema/webhook-reconciliation.ts`
-- and appears in the Drizzle snapshots at `meta/0006_snapshot.json` and
-- `meta/0009_snapshot.json`, but had NO corresponding `.sql` migration in
-- 0000–0009 (verified 2026-04-22 via `grep -n "unreconciled" migrations/*.sql`
-- → zero hits). The table is actively written by `apps/api/src/routes/webhooks.ts`
-- and queried by `scripts/commands/database/check-unreconciled.ts`, so
-- production likely has it via an ad-hoc `drizzle-kit push` at some point.
-- A freshly-migrated environment (new deploy, PGlite test DB) would fail
-- these writes with `relation "unreconciled_webhooks" does not exist`.
--
-- IDEMPOTENCY: All DDL uses `IF NOT EXISTS` so this migration is safe to
-- apply against a production DB that already has the table. On a fresh DB
-- it creates the table + indexes from scratch.
--
-- See ~/suite/.jv/docs/cr8-p3-02-retention-design.md for the discovery
-- context (was found while scoping the operational-hygiene retention work).

CREATE TABLE IF NOT EXISTS "unreconciled_webhooks" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"customer_id" text,
	"stripe_object_id" text,
	"object_type" text,
	"error_trace" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unreconciled_webhooks_customer_id_idx"
	ON "unreconciled_webhooks" USING btree ("customer_id");
--> statement-breakpoint
-- Partial index: only unresolved rows. Makes "find all open reconciliation
-- records" cheap as the table grows — the cron query hits this index.
CREATE INDEX IF NOT EXISTS "unreconciled_webhooks_unresolved_idx"
	ON "unreconciled_webhooks" USING btree ("created_at")
	WHERE "resolved_at" IS NULL;
