CREATE TABLE "account_entitlements" (
	"account_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metering_status" text DEFAULT 'active' NOT NULL,
	"grace_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "user_api_keys" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_backup_codes" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_entitlements" ADD CONSTRAINT "account_entitlements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_subscriptions" ADD CONSTRAINT "account_subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_entitlements_tier_idx" ON "account_entitlements" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "account_entitlements_status_idx" ON "account_entitlements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_memberships_account_user_idx" ON "account_memberships" USING btree ("account_id","user_id");--> statement-breakpoint
CREATE INDEX "account_memberships_user_id_idx" ON "account_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_memberships_account_id_idx" ON "account_memberships" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_memberships_status_idx" ON "account_memberships" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_subscriptions_stripe_subscription_idx" ON "account_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "account_subscriptions_account_id_idx" ON "account_subscriptions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_subscriptions_stripe_customer_idx" ON "account_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "account_subscriptions_status_idx" ON "account_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_slug_idx" ON "accounts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_catalog_plan_id_idx" ON "billing_catalog" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "billing_catalog_tier_idx" ON "billing_catalog" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "billing_catalog_billing_model_idx" ON "billing_catalog" USING btree ("billing_model");--> statement-breakpoint
CREATE INDEX "billing_catalog_active_idx" ON "billing_catalog" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_meters_idempotency_key_idx" ON "usage_meters" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_meters_account_id_idx" ON "usage_meters" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "usage_meters_meter_name_idx" ON "usage_meters" USING btree ("meter_name");--> statement-breakpoint
CREATE INDEX "usage_meters_period_start_idx" ON "usage_meters" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "gdpr_breaches_detected_at_idx" ON "gdpr_breaches" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "gdpr_breaches_status_idx" ON "gdpr_breaches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gdpr_breaches_severity_idx" ON "gdpr_breaches" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "jobs_state_start_after_idx" ON "jobs" USING btree ("state","start_after");--> statement-breakpoint
CREATE INDEX "jobs_name_idx" ON "jobs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "jobs_state_idx" ON "jobs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "magic_links_user_id_idx" ON "magic_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_hash_idx" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "passkeys_user_id_idx" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkeys_credential_id_idx" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_email_idx" ON "tenants" USING btree ("email");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "user_api_keys_deleted_at_idx" ON "user_api_keys" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "posts_deleted_at_idx" ON "posts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "oauth_accounts_deleted_at_idx" ON "oauth_accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "page_revisions_page_id_idx" ON "page_revisions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "pages_site_status_idx" ON "pages" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "pages_deleted_at_idx" ON "pages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "sites_deleted_at_idx" ON "sites" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "sites_status_deleted_at_idx" ON "sites" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "sites_active_slug_idx" ON "sites" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sites_active_owner_id_idx" ON "sites" USING btree ("owner_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sites_active_status_idx" ON "sites" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "sites_owner_id_idx" ON "sites" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_author_id_idx" ON "ticket_comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_label_unique_idx" ON "ticket_label_assignments" USING btree ("ticket_id","label_id");--> statement-breakpoint
CREATE INDEX "tickets_column_id_idx" ON "tickets" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_deleted_at_idx" ON "sessions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_status_deleted_at_idx" ON "users" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "users_active_email_idx" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "users_active_status_idx" ON "users" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "users_email_verified_idx" ON "users" USING btree ("email_verified");