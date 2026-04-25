-- Custom migration: DB-level enforcement of per-account seat limits
-- (CR8-P2-03 defense-in-depth).
--
-- App-level guard at apps/api/src/lib/seat-count-guard.ts enforces the same
-- rule before inserts in normal application paths. This trigger is the
-- backstop for direct-SQL paths (admin scripts, manual fixes, future code
-- that forgets to call the guard). Rule source of truth is
-- account_entitlements.limits->>'maxUsers'; NULL means unlimited
-- (enterprise / Forge) and the trigger is a no-op.
--
-- All statements idempotent (CREATE OR REPLACE, DROP ... IF EXISTS, create-
-- before-drop-before-create for triggers).

CREATE OR REPLACE FUNCTION enforce_account_membership_seat_limit()
RETURNS trigger AS $$
DECLARE
  v_max_users integer;
  v_current_count integer;
BEGIN
  -- Only active memberships count toward the cap. Invited / revoked rows are
  -- allowed without bound.
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  -- Read the tier-derived limit from the entitlements row. Absent row OR
  -- absent maxUsers key = unlimited (enterprise / Forge default).
  SELECT (limits->>'maxUsers')::integer
  INTO v_max_users
  FROM account_entitlements
  WHERE account_id = NEW.account_id;

  IF v_max_users IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current active memberships. For UPDATE transitioning status to
  -- 'active', exclude the row being updated so a self-update doesn't
  -- double-count.
  SELECT COUNT(*)
  INTO v_current_count
  FROM account_memberships
  WHERE account_id = NEW.account_id
    AND status = 'active'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_current_count >= v_max_users THEN
    RAISE EXCEPTION 'seat_limit_reached: account % has % active members (max: %)',
      NEW.account_id, v_current_count, v_max_users
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_memberships_seat_limit_check ON "account_memberships";
CREATE TRIGGER account_memberships_seat_limit_check
  BEFORE INSERT OR UPDATE OF status ON "account_memberships"
  FOR EACH ROW EXECUTE FUNCTION enforce_account_membership_seat_limit();
