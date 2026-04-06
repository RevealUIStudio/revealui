-- NeonDB REST Database Fresh Schema Setup
-- This is the initial schema for the NeonDB REST database (pre-production).
-- Run this to set up a fresh database with all REST API tables.
--
-- For pre-production: Use this fresh setup script.
-- For post-production: Migrations will be added when features are added.
--
-- Usage: pnpm test:db:setup
--
-- Note: agent_memories table is NOT included here - it's in Supabase (vector database)
-- Note: ElectricSQL syncs from this database - no separate setup needed
-- Note: agent_contexts has optional embedding column (requires pgvector extension)

-- Enable pgvector extension (for agent_contexts.embedding column)
-- Note: Main vector operations use Supabase (agent_memories), but agent_contexts
-- can optionally store embeddings in REST database for context similarity
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgvector extension (optional - only needed if using agent_contexts.embedding)
-- Note: NeonDB supports pgvector, but it's optional for REST database
-- Main vector operations use Supabase (agent_memories table)
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (must be created first due to foreign key dependencies)
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"type" text DEFAULT 'human' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"password" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"agent_model" text,
	"agent_capabilities" jsonb,
	"agent_config" jsonb,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone
);

-- Sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"persistent" boolean DEFAULT false,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);

-- Sites table
CREATE TABLE IF NOT EXISTS "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"theme" jsonb,
	"settings" jsonb,
	"page_count" integer DEFAULT 0,
	"favicon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);

-- Site collaborators table
CREATE TABLE IF NOT EXISTS "site_collaborators" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Pages table
CREATE TABLE IF NOT EXISTS "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"site_id" text NOT NULL,
	"parent_id" text,
	"template_id" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"path" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb,
	"seo" jsonb,
	"block_count" integer DEFAULT 0,
	"word_count" integer DEFAULT 0,
	"lock" jsonb,
	"scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);

-- Page revisions table
CREATE TABLE IF NOT EXISTS "page_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"created_by" text,
	"revision_number" integer NOT NULL,
	"title" text NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb,
	"seo" jsonb,
	"change_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Agent contexts table
-- Note: Optional embedding column for context similarity (requires pgvector extension)
-- Main vector operations use Supabase (agent_memories table)
CREATE TABLE IF NOT EXISTS "agent_contexts" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"session_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"priority" real DEFAULT 0.5,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Agent actions table
CREATE TABLE IF NOT EXISTS "agent_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"conversation_id" text,
	"agent_id" text NOT NULL,
	"tool" text NOT NULL,
	"params" jsonb,
	"result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"reasoning" text,
	"confidence" real
);

-- Media table
CREATE TABLE IF NOT EXISTS "media" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"filesize" integer,
	"url" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"focal_point" jsonb,
	"sizes" jsonb,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

-- Posts table
CREATE TABLE IF NOT EXISTS "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" jsonb,
	"featured_image_id" text,
	"author_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published" boolean DEFAULT false,
	"meta" jsonb,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);

