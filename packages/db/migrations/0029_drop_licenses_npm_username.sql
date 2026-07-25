-- GAP-302 residual (b): drop unused licenses.npm_username.
-- Never written at runtime; perpetual package access is GitHub-team based
-- (github_username + provisionGitHubAccess). Safe DROP — column is nullable
-- and has no FKs or indexes.

ALTER TABLE "licenses" DROP COLUMN IF EXISTS "npm_username";
