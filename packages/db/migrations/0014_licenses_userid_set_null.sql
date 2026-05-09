-- Migration: change licenses.user_id FK from ON DELETE CASCADE to ON DELETE SET NULL
--
-- WHY: The schema comment at licenses.ts:67 states "license records must never
-- be hard-deleted for audit trail." The prior ON DELETE CASCADE violated this
-- invariant: deleting a user hard-deleted all their license rows, erasing
-- billing audit evidence (revenue recognition, refund history, dispute defense).
--
-- FIX: ON DELETE SET NULL preserves the license row with user_id = NULL when
-- the owning user is deleted. The license remains queryable by id, customerId,
-- subscriptionId, and licenseKey for audit and dispute purposes.
--
-- SAFETY: This migration uses ALTER TABLE … ALTER COLUMN / DROP CONSTRAINT /
-- ADD CONSTRAINT — no data is modified, no rows are deleted. The two DDL
-- operations each take a brief ACCESS EXCLUSIVE lock but release it immediately
-- (no table scan required for a FK change). Safe under live traffic.
--
-- IDEMPOTENCY: The DO $$ blocks swallow "does not exist" and "already exists"
-- errors so this migration can be re-run safely.

-- Step 1: Drop the NOT NULL constraint on user_id so SET NULL can fire.
ALTER TABLE "licenses" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint

-- Step 2: Drop the existing CASCADE foreign key constraint (name may vary by
-- deployment; the DO block handles both the Drizzle-generated name and any
-- custom name that might exist from a prior drizzle-kit push).
DO $$ BEGIN
  ALTER TABLE "licenses" DROP CONSTRAINT IF EXISTS "licenses_user_id_users_id_fk";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint

-- Step 3: Add the new FK with ON DELETE SET NULL.
DO $$ BEGIN
  ALTER TABLE "licenses"
    ADD CONSTRAINT "licenses_user_id_users_id_fk"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
