-- Track B: Agent task metering — usage counter per user per billing cycle.
-- Composite PK (user_id, cycle_start) — one row per user per calendar month.
-- count  = total tasks executed (including overage)
-- overage = tasks beyond the tier quota (for Stripe usage records)

CREATE TABLE IF NOT EXISTS "agent_task_usage" (
	"user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"cycle_start" timestamp with time zone NOT NULL,
	"count"      integer NOT NULL DEFAULT 0,
	"overage"    integer NOT NULL DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_task_usage_pkey" PRIMARY KEY ("user_id", "cycle_start")
);
