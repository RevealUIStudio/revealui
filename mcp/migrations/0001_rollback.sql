-- Rollback for 0001_add_crdt_columns.sql
ALTER TABLE IF EXISTS documents
  DROP COLUMN IF EXISTS _electric_meta;

ALTER TABLE IF EXISTS subscription_state
  DROP COLUMN IF EXISTS _electric_meta;
