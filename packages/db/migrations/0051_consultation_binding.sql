CREATE UNIQUE INDEX "sites_consultation_booking_unique" ON "sites" USING btree (("settings"->'consultation'->>'bookingId')) WHERE "sites"."settings" ? 'consultation';
--> statement-breakpoint
-- The existing site settings store owns consultation provenance. Membership and
-- publication may be revoked independently; the verified booking binding stays.
CREATE FUNCTION enforce_site_consultation_binding() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  binding jsonb := NEW.settings->'consultation';
  previously_bound boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    previously_bound := COALESCE(OLD.settings ? 'consultation', false);
    IF previously_bound AND (
      NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
      binding IS DISTINCT FROM OLD.settings->'consultation'
    ) THEN
      RAISE EXCEPTION 'Consultation booking, buyer and owner binding is immutable';
    END IF;
  END IF;

  IF binding IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(binding) IS DISTINCT FROM 'object' OR
     binding->'version' IS DISTINCT FROM '1'::jsonb OR
     binding->>'kind' IS DISTINCT FROM 'studio-consultation' OR
     jsonb_typeof(binding->'bookingId') IS DISTINCT FROM 'string' OR
     jsonb_typeof(binding->'buyerUserId') IS DISTINCT FROM 'string' OR
     length(btrim(binding->>'bookingId')) NOT BETWEEN 1 AND 256 OR
     length(btrim(binding->>'buyerUserId')) NOT BETWEEN 1 AND 256 OR
     binding->>'bookingId' IS DISTINCT FROM btrim(binding->>'bookingId') OR
     binding->>'buyerUserId' IS DISTINCT FROM btrim(binding->>'buyerUserId') OR
     binding - ARRAY['version','kind','bookingId','buyerUserId']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid consultation booking binding';
  END IF;
  IF NEW.visibility IS DISTINCT FROM 'private' THEN
    RAISE EXCEPTION 'Consultation material must remain private';
  END IF;

  -- Check authority at binding creation. Later unpublication/soft deletion must
  -- remain possible when an operator or buyer has been disabled or deleted.
  IF NOT previously_bound THEN
    IF NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = NEW.owner_id
      AND u.status = 'active' AND u.deleted_at IS NULL AND u.email_verified = true
      AND jsonb_typeof(u._json) = 'object'
      AND jsonb_typeof(u._json->'roles') = 'array'
      AND (u._json->'roles') @> '["super-admin"]'::jsonb
    ) THEN
      RAISE EXCEPTION 'Consultation binding requires a verified platform operator owner';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = binding->>'buyerUserId'
      AND u.status = 'active' AND u.deleted_at IS NULL AND u.email_verified = true
    ) THEN
      RAISE EXCEPTION 'Consultation binding requires a verified active buyer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sites_consultation_binding_guard
BEFORE INSERT OR UPDATE ON sites
FOR EACH ROW EXECUTE FUNCTION enforce_site_consultation_binding();
--> statement-breakpoint
-- Lifecycle authority survives stale publication, member grants, and process restarts.
CREATE FUNCTION enforce_site_consultation_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_state jsonb := NEW.settings->'consultationLifecycle';
  prior_state jsonb;
  amount numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN prior_state := OLD.settings->'consultationLifecycle'; END IF;
  IF prior_state IS NOT NULL AND current_state IS NULL THEN
    RAISE EXCEPTION 'Consultation lifecycle cannot be removed';
  END IF;
  IF current_state IS NULL THEN RETURN NEW; END IF;
  IF NOT COALESCE(NEW.settings ? 'consultation', false)
    OR jsonb_typeof(current_state) IS DISTINCT FROM 'object'
    OR current_state->'version' IS DISTINCT FROM '1'::jsonb
    OR jsonb_typeof(current_state->'revoked') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(current_state->'domainPackPurchased') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(current_state->'domainPack') IS DISTINCT FROM 'string'
    OR NOT COALESCE(current_state->>'domainPack' IN
      ('entitled','unentitled','review_required','retained','revoked'), false)
    OR jsonb_typeof(current_state->'amountRefunded') IS DISTINCT FROM 'number'
    OR NOT COALESCE(current_state->>'amountRefunded' ~ '^[0-9]+$', false)
    OR (current_state - ARRAY['version','revoked','domainPackPurchased','domainPack',
      'amountRefunded','chargeId']) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid consultation lifecycle';
  END IF;
  amount := (current_state->>'amountRefunded')::numeric;
  IF amount > 9007199254740991
    OR (amount > 0 AND NOT COALESCE(current_state->>'chargeId' ~ '^ch_[a-zA-Z0-9]+$',false))
    OR (amount = 0 AND current_state ? 'chargeId')
    OR (current_state ? 'chargeId' AND jsonb_typeof(current_state->'chargeId') <> 'string')
    OR (current_state->'revoked' = 'true'::jsonb AND current_state->>'domainPack' <> 'revoked') THEN
    RAISE EXCEPTION 'Invalid consultation refund authority';
  END IF;
  IF prior_state IS NOT NULL THEN
    IF (prior_state->'revoked' = 'true'::jsonb AND current_state->'revoked' <> 'true'::jsonb)
      OR amount < (prior_state->>'amountRefunded')::numeric
      OR (prior_state ? 'chargeId' AND current_state->'chargeId' IS DISTINCT FROM prior_state->'chargeId')
      OR (prior_state->'domainPackPurchased' = 'false'::jsonb AND current_state->'domainPackPurchased' <> 'false'::jsonb)
      OR (prior_state->>'domainPack' = 'revoked' AND amount = (prior_state->>'amountRefunded')::numeric
        AND current_state->>'domainPack' <> 'revoked' AND current_state->'revoked' <> 'true'::jsonb) THEN
      RAISE EXCEPTION 'Consultation lifecycle authority cannot regress';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sites_consultation_lifecycle_guard
BEFORE INSERT OR UPDATE ON sites
FOR EACH ROW EXECUTE FUNCTION enforce_site_consultation_lifecycle();
--> statement-breakpoint
-- A verification belongs to the exact email. Generic updates and stale links
-- must never transfer proof of an old address to its replacement.
CREATE FUNCTION invalidate_changed_user_email() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email_verified := false;
    NEW.email_verified_at := NULL;
    NEW.email_verification_token := NULL;
    NEW.email_verification_token_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_email_verification_guard
BEFORE UPDATE OF email ON users
FOR EACH ROW EXECUTE FUNCTION invalidate_changed_user_email();
