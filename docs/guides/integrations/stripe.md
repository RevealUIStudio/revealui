# Stripe Integration Setup Guide

This guide covers the recommended approaches for integrating Stripe with Supabase using official tools and best practices.

## 🎯 Recommended Approach: Stripe Sync Engine

The **Stripe Sync Engine** is Supabase's official integration for Stripe that automatically:
- Creates and maintains Stripe tables in your database
- Handles webhook processing
- Keeps data in sync automatically
- Provides proper RLS policies

### Setup Steps

1. **Enable Stripe Sync Engine** in your Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/integrations/stripe_sync_engine
   - Click "Enable Stripe Sync Engine"
   - Connect your Stripe account
   - Configure webhook endpoints (handled automatically)

2. **Tables Created Automatically**:
   ```sql
   -- These tables are created and maintained by Stripe Sync Engine:
   - customers (Stripe customer data)
   - products (Stripe product catalog)
   - prices (Stripe pricing information)
   - subscriptions (Stripe subscription data)
   - invoices, payment_intents, etc. (additional Stripe objects)
   ```

3. **Generate Types** using official CLI:
   ```bash
   pnpm generate:supabase-types
   ```

## 🛠️ Alternative Approach: Drizzle ORM

If you prefer more control over your schema, use Drizzle ORM with Supabase:

### Setup Steps

1. **Install Drizzle**:
   ```bash
   pnpm add drizzle-orm postgres
   pnpm add -D drizzle-kit
   ```

2. **Define Schema** (`packages/db/src/types/stripe-schema.ts`):
   ```typescript
   import { pgTable, uuid, text, jsonb, boolean, bigint, pgEnum } from "drizzle-orm/pg-core";

   export const users = pgTable("users", {
     id: uuid("id").primaryKey().references(() => authUsers.id),
     stripeCustomerId: text("stripe_customer_id"),
     // ... other fields
   });
   ```

3. **Run Migrations**:
   ```bash
   pnpm db:push  # Push schema to database
   ```

4. **Generate Types**:
   ```bash
   pnpm generate:supabase-types  # Generate from actual database
   ```

## 📡 Type Generation (Official CLI)

Use the official Supabase CLI for reliable type generation:

### Prerequisites
```bash
# Install Supabase CLI
pnpm dlx supabase@latest

# Login (optional, can use SUPABASE_ACCESS_TOKEN instead)
pnpm dlx supabase login
```

### Generate Types
```bash
# Using npm script (recommended)
pnpm generate:supabase-types

# Or manually
pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > types.ts
```

### Environment Variables
```env
SUPABASE_PROJECT_ID=your_project_id
SUPABASE_ACCESS_TOKEN=your_access_token  # Optional but recommended
```

## 🔄 Automation

### Post-Install Hook
Types are automatically regenerated after `pnpm install`.

### Pre-Commit Hook
Types are checked and updated before commits.

### CI/CD Automation
Weekly automated type regeneration via GitHub Actions.

## 📋 Migration from Manual Setup

If you have existing manual tables, here's how to migrate:

1. **Enable Stripe Sync Engine** (recommended)
2. **Or run the Drizzle migration**:
   ```bash
   pnpm db:push
   ```
3. **Regenerate types**:
   ```bash
   pnpm generate:supabase-types
   ```

## 🏗️ Architecture Comparison

| Approach | Sync Engine | Drizzle ORM | Manual SQL |
|----------|-------------|-------------|------------|
| **Maintenance** | Automatic | Manual schema | Manual everything |
| **Type Safety** | High | Very High | Medium |
| **Customization** | Limited | Full control | Full control |
| **Setup Complexity** | Low | Medium | High |
| **Recommended For** | Most projects | Custom schemas | Legacy systems |

## 🎯 Recommendation

For most projects, use **Stripe Sync Engine** + **Official CLI types**. It's the most maintainable and reliable approach.

For projects needing custom schema logic, use **Drizzle ORM** with official types.

Avoid manual SQL table creation unless you have specific requirements not covered by the above approaches.

## 📚 Resources

- [Stripe Sync Engine Docs](https://supabase.com/docs/guides/integrations/stripe)
- [Drizzle ORM with Supabase](https://supabase.com/docs/guides/database/drizzle)
- [TypeScript Types Generation](https://supabase.com/docs/guides/api/rest/generating-types)