-- Global settings table
CREATE TABLE IF NOT EXISTS "global_settings" (
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"site_name" text,
	"site_description" text,
	"default_meta" jsonb,
	"contact_email" text,
	"contact_phone" text,
	"social_profiles" jsonb,
	"analytics_id" text,
	"features" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Global header table
CREATE TABLE IF NOT EXISTS "global_header" (
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"nav_items" jsonb DEFAULT '[]'::jsonb,
	"logo_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Global footer table
CREATE TABLE IF NOT EXISTS "global_footer" (
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb,
	"copyright" text,
	"social_links" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- CRDT operations table
CREATE TABLE IF NOT EXISTS "crdt_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"crdt_id" text NOT NULL,
	"crdt_type" text NOT NULL,
	"operation_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"node_id" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Node ID mappings table
CREATE TABLE IF NOT EXISTS "node_id_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"node_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_id_mappings_node_id_unique" UNIQUE("node_id")
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Failed attempts table (for brute force protection)
CREATE TABLE IF NOT EXISTS "failed_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"lock_until" timestamp with time zone,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add Foreign Key Constraints (after all tables are created)
ALTER TABLE "sessions" ADD CONSTRAINT IF NOT EXISTS "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "site_collaborators" ADD CONSTRAINT IF NOT EXISTS "site_collaborators_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "site_collaborators" ADD CONSTRAINT IF NOT EXISTS "site_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "site_collaborators" ADD CONSTRAINT IF NOT EXISTS "site_collaborators_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sites" ADD CONSTRAINT IF NOT EXISTS "sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "page_revisions" ADD CONSTRAINT IF NOT EXISTS "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "page_revisions" ADD CONSTRAINT IF NOT EXISTS "page_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "pages" ADD CONSTRAINT IF NOT EXISTS "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "agent_actions" ADD CONSTRAINT IF NOT EXISTS "agent_actions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT IF NOT EXISTS "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "media" ADD CONSTRAINT IF NOT EXISTS "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT IF NOT EXISTS "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT IF NOT EXISTS "posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX IF NOT EXISTS "sessions_deleted_at_idx" ON "sessions"("deleted_at");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users"("email") WHERE "email" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "sites_owner_id_idx" ON "sites"("owner_id");
CREATE INDEX IF NOT EXISTS "sites_slug_idx" ON "sites"("slug");
CREATE INDEX IF NOT EXISTS "site_collaborators_site_id_idx" ON "site_collaborators"("site_id");
CREATE INDEX IF NOT EXISTS "site_collaborators_user_id_idx" ON "site_collaborators"("user_id");
CREATE INDEX IF NOT EXISTS "pages_site_id_idx" ON "pages"("site_id");
CREATE INDEX IF NOT EXISTS "pages_parent_id_idx" ON "pages"("parent_id");
CREATE INDEX IF NOT EXISTS "pages_slug_idx" ON "pages"("slug");
CREATE INDEX IF NOT EXISTS "pages_deleted_at_idx" ON "pages"("deleted_at");
CREATE INDEX IF NOT EXISTS "page_revisions_page_id_idx" ON "page_revisions"("page_id");
CREATE INDEX IF NOT EXISTS "agent_contexts_session_id_idx" ON "agent_contexts"("session_id");
CREATE INDEX IF NOT EXISTS "agent_contexts_agent_id_idx" ON "agent_contexts"("agent_id");
CREATE INDEX IF NOT EXISTS "conversations_session_id_idx" ON "conversations"("session_id");
CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX IF NOT EXISTS "conversations_agent_id_idx" ON "conversations"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_actions_conversation_id_idx" ON "agent_actions"("conversation_id");
CREATE INDEX IF NOT EXISTS "agent_actions_agent_id_idx" ON "agent_actions"("agent_id");
CREATE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts"("slug");
CREATE INDEX IF NOT EXISTS "posts_author_id_idx" ON "posts"("author_id");
CREATE INDEX IF NOT EXISTS "posts_featured_image_id_idx" ON "posts"("featured_image_id");
CREATE INDEX IF NOT EXISTS "posts_deleted_at_idx" ON "posts"("deleted_at");
CREATE INDEX IF NOT EXISTS "crdt_operations_node_id_idx" ON "crdt_operations"("node_id");
CREATE INDEX IF NOT EXISTS "node_id_mappings_node_id_idx" ON "node_id_mappings"("node_id");
CREATE INDEX IF NOT EXISTS "node_id_mappings_entity_type_idx" ON "node_id_mappings"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_rate_limits_reset_at" ON "rate_limits"("reset_at");
CREATE INDEX IF NOT EXISTS "idx_failed_attempts_lock_until" ON "failed_attempts"("lock_until");
CREATE INDEX IF NOT EXISTS "idx_failed_attempts_window_start" ON "failed_attempts"("window_start");

-- Add comments for documentation
COMMENT ON TABLE "sessions" IS 'User authentication sessions for REST API';
COMMENT ON TABLE "users" IS 'Users table for REST API - includes both human and agent users';
COMMENT ON TABLE "sites" IS 'Sites table for CMS content management';
COMMENT ON TABLE "pages" IS 'Pages table for CMS page content';
COMMENT ON TABLE "agent_contexts" IS 'Agent context storage for REST API';
COMMENT ON TABLE "conversations" IS 'Conversation storage for agent interactions';
COMMENT ON TABLE "agent_actions" IS 'Agent action tracking for tool execution';
COMMENT ON TABLE "rate_limits" IS 'Distributed rate limiting storage';
COMMENT ON TABLE "failed_attempts" IS 'Brute force protection tracking';

-- OAuth accounts table (linked provider identities per user)
CREATE TABLE IF NOT EXISTS "oauth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"provider_email" text,
	"provider_name" text,
	"provider_avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_user_idx" ON "oauth_accounts"("provider", "provider_user_id");
CREATE INDEX IF NOT EXISTS "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");
CREATE INDEX IF NOT EXISTS "oauth_accounts_deleted_at_idx" ON "oauth_accounts"("deleted_at");
COMMENT ON TABLE "oauth_accounts" IS 'OAuth provider account links — maps provider identities to local users';

-- =============================================================================
-- MCP Marketplace (Phase 5.5)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "marketplace_servers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "url" text NOT NULL,
  "category" text NOT NULL DEFAULT 'other',
  "tags" text[] NOT NULL DEFAULT '{}',
  "price_per_call_usdc" text NOT NULL DEFAULT '0.001',
  "developer_id" text NOT NULL,
  "stripe_account_id" text,
  "status" text NOT NULL DEFAULT 'active',
  "call_count" integer NOT NULL DEFAULT 0,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketplace_servers_developer_id_fkey"
    FOREIGN KEY ("developer_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "marketplace_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "server_id" text NOT NULL,
  "caller_id" text,
  "amount_usdc" text NOT NULL,
  "platform_fee_usdc" text NOT NULL,
  "developer_amount_usdc" text NOT NULL,
  "stripe_transfer_id" text,
  "payment_method" text NOT NULL DEFAULT 'x402',
  "status" text NOT NULL DEFAULT 'pending',
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketplace_transactions_server_id_fkey"
    FOREIGN KEY ("server_id") REFERENCES "marketplace_servers"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "marketplace_servers_developer_id_idx"
  ON "marketplace_servers"("developer_id");
CREATE INDEX IF NOT EXISTS "marketplace_servers_status_idx"
  ON "marketplace_servers"("status");
CREATE INDEX IF NOT EXISTS "marketplace_servers_category_idx"
  ON "marketplace_servers"("category");
CREATE INDEX IF NOT EXISTS "marketplace_transactions_server_id_idx"
  ON "marketplace_transactions"("server_id");
CREATE INDEX IF NOT EXISTS "marketplace_transactions_caller_id_idx"
  ON "marketplace_transactions"("caller_id");
CREATE INDEX IF NOT EXISTS "marketplace_transactions_status_idx"
  ON "marketplace_transactions"("status");

COMMENT ON TABLE "marketplace_servers" IS 'Community-published MCP servers available through the RevealUI marketplace';

-- =============================================================================
-- Audit Log: Append-Only Enforcement
-- =============================================================================
-- A DB-level trigger prevents any UPDATE or DELETE on audit_log.
-- The application layer (DrizzleAuditStore) enforces this too, but the trigger
-- provides a hard guarantee regardless of how the table is accessed.

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
COMMENT ON TABLE "marketplace_transactions" IS 'Per-call payment ledger for marketplace server invocations';

-- =============================================================================
-- Circuit Breaker State: Shared cross-instance state
-- =============================================================================
-- Stores circuit breaker state so all API instances share the same view.
-- Write path: only on state transitions (closed→open, open→half-open, etc.)
-- Read path: local 5-second cache; DB only on cache miss.

CREATE TABLE IF NOT EXISTS "circuit_breaker_state" (
  "service_name" text PRIMARY KEY NOT NULL,
  "state" text NOT NULL DEFAULT 'closed',
  "failure_count" integer NOT NULL DEFAULT 0,
  "success_count" integer NOT NULL DEFAULT 0,
  "last_failure_at" timestamp with time zone,
  "state_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "circuit_breaker_state_at_idx"
  ON "circuit_breaker_state"("state_changed_at");

COMMENT ON TABLE "circuit_breaker_state" IS 'Shared circuit breaker state across API instances — prevents cascading failures to external services like Stripe';

-- Idempotency keys for saga deduplication and operation dedup
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"operation_type" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idempotency_keys_operation_type_idx"
	ON "idempotency_keys" USING btree ("operation_type");

CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx"
	ON "idempotency_keys" USING btree ("expires_at");

COMMENT ON TABLE "idempotency_keys" IS 'Deduplication keys for saga executions and idempotent operations — TTL-based with periodic cleanup';
