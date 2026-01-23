-- Setup Supabase for ElectricSQL logical replication
-- Run these commands in your Supabase SQL Editor

-- 1. Create publication for sync tables
CREATE PUBLICATION electric_publication FOR TABLE
  conversations,
  messages,
  user_devices;

-- 2. Create replication slot
SELECT pg_create_logical_replication_slot('electric_slot', 'pgoutput');

-- 3. Verify replication is working
SELECT * FROM pg_stat_replication;
SELECT * FROM pg_replication_slots;