CREATE TABLE "review_controller_receipt_authorizations" (
  "repository_id" bigint NOT NULL CHECK ("repository_id" > 0),
  "pull_request" integer NOT NULL CHECK ("pull_request" > 0),
  "generation" bigint NOT NULL CHECK ("generation" > 0 AND "generation" <= 9007199254740991),
  "state" text NOT NULL CHECK ("state" IN ('pending', 'approved', 'revoked', 'expired')),
  "receipt_id" text,
  "envelope_sha256" text,
  "expires_at" timestamptz,
  PRIMARY KEY ("repository_id", "pull_request"),
  CONSTRAINT "review_controller_authorization_approval_shape" CHECK (
    "state" <> 'approved' OR ("receipt_id" IS NOT NULL AND "envelope_sha256" IS NOT NULL AND "envelope_sha256" ~ '^[a-f0-9]{64}$' AND "expires_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE FUNCTION "review_controller_authorization_monotonic"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.generation <> 1 OR NEW.state <> 'pending' THEN
      RAISE EXCEPTION 'receipt_authorization_initial_state_invalid';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.repository_id <> OLD.repository_id OR NEW.pull_request <> OLD.pull_request
     OR NEW.generation < OLD.generation
     OR (NEW.generation = OLD.generation AND
         (OLD.state <> 'pending' OR NEW.state NOT IN ('approved', 'revoked')))
     OR (NEW.generation > OLD.generation AND NEW.state NOT IN ('pending', 'expired')) THEN
    RAISE EXCEPTION 'receipt_authorization_generation_not_monotonic';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "review_controller_authorization_monotonic_guard" BEFORE INSERT OR UPDATE ON "review_controller_receipt_authorizations"
FOR EACH ROW EXECUTE FUNCTION "review_controller_authorization_monotonic"();
--> statement-breakpoint
GRANT SELECT, INSERT ON "review_controller_receipt_authorizations" TO "revealui-review-controller";
--> statement-breakpoint
GRANT UPDATE ("generation", "state", "receipt_id", "envelope_sha256", "expires_at")
ON "review_controller_receipt_authorizations" TO "revealui-review-controller";
