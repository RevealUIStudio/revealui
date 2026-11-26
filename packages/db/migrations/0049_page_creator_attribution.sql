-- Legacy pages and historical revisions cannot establish who created a page.
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "created_by" text;
DO $$ BEGIN
  ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "pages_creator_site_idx" ON "pages" ("created_by", "site_id");
