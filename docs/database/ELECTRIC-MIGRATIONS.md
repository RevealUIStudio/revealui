-- ElectricSQL Electrification Migrations
--
-- This file documents the SQL migrations needed to electrify tables for sync.
-- These should be run via ElectricSQL CLI or service after setting up the service.
--
-- Electrification enables tables to be synchronized to client applications.
-- Each table needs to be explicitly electrified with appropriate sync rules.

-- Electrify agent_contexts table
-- Syncs contexts filtered by agent_id and optional session_id
ALTER TABLE agent_contexts ENABLE ELECTRIC;

-- Electrify agent_memories table
-- Syncs memories filtered by agent_id and optional site_id
ALTER TABLE agent_memories ENABLE ELECTRIC;

-- Electrify conversations table
-- Syncs conversations filtered by user_id and optional agent_id
ALTER TABLE conversations ENABLE ELECTRIC;

-- Electrify agent_actions table
-- Syncs actions filtered by agent_id and optional conversation_id
ALTER TABLE agent_actions ENABLE ELECTRIC;

-- Note: Row Level Security (RLS) policies should be configured in PostgreSQL
-- to enforce data filtering at the database level. The sync shapes in the
-- client code (packages/sync/src/sync/shapes.ts) work in conjunction with
-- RLS policies to ensure only authorized data is synced.

-- Example RLS policies (should be created in your database migrations):
--
-- CREATE POLICY sync_agent_contexts_policy ON agent_contexts
--   FOR SELECT
--   USING (
--     agent_id = current_setting('app.agent_id', true)::text
--     AND (
--       session_id = current_setting('app.session_id', true)::text
--       OR current_setting('app.session_id', true) IS NULL
--     )
--   );
--
-- CREATE POLICY sync_agent_memories_policy ON agent_memories
--   FOR SELECT
--   USING (
--     agent_id = current_setting('app.agent_id', true)::text
--     AND (
--       site_id = current_setting('app.site_id', true)::text
--       OR current_setting('app.site_id', true) IS NULL
--     )
--   );
--
-- CREATE POLICY sync_conversations_policy ON conversations
--   FOR SELECT
--   USING (
--     user_id = current_setting('app.user_id', true)::text
--     AND (
--       agent_id = current_setting('app.agent_id', true)::text
--       OR current_setting('app.agent_id', true) IS NULL
--     )
--   );
--
-- CREATE POLICY sync_agent_actions_policy ON agent_actions
--   FOR SELECT
--   USING (
--     agent_id = current_setting('app.agent_id', true)::text
--     AND (
--       conversation_id = current_setting('app.conversation_id', true)::text
--       OR current_setting('app.conversation_id', true) IS NULL
--     )
--   );
