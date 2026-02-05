-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "agent_actions" (
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
--> statement-breakpoint
CREATE TABLE "agent_contexts" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"session_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"priority" real DEFAULT 0.5,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"device_id" text,
	"last_synced_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_sync_timestamp" timestamp with time zone DEFAULT now(),
	"sync_version" integer DEFAULT 1,
	"device_count" integer DEFAULT 1,
	"conflicts_resolved" integer DEFAULT 0,
	"last_conflict_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text,
	"device_type" text,
	"user_agent" text,
	"last_seen" timestamp with time zone DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "global_footer" (
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb,
	"copyright" text,
	"social_links" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_header" (
	"id" text PRIMARY KEY DEFAULT '1' NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"nav_items" jsonb DEFAULT '[]'::jsonb,
	"logo_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_settings" (
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
--> statement-breakpoint
CREATE TABLE "media" (
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
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
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "crdt_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"crdt_id" text NOT NULL,
	"crdt_type" text NOT NULL,
	"operation_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"node_id" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_id_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"node_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_id_mappings_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "page_revisions" (
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
--> statement-breakpoint
CREATE TABLE "pages" (
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
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "failed_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"lock_until" timestamp with time zone,
	"window_start" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_collaborators" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
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
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"persistent" boolean DEFAULT false,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
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
	"_json" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"source" jsonb NOT NULL,
	"embedding" vector(1536),
	"embedding_metadata" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"access_count" integer DEFAULT 0,
	"accessed_at" timestamp with time zone,
	"verified" boolean DEFAULT false,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"site_id" text,
	"agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Create vector similarity search indexes using HNSW algorithm
-- HNSW (Hierarchical Navigable Small World) provides fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx ON agent_memories USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS agent_contexts_embedding_idx ON agent_contexts USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
-- Create indexes for common query filters
CREATE INDEX IF NOT EXISTS agent_memories_site_id_idx ON agent_memories(site_id) WHERE site_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS agent_memories_agent_id_idx ON agent_memories(agent_id) WHERE agent_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS agent_memories_type_idx ON agent_memories(type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS agent_memories_created_at_idx ON agent_memories(created_at DESC);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;