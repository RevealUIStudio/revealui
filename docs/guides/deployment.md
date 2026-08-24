---
title: "Deployment"
description: "RevealUI supports several deployment targets: Vercel (recommended for the HTTP apps), Fly (for long-running services like the ElectricSQL sync layer), Docker Compose, Railway marketplace template, and self-hosted Node.js."
visibility: public
status: verified
audience: user
---

RevealUI supports several deployment targets: Vercel (recommended for the HTTP apps), Fly (for long-running services like the ElectricSQL sync layer), Docker Compose, Railway (customer self-host on-ramp), and self-hosted Node.js. This guide covers each option and the environment configuration required for production.

> RevealUI Studio's own production runs on **Vercel (HTTP) + Fly (long-running `apps/server` subset + ElectricSQL) + Neon (Postgres)**. Kubernetes is not a target. A `fly.toml` ships at `apps/server/fly.toml`. Railway is a **customer marketplace** path only (see [Railway](#railway-marketplace-template) below); it is not Studio's production host.

---

## Deployment Targets

| Target | Best For | Services Included |
|--------|----------|-------------------|
| Vercel | SaaS, serverless (HTTP) | admin, API, Marketing, Docs |
| Fly | Long-running services | Persistent `apps/server` subset + ElectricSQL sync |
| Docker Compose | Self-hosted, on-prem | All apps in containers |
| Railway | One-click self-host (customer account) | API + admin + migrate + pgvector Postgres |
| Node.js | Custom infrastructure | Manual process management |

---

## Vercel Deployment

Vercel is the recommended deployment target. RevealUI auto-deploys three services:

| App | Vercel Project | Domain |
|-----|---------------|--------|
| Admin | `revealui-admin` | admin.yourdomain.com |
| API | `revealui-api` | api.yourdomain.com |
| Marketing | `revealui-marketing` | yourdomain.com |

### Prerequisites

- Vercel account with the project linked
- NeonDB database provisioned
- GitHub repository connected to Vercel

### Initial Setup

1. Install the Vercel CLI:

```bash
pnpm add -g vercel
```

2. Link each app to a Vercel project:

```bash
cd apps/admin && vercel link
cd apps/server && vercel link
cd apps/marketing && vercel link
```

3. Set environment variables in the Vercel dashboard or via CLI:

```bash
vercel env add REVEALUI_SECRET production
vercel env add POSTGRES_URL production
vercel env add REVEALUI_PUBLIC_SERVER_URL production
```

### Required Environment Variables

These must be set in every Vercel project:

```env
# Core (required)
REVEALUI_SECRET=<32+ character random string>
REVEALUI_PUBLIC_SERVER_URL=https://admin.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://admin.yourdomain.com
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# Storage (required for media uploads) — Cloudflare R2 (S3-compatible).
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=revealui-media
R2_PUBLIC_BASE_URL=https://media.yourdomain.com

# Billing (required for payments)
# Local/CI: sk_test_* / pk_test_* with STRIPE_LIVE_MODE unset/false.
# Studio production: sk_live_* / pk_live_* with STRIPE_LIVE_MODE=true (since 2026-06-26).
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# STRIPE_LIVE_MODE=true             # required when using sk_live_* keys
```

### Build Configuration

Each official app has a `vercel.json` next to it (`apps/marketing`, `apps/docs`, `apps/admin`, `apps/server`). That file is the source of truth for Framework, Build Command, Output Directory, and Install Command. The Vercel dashboard must match it. Check or apply:

```bash
pnpm validate:vercel-settings           # files only
pnpm validate:vercel-settings -- --live # compare dashboard
pnpm validate:vercel-settings -- --sync # write dashboard from vercel.json
```

Project ids live in `.github/vercel-projects.json`. Root Directory is `apps/<app>` (`apps/server` for api). Git Integration stays disconnected. The repo-root `vercel.json` only turns off Git auto-deploys if someone reconnects a root project.

### CI/CD Pipeline

RevealUI includes GitHub Actions workflows:

- **ci.yml** -- Runs on every push: Biome lint and typecheck (hard fail), tests (warn-only)
- **release.yml** -- Manual dispatch only (Actions > Release OSS Packages > Run workflow): OIDC authentication, npm publish with provenance

