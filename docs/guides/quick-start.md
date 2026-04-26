# Quick Start

Get RevealUI running locally. Budget 15-30 minutes if you are creating accounts for the first time.

---

## Prerequisites

- **Node.js 24+** ([nodejs.org](https://nodejs.org))
- **pnpm 10+** ([pnpm.io/installation](https://pnpm.io/installation))

---

## Step 1: Clone and Install

**Starting a new project:**

```bash
npx create-revealui my-app
cd my-app
```

**Contributing to RevealUI itself:**

```bash
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui
pnpm install
```

---

## Step 2: Configure Environment

```bash
cp .env.template .env.development.local
```

Set the required variables:

```env
REVEALUI_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
POSTGRES_URL=postgresql://user:password@host/database?sslmode=require
```

Get your `POSTGRES_URL` from [console.neon.tech](https://console.neon.tech).

See [Environment Variables Guide](../ENVIRONMENT-VARIABLES-GUIDE.md) for the full reference.

---

## Step 3: Initialize the Database

```bash
pnpm db:migrate
```

This creates all 81 tables. If you see a connection error, verify that `POSTGRES_URL` includes `?sslmode=require`.

---

## Step 4: Start Development

```bash
pnpm dev
```

| Service | URL | Purpose |
|---------|-----|---------|
| admin | http://localhost:4000 | Admin dashboard + auth pages |
| API | http://localhost:3004 | REST API + Swagger docs |

---

## Step 5: Create an Admin User

1. Open http://localhost:4000/signup
2. Enter your email and a password (8+ characters)
3. You are redirected to the admin dashboard

---

## Next Steps

- [Authentication Guide](./authentication.md) -- Configure auth providers and security
- [Collections Guide](./collections.md) -- Define your content schema
- [Billing Guide](./billing.md) -- Set up Stripe payments
- [Deployment Guide](./deployment.md) -- Ship to production
