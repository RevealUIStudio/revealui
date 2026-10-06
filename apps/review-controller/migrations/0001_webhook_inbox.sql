CREATE TABLE IF NOT EXISTS review_controller_webhook_inbox (
  delivery_id text PRIMARY KEY,
  event_name text NOT NULL,
  installation_id bigint NOT NULL CHECK (installation_id > 0),
  repository_id bigint NOT NULL CHECK (repository_id > 0),
  received_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  lease_token uuid,
  last_error_code text,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS review_controller_inbox_pending_idx
  ON review_controller_webhook_inbox (next_attempt_at, received_at, delivery_id)
  WHERE state IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS review_controller_shadow_observations (
  observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL REFERENCES review_controller_webhook_inbox(delivery_id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (event_kind IN ('pull_request', 'merge_group')),
  repository_id bigint NOT NULL CHECK (repository_id > 0),
  pull_request integer CHECK (pull_request > 0),
  head_sha text NOT NULL,
  head_tree_sha text NOT NULL,
  base_sha text,
  base_tree_sha text,
  manifest_sha256 text,
  file_count integer CHECK (file_count >= 0),
  check_runs jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (event_kind = 'pull_request' AND pull_request IS NOT NULL AND base_sha IS NOT NULL
      AND base_tree_sha IS NOT NULL AND manifest_sha256 IS NOT NULL AND file_count IS NOT NULL)
    OR
    (event_kind = 'merge_group' AND pull_request IS NULL AND base_sha IS NOT NULL
      AND base_tree_sha IS NULL AND manifest_sha256 IS NULL AND file_count IS NULL)
  ),
  UNIQUE (delivery_id, pull_request)
);

CREATE UNIQUE INDEX IF NOT EXISTS review_controller_merge_group_delivery_idx
  ON review_controller_shadow_observations (delivery_id)
  WHERE event_kind = 'merge_group';

CREATE TABLE IF NOT EXISTS review_controller_signed_receipts (
  receipt_id text PRIMARY KEY,
  repository_id bigint NOT NULL CHECK (repository_id > 0),
  pull_request integer NOT NULL CHECK (pull_request > 0),
  head_sha text NOT NULL CHECK (head_sha ~ '^[a-f0-9]{40,64}$'),
  base_sha text NOT NULL CHECK (base_sha ~ '^[a-f0-9]{40,64}$'),
  candidate_tree_sha text NOT NULL CHECK (candidate_tree_sha ~ '^[a-f0-9]{40,64}$'),
  policy_version text NOT NULL,
  key_id text NOT NULL,
  envelope_sha256 text NOT NULL CHECK (envelope_sha256 ~ '^[a-f0-9]{64}$'),
  canonical_envelope text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > issued_at),
  stored_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS review_controller_receipt_candidate_idx
  ON review_controller_signed_receipts
    (repository_id, pull_request, head_sha, base_sha, candidate_tree_sha, issued_at DESC);

CREATE OR REPLACE FUNCTION review_controller_reject_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signed review receipts are append-only';
END;
$$;

DROP TRIGGER IF EXISTS review_controller_signed_receipt_immutable
  ON review_controller_signed_receipts;
CREATE TRIGGER review_controller_signed_receipt_immutable
  BEFORE UPDATE OR DELETE ON review_controller_signed_receipts
  FOR EACH ROW EXECUTE FUNCTION review_controller_reject_receipt_mutation();

CREATE INDEX IF NOT EXISTS review_controller_shadow_candidate_idx
  ON review_controller_shadow_observations (repository_id, pull_request, head_sha, base_sha, observed_at DESC);
