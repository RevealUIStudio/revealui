CREATE OR REPLACE FUNCTION review_controller_reject_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signed review receipts are append-only';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS review_controller_signed_receipt_immutable
  ON review_controller_signed_receipts;
--> statement-breakpoint
CREATE TRIGGER review_controller_signed_receipt_immutable
  BEFORE UPDATE OR DELETE ON review_controller_signed_receipts
  FOR EACH ROW EXECUTE FUNCTION review_controller_reject_receipt_mutation();
