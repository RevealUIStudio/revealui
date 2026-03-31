CREATE TABLE "agent_credit_balance" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"deleted_at" timestamp with time zone
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
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_last_used_counter" integer;--> statement-breakpoint
ALTER TABLE "agent_credit_balance" ADD CONSTRAINT "agent_credit_balance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_deleted_at_idx" ON "orders" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "products_owner_id_idx" ON "products" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_deleted_at_idx" ON "products" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "accounts_status_created_at_idx" ON "accounts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "usage_meters_account_period_idx" ON "usage_meters" USING btree ("account_id","period_start");--> statement-breakpoint
CREATE INDEX "licenses_deleted_at_idx" ON "licenses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_customer_subscription_unique" ON "licenses" USING btree ("customer_id","subscription_id");--> statement-breakpoint
CREATE INDEX "marketplace_transactions_server_id_idx" ON "marketplace_transactions" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "marketplace_transactions_status_idx" ON "marketplace_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_transactions_created_at_idx" ON "marketplace_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "passkeys_last_used_at_idx" ON "passkeys" USING btree ("last_used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_collaborators_site_user_unique" ON "site_collaborators" USING btree ("site_id","user_id");