Vercel Git Integration is disabled. Production deploys run via `deploy.yml` on push to `main` (or manual dispatch). Test previews run via `deploy-test.yml`, triggered manually (`workflow_dispatch`) for QA spot-checks.

### Custom Domains

Configure domains in the Vercel dashboard:

1. Add your domain to the project
2. Update DNS (CNAME to `cname.vercel-dns.com`)
3. Update `REVEALUI_PUBLIC_SERVER_URL` to match

For cross-subdomain auth, the session cookie domain should be set to `.yourdomain.com` so it works across `admin.yourdomain.com` and `api.yourdomain.com`.

---

## Docker Compose Deployment

For self-hosted deployments, RevealUI provides a Docker Compose configuration.

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A PostgreSQL database (NeonDB, self-hosted, or any PostgreSQL 15+ instance)

### docker-compose.yml

```yaml
version: '3.8'

services:
  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    ports:
      - '4000:4000'
    environment:
      - REVEALUI_SECRET=${REVEALUI_SECRET}
      - POSTGRES_URL=${POSTGRES_URL}
      - REVEALUI_PUBLIC_SERVER_URL=${REVEALUI_PUBLIC_SERVER_URL}
      - NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
      # Object storage — Cloudflare R2 (S3-compatible).
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET=${R2_BUCKET}
      - R2_PUBLIC_BASE_URL=${R2_PUBLIC_BASE_URL}
    depends_on:
      - api
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - '3004:3004'
    environment:
      - REVEALUI_SECRET=${REVEALUI_SECRET}
      - POSTGRES_URL=${POSTGRES_URL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    restart: unless-stopped

  marketing:
    build:
      context: .
      dockerfile: apps/marketing/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
    restart: unless-stopped
```

### Running

```bash
# Create a .env file with your production values (RevVault export-env is preferred)
cp .env.template .env

# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Health Checks

The API exposes a health endpoint at `GET /health/ready` (root path, no `/api` prefix; the Hono API also serves `GET /health` and `GET /health/live` at root) that returns:

```json
{
  "status": "ok",
  "version": "0.5.5",
  "uptime": 3600,
  "db": "healthy",
  "memory": "47.52%"
}
```

Pre-1.0; the `version` field reports the runtime package version from `package.json`. Don't depend on it being stable until the project promotes to 1.0.

Use this in your Docker health check or load balancer configuration.

---

## Railway marketplace template

For a one-click deploy of the self-hosted runtime **on the buyer's Railway account**, use the config-as-code under `deployment/railway/` in this repository (operator guide on GitHub:
[deployment/railway/README.md](https://github.com/RevealUIStudio/revealui/blob/test/deployment/railway/README.md)). That path is a sales channel (marketplace template), not a change to Studio's own production stack.

| Piece | Location (repo root) |
|-------|----------|
| Operator guide (license, first boot, Free-tier unlicensed flag) | [deployment/railway/README.md](https://github.com/RevealUIStudio/revealui/blob/test/deployment/railway/README.md) |
| API service config | [deployment/railway/api.json](https://github.com/RevealUIStudio/revealui/blob/test/deployment/railway/api.json) |
| Admin service config | [deployment/railway/admin.json](https://github.com/RevealUIStudio/revealui/blob/test/deployment/railway/admin.json) |

Architecture (four services): `postgres` (`pgvector/pgvector:pg16`), one-shot `migrate`, `api` (`apps/server/Dockerfile`), `admin` (`apps/admin/Dockerfile`). Read the marketplace operator guide before publishing or deploying. Free (OSS) boots can set `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true` on **both** `api` and `admin` and omit license keys. Fleet (licensed) boots set `REVEALUI_LICENSE_KEY` and `REVEALUI_LICENSE_PUBLIC_KEY` instead.

Marketplace listing publish and payout wiring remain an operator step once the template is ready to list.

---

## Self-Hosted Node.js

For custom infrastructure without Docker.

### Build

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build
```

### Run

Each app can be started independently:

