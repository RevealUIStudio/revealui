-- Validation-only custody. This migration grants no merge execution capability
-- and no access to the currently deployed controller role.
CREATE TABLE review_controller_merge_intents (
  job_id text PRIMARY KEY CHECK (job_id ~ '^[a-f0-9]{64}$'),
  repository_id bigint NOT NULL CHECK (repository_id > 0),
  base_ref text NOT NULL CHECK (base_ref LIKE 'refs/heads/%'),
  canonical_payload text NOT NULL CHECK (octet_length(canonical_payload) <= 8192),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'proposed'
    CHECK (state IN ('proposed', 'dispatch-committed', 'unknown', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (encode(sha256(convert_to(canonical_payload, 'UTF8')), 'hex') = payload_sha256),
  CHECK ((canonical_payload::jsonb->>'schema' = 'revealfleet-merge-intent/v1') IS TRUE),
  CHECK ((canonical_payload::jsonb->>'purpose' = 'validation-only') IS TRUE),
  CHECK ((canonical_payload::jsonb->>'jobId' = job_id) IS TRUE),
  CHECK (((canonical_payload::jsonb->>'repositoryId')::bigint = repository_id) IS TRUE),
  CHECK ((canonical_payload::jsonb->>'baseRef' = base_ref) IS TRUE)
);
--> statement-breakpoint
-- No timeout, lease or other job ID can acquire a consumed base scope.
CREATE UNIQUE INDEX review_controller_merge_scope_consumed
  ON review_controller_merge_intents (repository_id, base_ref)
  WHERE state IN ('dispatch-committed', 'unknown');
--> statement-breakpoint
CREATE FUNCTION review_controller_guard_merge_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'merge_intent_deletion_forbidden';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'proposed' THEN RAISE EXCEPTION 'merge_intent_initial_state_invalid'; END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW.job_id, NEW.repository_id, NEW.base_ref, NEW.canonical_payload, NEW.payload_sha256, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.job_id, OLD.repository_id, OLD.base_ref, OLD.canonical_payload, OLD.payload_sha256, OLD.created_at) THEN
    RAISE EXCEPTION 'merge_intent_identity_immutable';
  END IF;
  IF NOT ((OLD.state = 'proposed' AND NEW.state IN ('dispatch-committed', 'rejected'))
    OR (OLD.state = 'dispatch-committed' AND NEW.state = 'unknown')) THEN
    RAISE EXCEPTION 'merge_intent_transition_forbidden';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER review_controller_merge_intent_guard
  BEFORE INSERT OR UPDATE OR DELETE ON review_controller_merge_intents
  FOR EACH ROW EXECUTE FUNCTION review_controller_guard_merge_intent();
--> statement-breakpoint
CREATE TABLE review_controller_merge_reconciliation_observations (
  observation_id text PRIMARY KEY CHECK (observation_id ~ '^[a-f0-9]{64}$'),
  job_id text NOT NULL REFERENCES review_controller_merge_intents(job_id),
  kind text NOT NULL CHECK (kind IN ('refs-unchanged', 'refs-advanced', 'pr-outcome-observed', 'definitive-rejection', 'delivery-uncertain')),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE FUNCTION review_controller_guard_merge_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'merge_reconciliation_observation_immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER review_controller_merge_observation_guard
  BEFORE UPDATE OR DELETE ON review_controller_merge_reconciliation_observations
  FOR EACH ROW EXECUTE FUNCTION review_controller_guard_merge_observation();
--> statement-breakpoint
REVOKE ALL ON review_controller_merge_intents, review_controller_merge_reconciliation_observations
  FROM PUBLIC, "revealui-review-controller";

--> statement-breakpoint
CREATE TRIGGER review_controller_merge_intent_no_truncate
  BEFORE TRUNCATE ON review_controller_merge_intents
  FOR EACH STATEMENT EXECUTE FUNCTION review_controller_guard_merge_intent();
--> statement-breakpoint
CREATE TRIGGER review_controller_merge_observation_no_truncate
  BEFORE TRUNCATE ON review_controller_merge_reconciliation_observations
  FOR EACH STATEMENT EXECUTE FUNCTION review_controller_guard_merge_observation();
