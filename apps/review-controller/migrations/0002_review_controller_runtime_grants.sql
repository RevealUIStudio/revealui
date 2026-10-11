DO $$
DECLARE
  runtime_role oid;
BEGIN
  SELECT oid INTO runtime_role
  FROM pg_roles
  WHERE rolname = 'revealui-review-controller';

  IF runtime_role IS NULL THEN
    RAISE EXCEPTION 'review_controller_runtime_role_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    WHERE membership.member = runtime_role
  ) THEN
    RAISE EXCEPTION 'review_controller_runtime_role_has_role_membership';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = runtime_role
      AND (
        NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole
        OR rolreplication OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION 'review_controller_runtime_role_has_elevated_attributes';
  END IF;

  IF current_user = 'revealui-review-controller' THEN
    RAISE EXCEPTION 'review_controller_migrations_require_an_owner_connection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname IN ('public', 'drizzle')
      AND nspowner = runtime_role
  ) OR EXISTS (
    SELECT 1
    FROM pg_class object
    JOIN pg_namespace schema ON schema.oid = object.relnamespace
    WHERE schema.nspname IN ('public', 'drizzle')
      AND object.relowner = runtime_role
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc object
    JOIN pg_namespace schema ON schema.oid = object.pronamespace
    WHERE schema.nspname IN ('public', 'drizzle')
      AND object.proowner = runtime_role
  ) THEN
    RAISE EXCEPTION 'review_controller_runtime_role_owns_database_objects';
  END IF;
END $$;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SCHEMA public FROM "revealui-review-controller";
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO "revealui-review-controller";
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
  public.review_controller_webhook_inbox,
  public.review_controller_shadow_observations,
  public.review_controller_signed_receipts
FROM PUBLIC, "revealui-review-controller";
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.review_controller_webhook_inbox
TO "revealui-review-controller";
--> statement-breakpoint
GRANT UPDATE (state, attempts, next_attempt_at, locked_until, lease_token, last_error_code, completed_at)
ON TABLE public.review_controller_webhook_inbox
TO "revealui-review-controller";
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE
  public.review_controller_shadow_observations,
  public.review_controller_signed_receipts
TO "revealui-review-controller";
