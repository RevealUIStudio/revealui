-- Migration 0002: Add ticketing system tables and audit log
--
-- Adds:
--   - boards            (kanban boards scoped to tenants)
--   - board_columns     (configurable columns per board)
--   - ticket_labels     (colored tags for categorization)
--   - tickets           (core ticket entity, replaces todos)
--   - ticket_comments   (threaded discussion per ticket)
--   - ticket_label_assignments (M:N junction)
--   - audit_log         (append-only AI agent audit trail)
--
-- Also drops the old todos table (superseded by tickets).

-- =============================================================================
-- Drop todos (replaced by the ticketing system)
-- =============================================================================

DROP TABLE IF EXISTS "todos";
--> statement-breakpoint

-- =============================================================================
-- Boards
-- =============================================================================

CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"tenant_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"owner_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Board Columns
-- =============================================================================

CREATE TABLE "board_columns" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"wip_limit" integer,
	"color" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Ticket Labels
-- =============================================================================

CREATE TABLE "ticket_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Tickets
-- =============================================================================

CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"board_id" text NOT NULL,
	"column_id" text,
	"parent_ticket_id" text,
	"ticket_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" jsonb,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"type" text DEFAULT 'task' NOT NULL,
	"assignee_id" text,
	"reporter_id" text,
	"due_date" timestamp with time zone,
	"estimated_effort" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"attachments" jsonb DEFAULT '[]' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Ticket Comments
-- =============================================================================

CREATE TABLE "ticket_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Ticket Label Assignments (M:N junction)
-- =============================================================================

CREATE TABLE "ticket_label_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"label_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Audit Log (append-only AI agent audit trail)
-- =============================================================================

CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"agent_id" text NOT NULL,
	"task_id" text,
	"session_id" text,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"policy_violations" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint

-- =============================================================================
-- Foreign key constraints
-- =============================================================================

ALTER TABLE "boards" ADD CONSTRAINT "boards_owner_id_users_id_fk"
	FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_boards_id_fk"
	FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_board_id_boards_id_fk"
	FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_column_id_board_columns_id_fk"
	FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_users_id_fk"
	FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_users_id_fk"
	FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk"
	FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk"
	FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "ticket_label_assignments" ADD CONSTRAINT "ticket_label_assignments_ticket_id_tickets_id_fk"
	FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "ticket_label_assignments" ADD CONSTRAINT "ticket_label_assignments_label_id_ticket_labels_id_fk"
	FOREIGN KEY ("label_id") REFERENCES "public"."ticket_labels"("id") ON DELETE cascade ON UPDATE no action;
