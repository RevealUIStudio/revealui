-- Database Reset Script
-- WARNING: This will drop all tables and data!
-- Only run this in development

-- Drop all tables (in reverse dependency order to avoid foreign key constraints)
DROP TABLE IF EXISTS "agent_actions" CASCADE;
DROP TABLE IF EXISTS "conversations" CASCADE;
DROP TABLE IF EXISTS "agent_memories" CASCADE;
DROP TABLE IF EXISTS "agent_contexts" CASCADE;
DROP TABLE IF EXISTS "page_revisions" CASCADE;
DROP TABLE IF EXISTS "pages" CASCADE;
DROP TABLE IF EXISTS "site_collaborators" CASCADE;
DROP TABLE IF EXISTS "sites" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "media" CASCADE;
DROP TABLE IF EXISTS "posts" CASCADE;
DROP TABLE IF EXISTS "crdt_operations" CASCADE;
DROP TABLE IF EXISTS "node_ids" CASCADE;
DROP TABLE IF EXISTS "query_cache" CASCADE;

-- Note: Extensions and other database objects are preserved
-- Run the initial migration (0000_misty_pepper_potts.sql) to recreate tables
