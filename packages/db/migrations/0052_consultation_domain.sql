CREATE UNIQUE INDEX "sites_consultation_domain_unique" ON "sites" USING btree (COALESCE("settings"->'consultationDomain'->>'hostname', "settings"->'consultationDomainPending'->>'hostname')) WHERE "sites"."settings" ? 'consultationDomain' OR "sites"."settings" ? 'consultationDomainPending';
--> statement-breakpoint
-- Provider resources remain reserved until their owning detach operation completes.
CREATE FUNCTION enforce_site_consultation_domain() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  field text;
  current_domain jsonb;
  prior_domain jsonb;
  lifecycle jsonb;
  hostname text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.settings ? 'consultationDomain' OR OLD.settings ? 'consultationDomainPending' THEN
      RAISE EXCEPTION 'Detach consultation domains before deleting their site'
        USING ERRCODE = '23514', CONSTRAINT = 'sites_consultation_domain_cleanup_required';
    END IF;
    RETURN OLD;
  END IF;
  lifecycle := NEW.settings->'consultationLifecycle';
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
    AND (OLD.settings ? 'consultationDomain' OR OLD.settings ? 'consultationDomainPending') THEN
    RAISE EXCEPTION 'Detach consultation domains before deleting their site'
      USING ERRCODE = '23514', CONSTRAINT = 'sites_consultation_domain_cleanup_required';
  END IF;
  FOREACH field IN ARRAY ARRAY['consultationDomain','consultationDomainPending'] LOOP
    current_domain := NEW.settings->field;
    prior_domain := NULL;
    IF TG_OP = 'UPDATE' THEN prior_domain := OLD.settings->field; END IF;
    IF current_domain IS NULL THEN CONTINUE; END IF;
    hostname := current_domain->>'hostname';
    IF NOT COALESCE(NEW.settings ? 'consultation',false) OR NEW.visibility <> 'private'
      OR jsonb_typeof(current_domain) IS DISTINCT FROM 'object'
      OR jsonb_typeof(current_domain->'hostname') IS DISTINCT FROM 'string'
      OR char_length(hostname) > 253
      OR NOT COALESCE(hostname ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$',false)
      OR hostname ~ '(^|\.)(revealui\.com|revealuistudio\.com|vercel\.app|localhost|local|internal|test|invalid|example|lan|home|onion)$'
      OR current_domain->'provider' IS DISTINCT FROM '"vercel"'::jsonb
      OR jsonb_typeof(current_domain->'projectId') IS DISTINCT FROM 'string'
      OR NOT COALESCE(current_domain->>'projectId' ~ '^prj_[a-zA-Z0-9]+$',false)
      OR (current_domain - ARRAY['hostname','provider','projectId','verifiedAt']) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Invalid consultation domain binding';
    END IF;
    IF field = 'consultationDomainPending' THEN
      IF current_domain ? 'verifiedAt' THEN RAISE EXCEPTION 'Pending domain cannot claim verification'; END IF;
    ELSE
      IF jsonb_typeof(current_domain->'verifiedAt') IS DISTINCT FROM 'string'
        OR NOT COALESCE(current_domain->>'verifiedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$',false) THEN
        RAISE EXCEPTION 'Invalid consultation domain verification';
      END IF;
      PERFORM (current_domain->>'verifiedAt')::timestamptz;
    END IF;
    IF current_domain IS DISTINCT FROM prior_domain
      AND NOT COALESCE(pg_try_advisory_xact_lock(
        hashtextextended('consultation-domain-owner:' || NEW.owner_id, 0)
      ), false) THEN
      RAISE EXCEPTION 'Account erasure owns domain cleanup admission'
        USING ERRCODE = '23514', CONSTRAINT = 'sites_consultation_domain_cleanup_required';
    END IF;
    IF current_domain IS DISTINCT FROM prior_domain AND (
      lifecycle->'version' IS DISTINCT FROM '1'::jsonb
      OR lifecycle->'revoked' IS DISTINCT FROM 'false'::jsonb
      OR lifecycle->'domainPackPurchased' IS DISTINCT FROM 'true'::jsonb
      OR NOT COALESCE(lifecycle->>'domainPack' IN ('entitled','retained'),false)
      OR NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.owner_id
        AND u.status = 'active' AND u.deleted_at IS NULL AND u.email_verified = true
        AND jsonb_typeof(u._json) = 'object'
        AND jsonb_typeof(u._json->'roles') = 'array'
        AND (u._json->'roles') @> '["super-admin"]'::jsonb
        FOR SHARE
      )
      OR NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.settings->'consultation'->>'buyerUserId'
        AND u.status = 'active' AND u.deleted_at IS NULL AND u.email_verified = true
        FOR SHARE
      )
    ) THEN
      RAISE EXCEPTION 'Consultation domain requires current domain-pack entitlement';
    END IF;
  END LOOP;
  IF NEW.settings ? 'consultationDomain' AND NEW.settings ? 'consultationDomainPending'
    AND (NEW.settings->'consultationDomain'->'hostname' IS DISTINCT FROM NEW.settings->'consultationDomainPending'->'hostname'
      OR NEW.settings->'consultationDomain'->'projectId' IS DISTINCT FROM NEW.settings->'consultationDomainPending'->'projectId') THEN
    RAISE EXCEPTION 'Detach the existing domain before reserving another';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sites_consultation_domain_guard
BEFORE INSERT OR UPDATE OR DELETE ON sites
FOR EACH ROW EXECUTE FUNCTION enforce_site_consultation_domain();
--> statement-breakpoint
-- Erasure cannot disable the only supported cleanup owner while aliases remain.
CREATE FUNCTION enforce_user_consultation_domain_cleanup() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.status = 'deleted' OR NEW.deleted_at IS NOT NULL OR NEW.anonymized_at IS NOT NULL)
    AND EXISTS (
      SELECT 1 FROM sites s WHERE s.owner_id = OLD.id
      AND (s.settings ? 'consultationDomain' OR s.settings ? 'consultationDomainPending')
    ) THEN
    RAISE EXCEPTION 'Detach consultation domains before deleting their owner'
      USING ERRCODE = '23514', CONSTRAINT = 'sites_consultation_domain_cleanup_required';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_consultation_domain_cleanup_guard
BEFORE UPDATE OF status, deleted_at, anonymized_at ON users
FOR EACH ROW EXECUTE FUNCTION enforce_user_consultation_domain_cleanup();
