-- Layer 2: Yjs Document Patches - Structured CLI agent scratchpad edits
-- Patches are applied server-side to Yjs document state

CREATE TABLE IF NOT EXISTS "yjs_document_patches" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_id" text NOT NULL REFERENCES "yjs_documents"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL,
  "patch_type" text NOT NULL,
  "path" text NOT NULL,
  "content" text NOT NULL,
  "applied" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "yjs_document_patches_type_check" CHECK (patch_type IN ('append_section', 'append_item', 'replace_section', 'set_key'))
);

CREATE INDEX IF NOT EXISTS "yjs_document_patches_doc_applied_idx" ON "yjs_document_patches" ("document_id", "applied");
CREATE INDEX IF NOT EXISTS "yjs_document_patches_created_at_idx" ON "yjs_document_patches" ("created_at");
