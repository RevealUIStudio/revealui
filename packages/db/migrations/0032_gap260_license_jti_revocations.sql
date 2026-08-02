-- GAP-260 P4-5: per-jti license denylist for individual token revocation
-- without rotating the vendor Ed25519 key. Fail-open for unknown jtis;
-- sticky once observed revoked (enforced in app-layer cache).

CREATE TABLE IF NOT EXISTS "license_jti_revocations" (
  "jti" text PRIMARY KEY NOT NULL,
  "customer_id" text,
  "reason" text NOT NULL DEFAULT 'revoked',
  "revoked_at" timestamptz NOT NULL DEFAULT now(),
  "token_expires_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "license_jti_revocations_customer_id_idx"
  ON "license_jti_revocations" ("customer_id");

CREATE INDEX IF NOT EXISTS "license_jti_revocations_revoked_at_idx"
  ON "license_jti_revocations" ("revoked_at");
