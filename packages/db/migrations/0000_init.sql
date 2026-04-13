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
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_credit_balance" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_credit_balance_non_negative" CHECK (balance >= 0),
	CONSTRAINT "agent_credit_total_non_negative" CHECK (total_purchased >= 0)
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"type" text NOT NULL,
	"source" jsonb NOT NULL,
	"embedding" vector(768),
	"embedding_metadata" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"access_count" integer DEFAULT 0,
	"accessed_at" timestamp with time zone,
	"verified" boolean DEFAULT false,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"site_id" text NOT NULL,
	"agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_task_usage" (
	"user_id" text NOT NULL,
	"cycle_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"overage" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_task_usage_user_id_cycle_start_pk" PRIMARY KEY("user_id","cycle_start")
);
--> statement-breakpoint
CREATE TABLE "ai_memory_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "registered_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"token_issued_at" timestamp with time zone,
	"last_seen" timestamp with time zone DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "account_entitlements" (
	"account_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metering_status" text DEFAULT 'active' NOT NULL,
	"grace_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_entitlements_tier_check" CHECK (tier IN ('free', 'pro', 'max', 'enterprise')),
	CONSTRAINT "account_entitlements_status_check" CHECK (status IN ('active', 'past_due', 'canceled', 'expired', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "account_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_subscriptions_status_check" CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'unpaid', 'expired', 'revoked', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"tier" text NOT NULL,
	"billing_model" text NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_catalog_tier_check" CHECK (tier IN ('free', 'pro', 'max', 'enterprise')),
	CONSTRAINT "billing_catalog_billing_model_check" CHECK (billing_model IN ('subscription', 'perpetual', 'renewal', 'credits'))
);
--> statement-breakpoint
CREATE TABLE "usage_meters" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"meter_name" text NOT NULL,
	"quantity" bigint DEFAULT 1 NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone,
	"source" text DEFAULT 'system' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"version" integer DEFAULT 1 NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "tenant_provider_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"app" text NOT NULL,
	"environment" text DEFAULT 'production' NOT NULL,
	"request_id" text,
	"user_id" text,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"agent_id" text NOT NULL,
	"task_id" text,
	"session_id" text,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"policy_violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signature" text,
	"previous_signature" text
);
--> statement-breakpoint
CREATE TABLE "circuit_breaker_state" (
	"service_name" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'closed' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"last_failure_at" timestamp with time zone,
	"state_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_provenance" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"file_path" text NOT NULL,
	"function_name" text,
	"line_start" integer,
	"line_end" integer,
	"author_type" text NOT NULL,
	"ai_model" text,
	"ai_session_id" text,
	"git_commit_hash" text,
	"git_author" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"lines_of_code" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"provenance_id" text NOT NULL,
	"reviewer_id" text,
	"review_type" text NOT NULL,
	"status" text NOT NULL,
	"comment" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collab_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" text NOT NULL,
	"client_type" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"agent_model" text,
	"update_data" "bytea" NOT NULL,
	"update_size" integer NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"env" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "coordination_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text,
	"agent_id" text NOT NULL,
	"type" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_file_claims" (
	"file_path" text NOT NULL,
	"session_id" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_file_claims_file_path_session_id_pk" PRIMARY KEY("file_path","session_id")
);
--> statement-breakpoint
CREATE TABLE "coordination_mail" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_agent" text NOT NULL,
	"to_agent" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_queue_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_agent" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"from_agent" text NOT NULL,
	"message" text NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "coordination_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"task" text DEFAULT '(starting)' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"pid" integer,
	"tools" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "coordination_work_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"owner_agent" text,
	"owner_session" text,
	"parent_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
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
CREATE TABLE "error_events" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"app" text NOT NULL,
	"context" text,
	"environment" text DEFAULT 'production' NOT NULL,
	"url" text,
	"user_id" text,
	"request_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "gdpr_breaches" (
	"id" text PRIMARY KEY NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_at" timestamp with time zone,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"affected_users" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text NOT NULL,
	"mitigation" text,
	"status" text DEFAULT 'detected' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"source" text DEFAULT 'explicit' NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "gdpr_consents_user_type_uq" UNIQUE("user_id","type")
);
--> statement-breakpoint
CREATE TABLE "gdpr_deletion_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"data_categories" jsonb DEFAULT '["personal"]'::jsonb NOT NULL,
	"reason" text,
	"retained_data" jsonb,
	"deleted_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"operation_type" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"state" text DEFAULT 'created' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"retry_limit" integer DEFAULT 3 NOT NULL,
	"start_after" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_at" timestamp with time zone,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"license_key" text NOT NULL,
	"tier" text NOT NULL,
	"subscription_id" text,
	"customer_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"perpetual" boolean DEFAULT false NOT NULL,
	"support_expires_at" timestamp with time zone,
	"github_username" text,
	"npm_username" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "licenses_tier_check" CHECK (tier IN ('pro', 'max', 'enterprise')),
	CONSTRAINT "licenses_status_check" CHECK (status IN ('active', 'expired', 'revoked', 'support_expired'))
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_salt" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"price_per_call_usdc" text DEFAULT '0.001' NOT NULL,
	"developer_id" text NOT NULL,
	"stripe_account_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"caller_id" text,
	"amount_usdc" text NOT NULL,
	"platform_fee_usdc" text NOT NULL,
	"developer_amount_usdc" text NOT NULL,
	"stripe_transfer_id" text,
	"payment_method" text DEFAULT 'x402' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
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
CREATE TABLE "oauth_accounts" (
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
	"anonymized_at" timestamp with time zone
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
	"version" integer DEFAULT 1 NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"aaguid" text,
	"device_name" text,
	"backed_up" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_salt" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_in_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shipping_address" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "orders_status_check" CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"price_in_cents" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"owner_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_status_check" CHECK (status IN ('draft', 'published', 'archived'))
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
CREATE TABLE "revealcoin_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"tx_signature" text NOT NULL,
	"wallet_address" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_rvc" text NOT NULL,
	"amount_usd" numeric(12, 4) NOT NULL,
	"discount_usd" numeric(12, 4) DEFAULT '0' NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'verified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revealcoin_price_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"price_usd" numeric(18, 8) NOT NULL,
	"source" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"task_id" text,
	"rating" integer NOT NULL,
	"comment" text,
	"verified" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"examples" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"publisher_id" text NOT NULL,
	"version" text DEFAULT '0.1.0' NOT NULL,
	"definition" jsonb NOT NULL,
	"pricing_model" text DEFAULT 'per-task' NOT NULL,
	"base_price_usdc" text DEFAULT '0.10' NOT NULL,
	"max_execution_secs" integer DEFAULT 300 NOT NULL,
	"resource_limits" jsonb DEFAULT '{"maxMemoryMb":512,"maxCpuPercent":50}'::jsonb,
	"rating" real DEFAULT 0,
	"review_count" integer DEFAULT 0 NOT NULL,
	"task_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"stripe_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"submitter_id" text NOT NULL,
	"agent_id" text,
	"skill_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"artifacts" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"cost_usdc" text,
	"payment_method" text,
	"execution_meta" jsonb,
	"error_message" text,
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
	"version" integer DEFAULT 1 NOT NULL,
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
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "ticket_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_label_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"label_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"closed_at" timestamp with time zone,
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
	"metadata" jsonb,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
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
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" text,
	"email_verification_token_expires_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"tos_accepted_at" timestamp with time zone,
	"tos_version" text,
	"stripe_customer_id" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"mfa_backup_codes" jsonb,
	"mfa_verified_at" timestamp with time zone,
	"mfa_last_used_counter" integer,
	"ssh_key_fingerprint" text,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"_json" jsonb DEFAULT '{}',
	CONSTRAINT "users_role_check" CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'agent', 'contributor')),
	CONSTRAINT "users_status_check" CHECK (status IN ('active', 'suspended', 'deleted', 'pending')),
	CONSTRAINT "users_type_check" CHECK (type IN ('human', 'agent', 'system'))
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"referrer" text,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yjs_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"state" "bytea" NOT NULL,
	"state_vector" "bytea",
	"connected_clients" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"workspace_id" text,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"embedding" vector(768),
	"embedding_model" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"source_collection" text,
	"title" text,
	"mime_type" text DEFAULT 'text/plain',
	"raw_content" text,
	"word_count" integer DEFAULT 0,
	"token_estimate" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"embedding_model" text DEFAULT 'nomic-embed-text' NOT NULL,
	"chunk_size" integer DEFAULT 512 NOT NULL,
	"chunk_overlap" integer DEFAULT 64 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_contexts" ADD CONSTRAINT "agent_contexts_session_id_ai_memory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_memory_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_contexts" ADD CONSTRAINT "agent_contexts_agent_id_registered_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."registered_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credit_balance" ADD CONSTRAINT "agent_credit_balance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task_usage" ADD CONSTRAINT "agent_task_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_memory_sessions" ADD CONSTRAINT "ai_memory_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_subscriptions" ADD CONSTRAINT "account_subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_provider_configs" ADD CONSTRAINT "tenant_provider_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_provenance" ADD CONSTRAINT "code_provenance_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_provenance_id_code_provenance_id_fk" FOREIGN KEY ("provenance_id") REFERENCES "public"."code_provenance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_reviews" ADD CONSTRAINT "code_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collab_edits" ADD CONSTRAINT "collab_edits_document_id_yjs_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."yjs_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_events" ADD CONSTRAINT "coordination_events_session_id_coordination_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_file_claims" ADD CONSTRAINT "coordination_file_claims_session_id_coordination_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_sessions" ADD CONSTRAINT "coordination_sessions_agent_id_coordination_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."coordination_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_work_items" ADD CONSTRAINT "coordination_work_items_owner_session_coordination_sessions_id_fk" FOREIGN KEY ("owner_session") REFERENCES "public"."coordination_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_servers" ADD CONSTRAINT "marketplace_servers_developer_id_users_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_server_id_marketplace_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."marketplace_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revealcoin_payments" ADD CONSTRAINT "revealcoin_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_agent_id_marketplace_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."marketplace_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_reviews" ADD CONSTRAINT "agent_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_marketplace_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."marketplace_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_agent_id_marketplace_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."marketplace_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_collaborators" ADD CONSTRAINT "site_collaborators_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_label_assignments" ADD CONSTRAINT "ticket_label_assignments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_label_assignments" ADD CONSTRAINT "ticket_label_assignments_label_id_ticket_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."ticket_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_column_id_board_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parent_ticket_id_tickets_id_fk" FOREIGN KEY ("parent_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_workspace_id_sites_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_workspace_id_sites_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_actions_conversation_id_idx" ON "agent_actions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_actions_agent_id_idx" ON "agent_actions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_actions_status_idx" ON "agent_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_contexts_session_id_idx" ON "agent_contexts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_contexts_agent_id_idx" ON "agent_contexts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_memories_site_id_idx" ON "agent_memories" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "agent_memories_agent_id_idx" ON "agent_memories" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_memories_verified_idx" ON "agent_memories" USING btree ("verified");--> statement-breakpoint
