-- Stripe Integration Tables
-- Using Drizzle ORM with Supabase

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY REFERENCES auth.users(id) NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"billing_address" jsonb,
	"payment_method" jsonb,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Customers table (private mapping)
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY REFERENCES auth.users(id) NOT NULL,
	"stripe_customer_id" text
);

-- Products table
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY,
	"active" boolean DEFAULT true,
	"name" text,
	"description" text,
	"image" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Prices table
CREATE TYPE "pricing_type" AS ENUM('one_time', 'recurring');
CREATE TYPE "pricing_plan_interval" AS ENUM('day', 'week', 'month', 'year');

CREATE TABLE IF NOT EXISTS "prices" (
	"id" text PRIMARY KEY,
	"product_id" text REFERENCES products(id),
	"active" boolean DEFAULT true,
	"description" text,
	"unit_amount" bigint,
	"currency" text,
	"type" pricing_type,
	"interval" pricing_plan_interval,
	"interval_count" integer,
	"trial_period_days" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Subscriptions table
CREATE TYPE "subscription_status" AS ENUM('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid');

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" text PRIMARY KEY,
	"user_id" uuid REFERENCES auth.users(id) NOT NULL,
	"status" subscription_status,
	"metadata" jsonb,
	"price_id" text REFERENCES prices(id),
	"quantity" integer,
	"cancel_at_period_end" boolean DEFAULT false,
	"created" timestamp with time zone DEFAULT now(),
	"current_period_start" timestamp with time zone DEFAULT now(),
	"current_period_end" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"stripe_subscription_id" text UNIQUE,
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Can view own user data." ON "users"
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Can update own user data." ON "users"
  FOR UPDATE USING (auth.uid() = id);

-- Products and prices are public
CREATE POLICY "Allow public read-only access." ON "products"
  FOR SELECT USING (true);

CREATE POLICY "Allow public read-only access." ON "prices"
  FOR SELECT USING (true);

-- Subscriptions are private to user
CREATE POLICY "Can only view own subs data." ON "subscriptions"
  FOR SELECT USING (auth.uid() = user_id);

-- Auto-create user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Realtime subscriptions
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE products, prices;