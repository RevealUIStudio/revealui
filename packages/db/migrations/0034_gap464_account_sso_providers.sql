-- GAP-464 / revealui#449 Phase 1: Enterprise SSO tables.
-- account_sso_providers (per-account OIDC|SAML IdP config) + sso_identities
-- (federated subject → user). Hand-written for scoped CREATE (meta snapshot
-- lag precedent: 0025_add_nudge_dismissals).

CREATE TABLE IF NOT EXISTS "account_sso_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_type" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"issuer" text NOT NULL,
	"discovery_url" text,
	"client_id" text,
	"client_secret_ref" text,
	"saml_metadata_url" text,
	"saml_metadata_xml" text,
	"saml_sp_entity_id" text,
	"signing_cert_pem" text,
	"group_claim" text DEFAULT 'groups' NOT NULL,
	"group_role_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_role" text DEFAULT 'member' NOT NULL,
	"require_group_match" boolean DEFAULT false NOT NULL,
	"allow_password_fallback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "account_sso_providers_type_check" CHECK (provider_type IN ('oidc', 'saml'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_sso_providers" ADD CONSTRAINT "account_sso_providers_account_id_accounts_id_fk"
  FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_sso_providers_account_id_idx"
  ON "account_sso_providers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_sso_providers_deleted_at_idx"
  ON "account_sso_providers" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_sso_providers_account_issuer_active_idx"
  ON "account_sso_providers" USING btree ("account_id","issuer")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sso_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_provider_id_account_sso_providers_id_fk"
  FOREIGN KEY ("provider_id") REFERENCES "public"."account_sso_providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sso_identities_provider_subject_idx"
  ON "sso_identities" USING btree ("provider_id","subject");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_identities_user_id_idx"
  ON "sso_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sso_identities_provider_id_idx"
  ON "sso_identities" USING btree ("provider_id");
