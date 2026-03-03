# Quick Start

Get a RevealUI app running in 5 minutes.

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **pnpm** 9+ — `npm install -g pnpm`
- A [NeonDB](https://neon.tech) database (free tier works)

## Create Your App

```bash
npx create-revealui@latest my-app
cd my-app
```

The CLI will ask:
- **Template** — `minimal` (free) or `e-commerce` / `portfolio` (Pro)
- **Package manager** — pnpm recommended

## Configure Environment

Copy the generated template and fill in your credentials:

```bash
cp .env.example .env.local
```

Open `.env.local` and set at minimum:

```env
# NeonDB connection string (from neon.tech dashboard)
POSTGRES_URL=postgresql://user:password@host/dbname?sslmode=require

# A random secret for session signing (run: openssl rand -base64 32)
AUTH_SECRET=your-random-secret-here
```

## Run Migrations

```bash
pnpm db:migrate
```

This creates the required tables in your NeonDB database.

## Start the App

```bash
pnpm dev
```

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the CMS dashboard.

The first user to sign up becomes the admin.

## What's Next

- **[Collections guide](/guides/collections)** — Define your content types
- **[Components guide](/guides/components)** — Browse the 50+ UI components
- **[Deployment guide](/guides/deploy-vercel)** — Ship to production

## Packages Included

| Package | What it does |
|---------|-------------|
| `@revealui/core` | CMS engine, admin UI, collections, rich text |
| `@revealui/auth` | Session auth, sign in/up, rate limiting |
| `@revealui/db` | Drizzle ORM, NeonDB client, migrations |
| `@revealui/presentation` | 50+ UI components, zero external deps |
| `@revealui/config` | Type-safe environment config |
| `@revealui/utils` | Logger, validation helpers |
