-- Migration 0003: Add performance indexes
--
-- Adds indexes for the most common query patterns across the API.
-- Uses CREATE INDEX IF NOT EXISTS for idempotency.
-- Critical for auth performance (sessions.token_hash) and ticket queries (board_id).

-- Users table
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email") WHERE "email" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_type_idx" ON "users" ("type");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" ("status");
--> statement-breakpoint

-- Sessions table (critical — queried on every authenticated request)
CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");
--> statement-breakpoint

-- Tickets table
CREATE INDEX IF NOT EXISTS "tickets_board_id_idx" ON "tickets" ("board_id");
CREATE INDEX IF NOT EXISTS "tickets_column_id_idx" ON "tickets" ("column_id");
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets" ("status");
CREATE INDEX IF NOT EXISTS "tickets_assignee_id_idx" ON "tickets" ("assignee_id");
CREATE INDEX IF NOT EXISTS "tickets_board_status_idx" ON "tickets" ("board_id", "status");
--> statement-breakpoint

-- Ticket comments table
CREATE INDEX IF NOT EXISTS "ticket_comments_ticket_id_idx" ON "ticket_comments" ("ticket_id");
--> statement-breakpoint

-- Ticket label assignments table
CREATE INDEX IF NOT EXISTS "ticket_label_assignments_ticket_id_idx" ON "ticket_label_assignments" ("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_label_assignments_label_id_idx" ON "ticket_label_assignments" ("label_id");
--> statement-breakpoint

-- Board columns table
CREATE INDEX IF NOT EXISTS "board_columns_board_id_idx" ON "board_columns" ("board_id");
--> statement-breakpoint

-- Code provenance table
CREATE INDEX IF NOT EXISTS "code_provenance_file_path_idx" ON "code_provenance" ("file_path");
CREATE INDEX IF NOT EXISTS "code_provenance_author_type_idx" ON "code_provenance" ("author_type");
CREATE INDEX IF NOT EXISTS "code_provenance_review_status_idx" ON "code_provenance" ("review_status");
--> statement-breakpoint

-- Code reviews table
CREATE INDEX IF NOT EXISTS "code_reviews_provenance_id_idx" ON "code_reviews" ("provenance_id");
--> statement-breakpoint

-- Boards table
CREATE INDEX IF NOT EXISTS "boards_tenant_id_idx" ON "boards" ("tenant_id") WHERE "tenant_id" IS NOT NULL;
