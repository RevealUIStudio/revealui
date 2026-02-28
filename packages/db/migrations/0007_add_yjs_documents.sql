-- Migration 0007: Add yjs_documents table for Yjs CRDT collab persistence
-- Used by the API /api/collab/* endpoints and ElectricSQL real-time sync

CREATE TABLE IF NOT EXISTS "yjs_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "state" bytea NOT NULL,
  "state_vector" bytea,
  "connected_clients" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
