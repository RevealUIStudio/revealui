---
visibility: public
status: verified
title: "Quick Start Guide"
description: "Get RevealUI running locally in 15-30 minutes"
category: tutorial
audience: developer
---

Get RevealUI up and running locally. Budget 15–30 minutes if you're creating accounts for the first time.

---

## Which path are you on?

**Building a new project with RevealUI:**

```bash
npx create-revealui my-app
cd my-app
```

Then continue from [Step 2](#step-2-set-up-environment-variables) below.

**Exploring or contributing to RevealUI itself:**

```bash
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui
pnpm install
```

Then continue from [Step 2](#step-2-set-up-environment-variables) below.

---

## Prerequisites

- **Node.js 24+** ([nodejs.org](https://nodejs.org))
- **pnpm 10+** ([pnpm.io/installation](https://pnpm.io/installation))

---

## Step 2: Set Up Environment Variables

Copy the template:

```bash
cp .env.template .env.development.local
```

You need these variables set before the dev server will start:

```env
# Generate with: pnpm secrets:generate --hex --length=32
REVEALUI_SECRET=your_32_char_hex_secret

# Leave as-is for local dev
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# Required: NeonDB connection string
POSTGRES_URL=postgresql://user:password@host/database?sslmode=require
```

These are optional for local development  -  you can skip them and add them later:

```env
# Optional: media uploads. Cloudflare R2 is the canonical, S3-compatible storage
# backend. Set all five (or skip for local dev and add them later):
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=your-bucket-name
R2_PUBLIC_BASE_URL=https://<account-id>.r2.cloudflarestorage.com/<bucket>

# Optional: Stripe (needed for billing flows)
STRIPE_SECRET_KEY=sk_test_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
# For webhooks locally, use: stripe listen --forward-to localhost:4000/api/webhooks/stripe
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
```

### Getting your credentials

**REVEALUI_SECRET**  -  generate locally:

```bash
pnpm secrets:generate --hex --length=32
```

**POSTGRES_URL**  -  [console.neon.tech](https://console.neon.tech) → New project → Connection string (include `?sslmode=require`)

**R2_\* (Cloudflare R2)** (optional)  -  [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → create a bucket and an API token (Access Key ID + Secret Access Key); bind a public domain for `R2_PUBLIC_BASE_URL`

**Stripe keys** (optional)  -  [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API Keys (use test mode keys)

See [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) for the full reference.

---

## Step 3: Run Database Migrations

Before starting the dev server, initialize the database schema:

```bash
pnpm db:migrate
```

This creates all 97 tables. If you see a connection error, double-check your `POSTGRES_URL`  -  it must include `?sslmode=require` for NeonDB.

---

## Step 4: Start the Dev Server

```bash
pnpm dev
```

This starts two services:

| Service | URL                   | What it is                   |
| ------- | --------------------- | ---------------------------- |
| admin     | http://localhost:4000 | Admin dashboard + auth pages |
| API     | http://localhost:3004 | REST API + agent endpoints   |

---

## Step 5: Create Your First Admin User

1. Open [http://localhost:4000/signup](http://localhost:4000/signup)
2. Enter your email and a password (8+ characters)
3. Click **Create account**
4. You're redirected to the admin dashboard at [http://localhost:4000/admin](http://localhost:4000/admin)

---

## Step 6: Verify It Works

**Database**  -  go to **Posts** or **Pages** in the admin, create a record, save it. If it persists on reload, the database connection is working.

**Media** (requires the `R2_*` vars)  -  go to **Media**, upload an image. Skip this step if you haven't set up Cloudflare R2 yet.

**Billing** (requires Stripe keys)  -  go to **Account → Billing**. The page loads without Stripe keys but checkout won't function until keys are set. For local webhook testing, run `stripe listen --forward-to localhost:4000/api/webhooks/stripe` to get a local `STRIPE_WEBHOOK_SECRET`.

RevealUI is moving toward account-level subscriptions plus metered agent and commerce usage. Local setup still exposes legacy license-oriented pieces in some areas, but the intended hosted model is account or workspace entitlements first.

---

## Troubleshooting

**`relation "users" does not exist`**  -  you skipped `pnpm db:migrate`. Run it now.

**`ConfigValidationError: REVEALUI_SECRET`**  -  your secret is missing or under 32 characters. Regenerate it:

```bash
pnpm secrets:generate --hex --length=32
```

**`Connection refused` on POSTGRES_URL**  -  check the connection string includes `?sslmode=require` and that your NeonDB project is active (free tier projects pause after inactivity).

**Port already in use**  -  something else is on 4000 or 3004. Find and stop it:

```bash
lsof -i :4000
lsof -i :3004
```

**Dev server shows errors after changing `.env`**  -  restart it; environment variables are not hot-reloaded.

For more → [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

## Next Steps

- [Full documentation](./INDEX.md)
- [Component catalog](./COMPONENT_CATALOG.md)  -  65 native UI components in `@revealui/presentation` (80 total with `@revealui/core` admin/richtext)
- [Example projects](./EXAMPLES.md)  -  blog, subscription starter, storefront
- [Deployment guide](./guides/deployment.md)  -  Vercel + Fly, environment variables, production checklist
- [AI agents](./AI.md)  -  agent orchestration, open-model inference, MCP framework (Pro)

---

## Need Help?

- [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)
- [Report a bug](https://github.com/RevealUIStudio/revealui/issues)
- [support@revealui.com](mailto:support@revealui.com)