CREATE INDEX "agent_memories_expires_at_idx" ON "agent_memories" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "agent_memories_type_idx" ON "agent_memories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_role_idx" ON "messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "registered_agents_updated_at_idx" ON "registered_agents" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "sync_metadata_user_id_idx" ON "sync_metadata" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_entitlements_tier_idx" ON "account_entitlements" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "account_entitlements_status_idx" ON "account_entitlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_entitlements_account_status_idx" ON "account_entitlements" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_memberships_account_user_idx" ON "account_memberships" USING btree ("account_id","user_id");--> statement-breakpoint
CREATE INDEX "account_memberships_user_id_idx" ON "account_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_memberships_account_id_idx" ON "account_memberships" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_memberships_status_idx" ON "account_memberships" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_subscriptions_stripe_subscription_idx" ON "account_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "account_subscriptions_account_id_idx" ON "account_subscriptions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_subscriptions_stripe_customer_idx" ON "account_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "account_subscriptions_status_idx" ON "account_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_subscriptions_account_status_idx" ON "account_subscriptions" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_slug_idx" ON "accounts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_status_created_at_idx" ON "accounts" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_catalog_plan_id_idx" ON "billing_catalog" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "billing_catalog_tier_idx" ON "billing_catalog" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "billing_catalog_billing_model_idx" ON "billing_catalog" USING btree ("billing_model");--> statement-breakpoint
CREATE INDEX "billing_catalog_active_idx" ON "billing_catalog" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_meters_idempotency_key_idx" ON "usage_meters" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_meters_account_id_idx" ON "usage_meters" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "usage_meters_meter_name_idx" ON "usage_meters" USING btree ("meter_name");--> statement-breakpoint
CREATE INDEX "usage_meters_period_start_idx" ON "usage_meters" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "usage_meters_account_period_idx" ON "usage_meters" USING btree ("account_id","period_start");--> statement-breakpoint
CREATE INDEX "posts_author_id_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "posts_featured_image_id_idx" ON "posts" USING btree ("featured_image_id");--> statement-breakpoint
CREATE INDEX "posts_deleted_at_idx" ON "posts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "tenant_provider_configs_user_id_idx" ON "tenant_provider_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_api_keys_user_provider_idx" ON "user_api_keys" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "user_api_keys_deleted_at_idx" ON "user_api_keys" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "app_logs_timestamp_idx" ON "app_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "app_logs_app_level_idx" ON "app_logs" USING btree ("app","level");--> statement-breakpoint
CREATE INDEX "audit_log_event_type_idx" ON "audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "audit_log_agent_id_idx" ON "audit_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_severity_idx" ON "audit_log" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "circuit_breaker_state_at_idx" ON "circuit_breaker_state" USING btree ("state_changed_at");--> statement-breakpoint
CREATE INDEX "collab_edits_document_id_idx" ON "collab_edits" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "coordination_agents_last_seen_idx" ON "coordination_agents" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "coordination_events_agent_type_idx" ON "coordination_events" USING btree ("agent_id","type","created_at");--> statement-breakpoint
CREATE INDEX "coordination_file_claims_session_id_idx" ON "coordination_file_claims" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "coordination_mail_to_read_idx" ON "coordination_mail" USING btree ("to_agent","read");--> statement-breakpoint
CREATE INDEX "coordination_queue_target_consumed_idx" ON "coordination_queue_items" USING btree ("target_agent","consumed");--> statement-breakpoint
CREATE INDEX "coordination_sessions_agent_status_idx" ON "coordination_sessions" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "coordination_sessions_started_at_idx" ON "coordination_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "coordination_work_items_status_owner_idx" ON "coordination_work_items" USING btree ("status","owner_agent");--> statement-breakpoint
CREATE INDEX "crdt_operations_crdt_id_idx" ON "crdt_operations" USING btree ("crdt_id");--> statement-breakpoint
CREATE INDEX "crdt_operations_node_id_idx" ON "crdt_operations" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "error_events_timestamp_idx" ON "error_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "error_events_app_env_idx" ON "error_events" USING btree ("app","environment");--> statement-breakpoint
CREATE INDEX "error_events_level_idx" ON "error_events" USING btree ("level");--> statement-breakpoint
CREATE INDEX "gdpr_breaches_detected_at_idx" ON "gdpr_breaches" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "gdpr_breaches_status_idx" ON "gdpr_breaches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gdpr_breaches_severity_idx" ON "gdpr_breaches" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "gdpr_consents_user_id_idx" ON "gdpr_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gdpr_consents_type_idx" ON "gdpr_consents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gdpr_consents_granted_idx" ON "gdpr_consents" USING btree ("granted");--> statement-breakpoint
CREATE INDEX "gdpr_deletion_requests_user_id_idx" ON "gdpr_deletion_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gdpr_deletion_requests_status_idx" ON "gdpr_deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gdpr_deletion_requests_requested_at_idx" ON "gdpr_deletion_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_operation_type_idx" ON "idempotency_keys" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "jobs_state_start_after_idx" ON "jobs" USING btree ("state","start_after");--> statement-breakpoint
CREATE INDEX "jobs_name_idx" ON "jobs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "jobs_state_idx" ON "jobs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "licenses_customer_id_idx" ON "licenses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "licenses_user_id_idx" ON "licenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "licenses_status_idx" ON "licenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "licenses_subscription_id_idx" ON "licenses" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "licenses_deleted_at_idx" ON "licenses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_customer_subscription_unique" ON "licenses" USING btree ("customer_id","subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_perpetual_user_tier_unique" ON "licenses" USING btree ("user_id","tier") WHERE perpetual = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "licenses_user_tier_status_idx" ON "licenses" USING btree ("user_id","tier","status");--> statement-breakpoint
CREATE INDEX "licenses_perpetual_status_support_idx" ON "licenses" USING btree ("perpetual","status","support_expires_at");--> statement-breakpoint
CREATE INDEX "magic_links_user_id_idx" ON "magic_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_hash_idx" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "marketplace_transactions_server_id_idx" ON "marketplace_transactions" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "marketplace_transactions_status_idx" ON "marketplace_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_transactions_created_at_idx" ON "marketplace_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_user_idx" ON "oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_deleted_at_idx" ON "oauth_accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "page_revisions_page_id_idx" ON "page_revisions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "pages_parent_id_idx" ON "pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "pages_site_id_idx" ON "pages" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "pages_site_status_idx" ON "pages" USING btree ("site_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_site_id_idx" ON "pages" USING btree ("slug","site_id");--> statement-breakpoint
CREATE INDEX "pages_deleted_at_idx" ON "pages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "passkeys_user_id_idx" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkeys_credential_id_idx" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "passkeys_last_used_at_idx" ON "passkeys" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_deleted_at_idx" ON "orders" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "products_owner_id_idx" ON "products" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_deleted_at_idx" ON "products" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revealcoin_payments_tx_sig_idx" ON "revealcoin_payments" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "revealcoin_payments_user_id_idx" ON "revealcoin_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "revealcoin_payments_wallet_idx" ON "revealcoin_payments" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "revealcoin_payments_created_at_idx" ON "revealcoin_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "revealcoin_price_snapshots_recorded_at_idx" ON "revealcoin_price_snapshots" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "agent_reviews_agent_id_idx" ON "agent_reviews" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_reviews_reviewer_id_idx" ON "agent_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "agent_skills_agent_id_idx" ON "agent_skills" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_skills_name_idx" ON "agent_skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "marketplace_agents_publisher_id_idx" ON "marketplace_agents" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "marketplace_agents_status_idx" ON "marketplace_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_agents_category_idx" ON "marketplace_agents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "marketplace_agents_rating_idx" ON "marketplace_agents" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "task_submissions_submitter_id_idx" ON "task_submissions" USING btree ("submitter_id");--> statement-breakpoint
CREATE INDEX "task_submissions_agent_id_idx" ON "task_submissions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "task_submissions_status_idx" ON "task_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_submissions_skill_name_idx" ON "task_submissions" USING btree ("skill_name");--> statement-breakpoint
CREATE INDEX "task_submissions_created_at_idx" ON "task_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_collaborators_site_user_unique" ON "site_collaborators" USING btree ("site_id","user_id");--> statement-breakpoint
CREATE INDEX "sites_deleted_at_idx" ON "sites" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "sites_status_deleted_at_idx" ON "sites" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "sites_active_slug_idx" ON "sites" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sites_active_owner_id_idx" ON "sites" USING btree ("owner_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sites_active_status_idx" ON "sites" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sites_owner_id_idx" ON "sites" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_email_idx" ON "tenants" USING btree ("email");--> statement-breakpoint
CREATE INDEX "boards_tenant_id_idx" ON "boards" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "boards_owner_id_idx" ON "boards" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_id_idx" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_author_id_idx" ON "ticket_comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_label_unique_idx" ON "ticket_label_assignments" USING btree ("ticket_id","label_id");--> statement-breakpoint
CREATE INDEX "ticket_labels_tenant_id_idx" ON "ticket_labels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tickets_board_id_idx" ON "tickets" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "tickets_column_id_idx" ON "tickets" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "tickets_assignee_id_idx" ON "tickets" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tickets_parent_ticket_id_idx" ON "tickets" USING btree ("parent_ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_reporter_id_idx" ON "tickets" USING btree ("reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_board_ticket_number_idx" ON "tickets" USING btree ("board_id","ticket_number");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_deleted_at_idx" ON "sessions" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_type_idx" ON "users" USING btree ("type");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_status_deleted_at_idx" ON "users" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "users_active_email_idx" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "users_active_status_idx" ON "users" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "users_stripe_customer_id_idx" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "users_ssh_key_fingerprint_idx" ON "users" USING btree ("ssh_key_fingerprint");--> statement-breakpoint
CREATE INDEX "users_email_verified_idx" ON "users" USING btree ("email_verified");--> statement-breakpoint
CREATE INDEX "webhook_events_processed_at_idx" ON "processed_webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "rag_chunks_document_id_idx" ON "rag_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_workspace_id_idx" ON "rag_chunks" USING btree ("workspace_id");