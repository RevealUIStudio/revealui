-- Phase 5.3: Perpetual License Infrastructure
-- Adds columns to support one-time perpetual license purchases (Track C).
--
-- perpetual        — true for one-time payment licenses, never expire
-- support_expires_at — when the annual support contract lapses (perpetual only)
-- github_username  — GitHub username for revealui-pro team provisioning (perpetual only)

ALTER TABLE "licenses"
  ADD COLUMN IF NOT EXISTS "perpetual" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "support_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "github_username" text;
