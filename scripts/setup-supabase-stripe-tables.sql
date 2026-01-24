-- Setup Supabase tables for Stripe integration
-- Inspired by Next.js Stripe subscriptions starter
-- Run this in your Supabase SQL Editor

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  -- UUID from auth.users
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  -- The customer's billing address, stored in JSON format.
  billing_address JSONB,
  -- Stores your customer's payment instruments.
  payment_method JSONB,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user function
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

-- Auto-create user trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create customers table (private mapping)
CREATE TABLE IF NOT EXISTS customers (
  -- UUID from auth.users
  id UUID REFERENCES auth.users PRIMARY KEY,
  -- The user's customer ID in Stripe
  stripe_customer_id TEXT UNIQUE
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  -- Product ID from Stripe, e.g. prod_1234.
  id TEXT PRIMARY KEY,
  -- Whether the product is currently available for purchase.
  active BOOLEAN DEFAULT true,
  -- The product's name
  name TEXT,
  -- The product's description
  description TEXT,
  -- A URL of the product image in Stripe
  image TEXT,
  -- Set of key-value pairs
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prices table
CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');

CREATE TABLE IF NOT EXISTS prices (
  -- Price ID from Stripe, e.g. price_1234.
  id TEXT PRIMARY KEY,
  -- The ID of the product that this price belongs to.
  product_id TEXT REFERENCES products(id),
  -- Whether the price can be used for new purchases.
  active BOOLEAN DEFAULT true,
  -- A brief description of the price.
  description TEXT,
  -- The unit amount in the smallest currency unit (e.g., 100 cents for US$1.00).
  unit_amount BIGINT,
  -- Three-letter ISO currency code, in lowercase.
  currency TEXT,
  -- One of `one_time` or `recurring`
  type pricing_type,
  -- The frequency at which a subscription is billed.
  interval pricing_plan_interval,
  -- The number of intervals between subscription billings.
  interval_count INTEGER,
  -- Default number of trial days
  trial_period_days INTEGER,
  -- Set of key-value pairs
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid');

CREATE TABLE IF NOT EXISTS subscriptions (
  -- Subscription ID from Stripe, e.g. sub_1234.
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  -- The status of the subscription object
  status subscription_status,
  -- Set of key-value pairs
  metadata JSONB,
  -- ID of the price that created this subscription.
  price_id TEXT REFERENCES prices(id),
  -- Quantity multiplied by the unit amount
  quantity INTEGER,
  -- If true the subscription has been canceled by the user
  cancel_at_period_end BOOLEAN DEFAULT false,
  -- Time at which the subscription was created.
  created TIMESTAMPTZ DEFAULT NOW(),
  -- Start of the current period
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  -- End of the current period
  current_period_end TIMESTAMPTZ DEFAULT NOW(),
  -- If the subscription has ended, the timestamp of the date the subscription ended.
  ended_at TIMESTAMPTZ,
  -- A date in the future at which the subscription will automatically get canceled.
  cancel_at TIMESTAMPTZ,
  -- If the subscription has been canceled, the date of that cancellation.
  canceled_at TIMESTAMPTZ,
  -- If the subscription has a trial, the beginning of that trial.
  trial_start TIMESTAMPTZ,
  -- If the subscription has a trial, the end of that trial.
  trial_end TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Can view own user data." ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Can update own user data." ON users
  FOR UPDATE USING (auth.uid() = id);

-- Customers table is private - no policies (server-side only)

-- Products policies
CREATE POLICY "Allow public read-only access." ON products
  FOR SELECT USING (true);

-- Prices policies
CREATE POLICY "Allow public read-only access." ON prices
  FOR SELECT USING (true);

-- Subscriptions policies
CREATE POLICY "Can only view own subs data." ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Realtime subscriptions for products and prices
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE products, prices;