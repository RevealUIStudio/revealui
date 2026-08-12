-- GAP-477 residual: yjs_documents.owner_id for Electric shape ACL (creator stamp).
-- Nullable for backfill of legacy rows; shapes treat null owner as admin-only.
-- Companion Drizzle: packages/db/src/schema/yjs-documents.ts

ALTER TABLE "yjs_documents" ADD COLUMN IF NOT EXISTS "owner_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "yjs_documents_owner_id_idx"
  ON "yjs_documents" USING btree ("owner_id");
