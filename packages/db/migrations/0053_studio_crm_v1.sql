CREATE TABLE "crm_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"actor_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"template" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_campaign_status_check" CHECK (status IN ('draft','review','approved','paused','archived'))
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"organization_id" text,
	"name" text,
	"role" text,
	"business_email" text,
	"normalized_email" text,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"consent" text DEFAULT 'unknown' NOT NULL,
	"contact_source_url" text,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_contact_consent_check" CHECK (consent IN ('unknown','permitted','withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"offer" text DEFAULT 'consultation' NOT NULL,
	"realized_revenue_cents" integer DEFAULT 0 NOT NULL,
	"revenue_evidence" text,
	"stage" text DEFAULT 'research' NOT NULL,
	"value_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"owner_id" text,
	"next_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_opportunity_stage_check" CHECK (stage IN ('research','qualified','contact_ready','contacted','replied','discovery','proposal','won','lost','nurture','do_not_contact')),
	CONSTRAINT "crm_opportunity_offer_check" CHECK (offer IN ('consultation','pilot','launch')),
	CONSTRAINT "crm_opportunity_revenue_check" CHECK (realized_revenue_cents >= 0 AND (realized_revenue_cents = 0 OR revenue_evidence IS NOT NULL)),
	CONSTRAINT "crm_opportunity_value_check" CHECK (value_cents IS NULL OR value_cents >= 0)
);
--> statement-breakpoint
CREATE TABLE "crm_organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"website" text,
	"industry" text,
	"location" text,
	"source_url" text,
	"source_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"actor_id" text,
	"resource" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_booking_links" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"site_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"digest" text NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_outreach_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_id" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_draft_status_check" CHECK (status IN ('draft','approved','cancelled')),
	CONSTRAINT "crm_draft_approval_check" CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "crm_stage_history" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_suppression" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"normalized_email" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"opportunity_id" text,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text DEFAULT 'todo' NOT NULL,
	"due_at" timestamp with time zone,
	"assignee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_task_status_check" CHECK (status IN ('todo','in_progress','done','cancelled'))
);
--> statement-breakpoint
CREATE INDEX "crm_activity_account_idx" ON "crm_activities" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "crm_activity_opportunity_idx" ON "crm_activities" USING btree ("opportunity_id");
--> statement-breakpoint
CREATE INDEX "crm_campaigns_account_idx" ON "crm_campaigns" USING btree ("account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_campaigns_account_id_unique" ON "crm_campaigns" USING btree ("account_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contacts_email_unique" ON "crm_contacts" USING btree ("account_id","normalized_email");
--> statement-breakpoint
CREATE INDEX "crm_contacts_account_idx" ON "crm_contacts" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "crm_contacts_org_idx" ON "crm_contacts" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contacts_account_id_unique" ON "crm_contacts" USING btree ("account_id","id");
--> statement-breakpoint
CREATE INDEX "crm_opps_account_stage_idx" ON "crm_opportunities" USING btree ("account_id","stage");
--> statement-breakpoint
CREATE INDEX "crm_opps_org_idx" ON "crm_opportunities" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_opp_account_id_unique" ON "crm_opportunities" USING btree ("account_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_org_dedupe_unique" ON "crm_organizations" USING btree ("account_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX "crm_org_account_idx" ON "crm_organizations" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "crm_org_name_idx" ON "crm_organizations" USING btree ("account_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_org_account_id_unique" ON "crm_organizations" USING btree ("account_id","id");
--> statement-breakpoint
CREATE INDEX "crm_audit_account_time_idx" ON "crm_audit_events" USING btree ("account_id","occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_booking_link_unique" ON "crm_booking_links" USING btree ("account_id","booking_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_enrollment_unique" ON "crm_enrollments" USING btree ("account_id","campaign_id","contact_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_import_idempotency_unique" ON "crm_imports" USING btree ("account_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "crm_outreach_account_status_idx" ON "crm_outreach_drafts" USING btree ("account_id","status");
--> statement-breakpoint
CREATE INDEX "crm_stage_history_account_idx" ON "crm_stage_history" USING btree ("account_id","changed_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_suppression_account_email_unique" ON "crm_suppression" USING btree ("account_id","normalized_email");
--> statement-breakpoint
CREATE INDEX "crm_tasks_account_due_idx" ON "crm_tasks" USING btree ("account_id","due_at");
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_opportunity_id_crm_opportunities_account_id_id_fk" FOREIGN KEY ("account_id","opportunity_id") REFERENCES "public"."crm_opportunities"("account_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_organization_id_crm_organizations_account_id_id_fk" FOREIGN KEY ("account_id","organization_id") REFERENCES "public"."crm_organizations"("account_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_organization_id_crm_organizations_account_id_id_fk" FOREIGN KEY ("account_id","organization_id") REFERENCES "public"."crm_organizations"("account_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_organizations" ADD CONSTRAINT "crm_organizations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_audit_events" ADD CONSTRAINT "crm_audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_audit_events" ADD CONSTRAINT "crm_audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_booking_links" ADD CONSTRAINT "crm_booking_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_booking_links" ADD CONSTRAINT "crm_booking_links_account_id_opportunity_id_crm_opportunities_account_id_id_fk" FOREIGN KEY ("account_id","opportunity_id") REFERENCES "public"."crm_opportunities"("account_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_enrollments" ADD CONSTRAINT "crm_enrollments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_enrollments" ADD CONSTRAINT "crm_enrollments_account_id_contact_id_crm_contacts_account_id_id_fk" FOREIGN KEY ("account_id","contact_id") REFERENCES "public"."crm_contacts"("account_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_enrollments" ADD CONSTRAINT "crm_enrollments_account_id_campaign_id_crm_campaigns_account_id_id_fk" FOREIGN KEY ("account_id","campaign_id") REFERENCES "public"."crm_campaigns"("account_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_imports" ADD CONSTRAINT "crm_imports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_imports" ADD CONSTRAINT "crm_imports_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_outreach_drafts" ADD CONSTRAINT "crm_outreach_drafts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_outreach_drafts" ADD CONSTRAINT "crm_outreach_drafts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_outreach_drafts" ADD CONSTRAINT "crm_outreach_drafts_account_id_contact_id_crm_contacts_account_id_id_fk" FOREIGN KEY ("account_id","contact_id") REFERENCES "public"."crm_contacts"("account_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_outreach_drafts" ADD CONSTRAINT "crm_outreach_drafts_account_id_campaign_id_crm_campaigns_account_id_id_fk" FOREIGN KEY ("account_id","campaign_id") REFERENCES "public"."crm_campaigns"("account_id","id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_stage_history" ADD CONSTRAINT "crm_stage_history_account_id_opportunity_id_crm_opportunities_account_id_id_fk" FOREIGN KEY ("account_id","opportunity_id") REFERENCES "public"."crm_opportunities"("account_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_suppression" ADD CONSTRAINT "crm_suppression_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_account_id_opportunity_id_crm_opportunities_account_id_id_fk" FOREIGN KEY ("account_id","opportunity_id") REFERENCES "public"."crm_opportunities"("account_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
