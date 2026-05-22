ALTER TABLE "revealcoin_payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "revealcoin_price_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "revealcoin_payments" CASCADE;--> statement-breakpoint
DROP TABLE "revealcoin_price_snapshots" CASCADE;