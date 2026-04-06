-- Add idempotency_keys table for saga deduplication
-- Part of the NeonSaga safe operations layer.
--
-- This table prevents duplicate execution of sagas and idempotent operations.
-- Keys have a TTL (expires_at) and should be cleaned up periodically via
-- cleanupExpiredIdempotencyKeys().

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"operation_type" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idempotency_keys_operation_type_idx"
	ON "idempotency_keys" USING btree ("operation_type");

CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx"
	ON "idempotency_keys" USING btree ("expires_at");
