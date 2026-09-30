CREATE TABLE IF NOT EXISTS license_operations (
  operation_id text PRIMARY KEY,
  request_fingerprint text NOT NULL,
  customer_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('live', 'test')),
  license_id text NOT NULL,
  license_key text NOT NULL,
  jti text NOT NULL CONSTRAINT license_operations_jti_unique UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

-- One statement/transaction on both Neon HTTP and pg. No compensation can undo containment.
CREATE OR REPLACE FUNCTION license_apply_operation(
  p_operation_id text, p_fingerprint text, p_customer_id text,
  p_expected_key text, p_prior_jti text, p_prior_exp timestamptz,
  p_license_id text, p_license_key text, p_tier text,
  p_expires_at timestamptz, p_perpetual boolean, p_mode text DEFAULT 'live', p_new_jti text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SET search_path = public
AS $license_apply$
DECLARE
  v_operation license_operations%ROWTYPE;
  v_license licenses%ROWTYPE;
BEGIN
  IF nullif(btrim(p_operation_id), '') IS NULL OR
     nullif(btrim(p_fingerprint), '') IS NULL OR
     nullif(btrim(p_customer_id), '') IS NULL OR
     p_mode NOT IN ('live', 'test') THEN
    RAISE EXCEPTION 'license_operation_invalid';
  END IF;
  -- Lock operation first, then customer: retries and independent customer races serialize.
  PERFORM pg_advisory_xact_lock(hashtextextended('license-operation:' || p_operation_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('license-customer:' || p_mode || ':' || p_customer_id, 0));
  SELECT * INTO v_operation FROM license_operations WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_operation.request_fingerprint <> p_fingerprint OR
       v_operation.customer_id <> p_customer_id OR v_operation.mode <> p_mode THEN
      RAISE EXCEPTION 'license_operation_conflict';
    END IF;
    SELECT * INTO v_license FROM licenses WHERE id = v_operation.license_id FOR UPDATE;
    IF NOT FOUND OR v_license.license_key <> v_operation.license_key OR
       v_license.status NOT IN ('active', 'support_expired') OR v_license.deleted_at IS NOT NULL OR
       EXISTS (SELECT 1 FROM license_jti_revocations WHERE jti = v_operation.jti) THEN
      RAISE EXCEPTION 'license_operation_superseded';
    END IF;
    RETURN v_operation.license_key;
  END IF;
  IF p_license_key IS NULL THEN RETURN NULL; END IF;
  IF p_new_jti IS NULL OR p_new_jti = '' OR p_new_jti <> btrim(p_new_jti) OR
     p_license_key = '' OR p_tier NOT IN ('pro', 'max', 'enterprise') OR
     p_perpetual IS NULL OR (p_perpetual AND p_expires_at IS NOT NULL) OR
     (NOT p_perpetual AND p_expires_at IS NULL) THEN
    RAISE EXCEPTION 'license_operation_invalid';
  END IF;
  IF EXISTS (SELECT 1 FROM license_jti_revocations WHERE jti = p_new_jti) THEN
    RAISE EXCEPTION 'license_new_identity_revoked';
  END IF;
  IF p_expected_key IS NULL THEN
    -- Initial issuance cannot replace, or resurrect, any existing customer lineage.
    IF EXISTS (SELECT 1 FROM licenses WHERE customer_id = p_customer_id AND mode = p_mode) THEN
      RAISE EXCEPTION 'license_current_conflict';
    END IF;
    INSERT INTO licenses(id, license_key, tier, customer_id, status, expires_at, perpetual, mode)
    VALUES(p_license_id, p_license_key, p_tier, p_customer_id, 'active', p_expires_at, p_perpetual, p_mode);
  ELSE
    IF p_prior_jti IS NULL OR p_prior_jti = '' OR p_prior_jti <> btrim(p_prior_jti) THEN
      RAISE EXCEPTION 'license_prior_identity_invalid';
    END IF;
    SELECT * INTO v_license FROM licenses
      WHERE customer_id = p_customer_id AND mode = p_mode AND license_key = p_expected_key FOR UPDATE;
    IF NOT FOUND OR v_license.deleted_at IS NOT NULL OR
       v_license.status NOT IN ('active', 'support_expired') OR
       EXISTS (SELECT 1 FROM license_jti_revocations WHERE jti = p_prior_jti) THEN
      RAISE EXCEPTION 'license_current_conflict';
    END IF;
    INSERT INTO license_jti_revocations(jti, customer_id, reason, token_expires_at)
      VALUES(p_prior_jti, p_customer_id, 'operator_rotation', p_prior_exp);
    UPDATE licenses SET license_key = p_license_key, tier = p_tier,
      expires_at = p_expires_at, perpetual = p_perpetual, updated_at = now()
      WHERE id = v_license.id AND license_key = p_expected_key;
    p_license_id := v_license.id;
  END IF;
  INSERT INTO license_operations(operation_id, request_fingerprint, customer_id, mode, license_id, license_key, jti)
    VALUES(p_operation_id, p_fingerprint, p_customer_id, p_mode, p_license_id, p_license_key, p_new_jti);
  RETURN p_license_key;
END;
$license_apply$;