```bash
# admin (Next.js standalone)
cd apps/admin
node .next/standalone/server.js

# API (Hono)
cd apps/server
node dist/index.js
```

### Process Management

Use a process manager like PM2 for production:

```bash
pm2 start apps/admin/.next/standalone/server.js --name revealui-admin
pm2 start apps/server/dist/index.js --name revealui-api
pm2 save
pm2 startup
```

### Reverse Proxy

Place Nginx or Caddy in front of the Node.js processes:

```nginx
server {
    server_name admin.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Environment Variables Reference

### Required for All Deployments

| Variable | Description |
|----------|-------------|
| `REVEALUI_SECRET` | 32+ char random string for session token hashing |
| `POSTGRES_URL` | NeonDB or PostgreSQL connection string |
| `REVEALUI_PUBLIC_SERVER_URL` | Full URL of the admin app |
| `NEXT_PUBLIC_SERVER_URL` | Same as above (client-side usage) |

### Optional

| Variable | Description | Required For |
|----------|-------------|-------------|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Cloudflare R2 (S3-compatible object storage) | Media uploads |
| `STRIPE_SECRET_KEY` | Stripe secret key | Billing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Checkout UI |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Webhook verification |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | GitHub sign-in |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | GitHub sign-in |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google sign-in |
| `VERCEL_CLIENT_ID` | Vercel OAuth client ID | Vercel sign-in |
| `VERCEL_CLIENT_SECRET` | Vercel OAuth client secret | Vercel sign-in |

See [Environment Variables Guide](../ENVIRONMENT-VARIABLES-GUIDE.md) for the complete reference.

---

## Database Migrations

Run migrations before deploying a new version:

```bash
pnpm db:migrate
```

Migrations are idempotent and safe to run multiple times. In CI, run migrations as a pre-deploy step. On Vercel, use a build command that includes migrations:

```bash
pnpm db:migrate && pnpm build
```

---

## Production Checklist

- [ ] `REVEALUI_SECRET` is unique per environment and not reused from development
- [ ] `POSTGRES_URL` points to a production database with backups enabled
- [ ] HTTPS is enforced (session cookies require `Secure` flag)
- [ ] Stripe webhook endpoint is registered in the Stripe dashboard
- [ ] Stripe is using live keys (not test keys)
- [ ] Database migrations have been run
- [ ] `NODE_ENV=production` is set
- [ ] Error monitoring is configured (Sentry, Vercel Analytics, etc.)
- [ ] Custom domains have valid SSL certificates
- [ ] CORS is configured to allow only your domains

---

## Monitoring

### Vercel

Vercel provides built-in analytics for Next.js apps. Enable it in the Vercel dashboard under Project Settings > Analytics.

### Health Endpoint

Poll `GET /health` (or `/health/ready`) from your uptime monitor. `/api/health` is a separate surface served by the admin Next.js app, not the Hono API. The endpoint returns HTTP 200 when the API is healthy and HTTP 503 when the database connection is down.

### Logging

RevealUI uses a structured logger (`@revealui/utils`). In production, logs are written to stdout in JSON format. Pipe them to your log aggregation service (Datadog, Grafana Loki, etc.).

---

## Enterprise self-hosted operators

The customer Fleet kit (Compose + GHCR, domain lock, license JWT) is documented in [FLEET.md](../FLEET.md): install, upgrade, rollback, backup, restore. Published Studio uptime covers license validation and downloads only — see [SLA](../SLA.md). Collaborative Lexical rooms need a long-running API process; see [Collaborative editing](./collaborative-editing.md).

Secrets for a Fleet kit belong in RevVault (or your own secret store), not a copied `apps/admin/.env.example`. `docker-compose.forge.yml` reads `.env.forge`. Never put `REVEALUI_LICENSE_PRIVATE_KEY` on a customer kit.

## Related Documentation

- [Fleet](../FLEET.md) -- Enterprise self-host kit
- [SLA](../SLA.md) -- Published support and license-infra uptime
- [Environment Variables](../ENVIRONMENT-VARIABLES-GUIDE.md) -- Full configuration reference
- [Architecture](../ARCHITECTURE.md) -- System design and infrastructure
