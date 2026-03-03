-- Migration: 0012_add_registered_agents
-- Adds a persistence table for custom A2A agent definitions.
-- Built-in platform agents (revealui-creator, revealui-ticket-agent) are never
-- written here — they are always seeded in-memory by AgentCardRegistry.

CREATE TABLE IF NOT EXISTS "registered_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
