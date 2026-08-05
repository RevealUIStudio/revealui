-- GAP-176: coordination_mail.id SERIAL → UUID so daemon dual-write can share
-- a single id with PGlite agent_messages (no subject/body markRead heuristic).
-- Rebuild table; existing rows get gen_random_uuid() ordered by old serial id
-- (chronological preserve). No FKs point at coordination_mail.id.

CREATE TABLE IF NOT EXISTS "coordination_mail_uuid" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_agent" text NOT NULL,
  "to_agent" text NOT NULL,
  "subject" text NOT NULL,
  "body" text,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "coordination_mail_uuid" ("id", "from_agent", "to_agent", "subject", "body", "read", "created_at")
SELECT gen_random_uuid(), "from_agent", "to_agent", "subject", "body", "read", "created_at"
FROM "coordination_mail"
ORDER BY "id" ASC, "created_at" ASC;
--> statement-breakpoint
DROP TABLE IF EXISTS "coordination_mail";
--> statement-breakpoint
ALTER TABLE "coordination_mail_uuid" RENAME TO "coordination_mail";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coordination_mail_to_read_idx"
  ON "coordination_mail" USING btree ("to_agent", "read");
