-- Governed MCP exact-call approvals.
-- Forward only. Idempotent CREATE. The signed audit_log stream is the evidence;
-- these tables are mutable operational state.
-- source_approval_id uses ON DELETE CASCADE so an account delete can remove
-- the source approval and its trust rules together.

CREATE TABLE IF NOT EXISTS "mcp_tool_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"client_name" text NOT NULL,
	"mcp_session_id" text,
	"tool" text NOT NULL,
	"args_hash" text NOT NULL,
	"tool_schema_hash" text NOT NULL,
	"call_digest" text NOT NULL,
	"args_preview" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" text,
	"decision_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"consume_by" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"trust_rule_id" text,
	CONSTRAINT "mcp_tool_approvals_status_check" CHECK (status IN ('pending', 'approved', 'denied', 'consumed', 'expired'))
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mcp_tool_trust_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"source_approval_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"tool" text NOT NULL,
	"args_hash" text NOT NULL,
	"tool_schema_hash" text NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lapsed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mcp_approval_settings" (
	"account_id" text PRIMARY KEY NOT NULL,
	"require_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "mcp_tool_approvals" ADD CONSTRAINT "mcp_tool_approvals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "mcp_tool_approvals" ADD CONSTRAINT "mcp_tool_approvals_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "mcp_tool_approvals" ADD CONSTRAINT "mcp_tool_approvals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "mcp_tool_trust_rules" ADD CONSTRAINT "mcp_tool_trust_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "mcp_tool_trust_rules" ADD CONSTRAINT "mcp_tool_trust_rules_source_approval_id_mcp_tool_approvals_id_fk" FOREIGN KEY ("source_approval_id") REFERENCES "public"."mcp_tool_approvals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "mcp_approval_settings" ADD CONSTRAINT "mcp_approval_settings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mcp_tool_approvals_account_status_idx" ON "mcp_tool_approvals" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_tool_approvals_digest_idx" ON "mcp_tool_approvals" USING btree ("call_digest");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_tool_trust_rules_active_uq" ON "mcp_tool_trust_rules" USING btree ("account_id","requester_user_id","tool","args_hash","tool_schema_hash") WHERE "revoked_at" IS NULL AND "lapsed_at" IS NULL;
