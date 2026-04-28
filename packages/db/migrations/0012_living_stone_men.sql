CREATE TABLE IF NOT EXISTS "workspace_inference_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text,
	"key_hint" text,
	"model" text,
	"base_url" text,
	"temperature" real,
	"max_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_inference_configs_provider_check" CHECK (provider IN ('groq', 'huggingface', 'inference-snaps', 'ollama')),
	CONSTRAINT "workspace_inference_configs_key_pairing_check" CHECK ((
        (provider IN ('inference-snaps', 'ollama') AND encrypted_api_key IS NULL)
        OR
        (provider IN ('groq', 'huggingface') AND encrypted_api_key IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "user_api_keys" DROP CONSTRAINT IF EXISTS "user_api_keys_provider_check";--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "workspace_inference_configs" ADD CONSTRAINT "workspace_inference_configs_workspace_id_sites_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_inference_configs_workspace_id_uidx" ON "workspace_inference_configs" USING btree ("workspace_id");--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_provider_check" CHECK (provider IN ('groq', 'huggingface', 'inference-snaps', 'ollama'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
