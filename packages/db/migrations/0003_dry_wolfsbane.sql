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
ALTER TABLE "revealcoin_payments" ADD CONSTRAINT "revealcoin_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circuit_breaker_state_at_idx" ON "circuit_breaker_state" USING btree ("state_changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revealcoin_payments_tx_sig_idx" ON "revealcoin_payments" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "revealcoin_payments_user_id_idx" ON "revealcoin_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "revealcoin_payments_wallet_idx" ON "revealcoin_payments" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "revealcoin_payments_created_at_idx" ON "revealcoin_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "revealcoin_price_snapshots_recorded_at_idx" ON "revealcoin_price_snapshots" USING btree ("recorded_at");