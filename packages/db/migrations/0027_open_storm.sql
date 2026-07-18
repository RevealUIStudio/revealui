CREATE TABLE IF NOT EXISTS "edit_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "edit_sessions_status_check" CHECK (status IN ('open', 'published', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edit_session_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"doc_id" text NOT NULL,
	"draft" jsonb NOT NULL,
	"base_version" integer NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edit_session_docs_doc_type_check" CHECK (doc_type IN ('page', 'global', 'post'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edit_session_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"actor_id" text,
	"actor_kind" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edit_session_events_actor_kind_check" CHECK (actor_kind IN ('human', 'agent')),
	CONSTRAINT "edit_session_events_type_check" CHECK (type IN ('opened', 'patched', 'commented', 'publish_requested', 'published', 'discarded'))
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edit_sessions" ADD CONSTRAINT "edit_sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edit_sessions" ADD CONSTRAINT "edit_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edit_session_docs" ADD CONSTRAINT "edit_session_docs_session_id_edit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."edit_sessions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edit_session_docs" ADD CONSTRAINT "edit_session_docs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edit_session_events" ADD CONSTRAINT "edit_session_events_session_id_edit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."edit_sessions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_sessions_site_id_idx" ON "edit_sessions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_sessions_status_idx" ON "edit_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_sessions_site_status_idx" ON "edit_sessions" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_session_docs_session_id_idx" ON "edit_session_docs" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "edit_session_docs_session_doc_idx" ON "edit_session_docs" USING btree ("session_id","doc_type","doc_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_session_events_session_id_idx" ON "edit_session_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edit_session_events_session_id_id_idx" ON "edit_session_events" USING btree ("session_id","id");