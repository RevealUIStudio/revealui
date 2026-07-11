---
visibility: public
status: verified
title: "RevealUI Fleet — Self-Hosted Deployment"
description: "Enterprise self-hosted runtime kit. Domain-locked, multi-tenant, unlimited users. Produced by RevForge per customer."
category: guide
audience: enterprise
---

Customers buy the Enterprise tier of RevealUI; the Fleet kit (produced by RevForge) is what they deploy. Instead of running on `revealui.com`, you deploy the entire stack on your own infrastructure with full domain lock and unlimited users.

RevealUI Fleet is a deployment-level commercial product, distinct from the hosted account-level subscription and metered usage model used for SaaS.

## What's included

| Component | Image | Port |
|---|---|---|
| API (Hono) | `ghcr.io/revealuistudio/revealui-api` | 3004 |
| Admin (Next.js) | `ghcr.io/revealuistudio/revealui-admin` | 4000 |
| PostgreSQL 16 | `postgres:16-alpine` | 5432 (internal) |

All three services are wired together in `docker-compose.forge.yml` at the root of the repository.

## Commercial model

Fleet sits beside, not underneath, the hosted pricing model:

- Hosted RevealUI uses account or workspace subscriptions plus metered usage.
- Fleet is a deployment-scoped commercial product with domain lock.
- Optional metered or transaction-linked features can exist inside Fleet deployments, but the primary entitlement is the deployment license.

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A Fleet license key, an EdDSA-signed JWT issued at checkout once live billing is enabled
- A domain you control (e.g. `admin.acme.com`)
- Stripe keys for billing (if you want to use the billing stack)
- A NeonDB or PostgreSQL 16 database URL

---

## Quick start

### 1. Pull the stack

```bash
# Preview — images publish post-launch; commands below will fail with `manifest unknown` until then.
docker pull ghcr.io/revealuistudio/revealui-api:latest
docker pull ghcr.io/revealuistudio/revealui-admin:latest
```

> Once Fleet launches, GHCR access will be gated by your license key. You'll log in with the token provided in your Fleet welcome email:
>
> ```bash
> echo "$GHCR_TOKEN" | docker login ghcr.io -u revealuistudio --password-stdin
> ```

### 2. Create your `.env.forge`

Copy `.env.template` and fill in the required values. The minimum viable Fleet config:

```bash
# Core
NODE_ENV=production
POSTGRES_URL=postgresql://user:pass@db:5432/revealui
REVEALUI_SECRET=<32+ char random string>

# Fleet license
REVFORGE_LICENSE_KEY=eyJhbGciOiJFZERTQSIs...
REVFORGE_LICENSED_DOMAIN=admin.acme.com

# Admin URL (used by API for redirects)
ADMIN_URL=https://admin.acme.com

# CORS (must include your domain)
CORS_ORIGIN=https://admin.acme.com

# Stripe (for billing features)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
REVEALUI_LICENSE_PRIVATE_KEY=<Ed25519 private key PEM>
REVEALUI_LICENSE_PUBLIC_KEY=<Ed25519 public key PEM>
```

### 3. Start the stack

```bash
docker compose -f docker-compose.forge.yml --env-file .env.forge up -d
```

The first run initializes the database and applies all migrations automatically.

### 4. Run database migrations

```bash
docker compose -f docker-compose.forge.yml exec api pnpm db:migrate
```

### 5. Verify

```bash
curl https://admin.acme.com/health
# {"status":"ok","db":"connected","license":"forge"}
```

---

## Environment variables

All Fleet-specific variables. See [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) for the full reference.

| Variable | Required | Description |
|---|---|---|
| `REVFORGE_LICENSE_KEY` | Yes | Your Fleet license JWT (`eyJhbGciOiJFZERTQSIs...`) |
| `REVFORGE_LICENSED_DOMAIN` | Yes | The domain this instance is locked to |
| `POSTGRES_URL` | Yes | PostgreSQL 16 connection URL |
| `REVEALUI_SECRET` | Yes | 32+ char application secret (session signing, CSRF, HMAC operations) |
| `ADMIN_URL` | Yes | Full URL of your admin (e.g. `https://admin.acme.com`) |
| `CORS_ORIGIN` | Yes | Comma-separated allowed origins |
| `STRIPE_SECRET_KEY` | Billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Billing | Stripe webhook signing secret |
| `REVEALUI_LICENSE_PRIVATE_KEY` | Billing | Ed25519 private key PEM for license JWTs |
| `REVEALUI_LICENSE_PUBLIC_KEY` | Billing | Ed25519 public key PEM |

---

## Domain lock

The API enforces `REVFORGE_LICENSED_DOMAIN` at the middleware level. Every incoming request is checked against the `Host` header:

- Requests from the licensed domain: allowed
- Requests from any other host: `HTTP 403 Forbidden`
- Missing `REVFORGE_LICENSED_DOMAIN` at startup: process exits with a clear error

To change your licensed domain, contact support to reissue your license key.

---

## Services

### API

The Hono API server. Exposes all REST endpoints at `https://your-domain.com/api/*` and A2A agent endpoints at `/a2a/*`.

```yaml
# In docker-compose.forge.yml
api:
  image: ghcr.io/revealuistudio/revealui-api:latest
  ports: ["3004:3004"]
  environment:
    NODE_ENV: production
    POSTGRES_URL: postgresql://revealui:${DB_PASSWORD}@db:5432/revealui
    # ... (all API env vars)
  depends_on:
    db:
      condition: service_healthy
```

### Admin

The Next.js admin dashboard (standalone output — no Node.js server required beyond what's bundled).

```yaml
admin:
  image: ghcr.io/revealuistudio/revealui-admin:latest
  ports: ["4000:4000"]
  environment:
    DATABASE_URL: postgresql://revealui:${DB_PASSWORD}@db:5432/revealui
    API_URL: http://api:3004
    # ... (all admin env vars)
  depends_on:
    - api
```

### PostgreSQL

Postgres 16 with a named volume for data persistence and a health check.

```yaml
db:
  image: postgres:16-alpine
  volumes:
    - forge-db:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U revealui"]
    interval: 5s
    retries: 5
```

---

## Upgrading

```bash
# Pull latest images
docker compose -f docker-compose.forge.yml pull

# Restart with zero downtime (rolling update)
docker compose -f docker-compose.forge.yml up -d --no-deps api
docker compose -f docker-compose.forge.yml up -d --no-deps admin

# Apply any new migrations
docker compose -f docker-compose.forge.yml exec api pnpm db:migrate
```

---

## Reverse proxy

Fleet does not bundle a reverse proxy. Point Nginx, Caddy, or Traefik at port 3004 (API) and 4000 (admin).

### Caddy example

```
admin.acme.com {
  reverse_proxy /api/* localhost:3004
  reverse_proxy /a2a/* localhost:3004
  reverse_proxy /.well-known/* localhost:3004
  reverse_proxy /* localhost:4000
}
```

### Nginx example

```nginx
server {
  listen 443 ssl;
  server_name admin.acme.com;

  location /api/ { proxy_pass http://localhost:3004; }
  location /a2a/ { proxy_pass http://localhost:3004; }
  location /.well-known/ { proxy_pass http://localhost:3004; }
  location / { proxy_pass http://localhost:4000; }
}
```

---

## Generating Ed25519 keys

Required for license JWT signing:

```bash
# Generate key pair
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# Set as env vars (escape newlines)
export REVEALUI_LICENSE_PRIVATE_KEY="$(cat private.pem)"
export REVEALUI_LICENSE_PUBLIC_KEY="$(cat public.pem)"
```

---

## Troubleshooting

### `REVFORGE_LICENSED_DOMAIN mismatch` on startup

The domain in your license key does not match `REVFORGE_LICENSED_DOMAIN`. Contact support to reissue the license for the correct domain.

### API returns 403 on all requests

`Host` header does not match `REVFORGE_LICENSED_DOMAIN`. Check your reverse proxy is forwarding the correct `Host` header and is not rewriting it.

### Database connection refused

Ensure the `db` service is healthy before the API starts. The `depends_on.condition: service_healthy` in `docker-compose.forge.yml` handles this automatically, but manual restarts may require `docker compose restart api` after the database is ready.

### Admin shows blank page

The admin requires `NEXT_PUBLIC_API_URL` to point to your API. Verify it is set correctly and the API health check returns 200.

---

## Backup and restore

### Database backup

```bash
# Backup the Fleet database
docker compose -f docker-compose.forge.yml exec db \
  pg_dump -U revealui -Fc revealui > backup-$(date +%Y%m%d).dump

# Schedule daily backups via cron
0 2 * * * cd /opt/revealui && docker compose -f docker-compose.forge.yml exec -T db pg_dump -U revealui -Fc revealui > /backups/revealui-$(date +\%Y\%m\%d).dump
```

### Restore from backup

```bash
# Stop the stack
docker compose -f docker-compose.forge.yml down

# Restore the database
docker compose -f docker-compose.forge.yml up -d db
docker compose -f docker-compose.forge.yml exec -T db \
  pg_restore -U revealui -d revealui --clean --if-exists < backup-20260325.dump

# Restart all services
docker compose -f docker-compose.forge.yml up -d
```

### Media files

If using local file storage for media, back up the `uploads` volume:

```bash
docker run --rm -v forge-uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

For production, use S3-compatible storage (`STORAGE_ADAPTER=s3`) so media is backed up by your object store.

---

## Monitoring

### Health endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Basic health check (API + DB connectivity) |
| `GET /api/health/ready` | Readiness probe (all services operational) |

### Docker health checks

Both API and admin containers have built-in health checks. Monitor with:

```bash
docker compose -f docker-compose.forge.yml ps
# Shows: healthy / unhealthy / starting for each service
```

### Logging

All services log to stdout. Use Docker's logging driver for aggregation:

```yaml
# docker-compose.forge.yml override
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
```

For production, pipe to your logging stack (Datadog, Loki, CloudWatch):

```yaml
services:
  api:
    logging:
      driver: "awslogs"
      options:
        awslogs-group: "revealui-fleet"
        awslogs-region: "us-east-1"
```

### Metrics

The API exposes Prometheus-compatible metrics at `GET /metrics` when `ENABLE_METRICS=true` is set.

---

## High availability

For single-node deployments, the Docker Compose stack is sufficient. For high availability:

### Database

Use a managed PostgreSQL service (NeonDB, Fly Postgres, AWS RDS) instead of the bundled `postgres:16-alpine`:

```bash
# In .env.forge, point to your managed database
POSTGRES_URL=postgresql://user:pass@your-managed-db.neon.tech/revealui?sslmode=require
```

Remove the `db` service from `docker-compose.forge.yml` when using an external database.

### API

Run multiple API replicas behind a load balancer:

```bash
docker compose -f docker-compose.forge.yml up -d --scale api=3
```

The API is stateless — all state lives in PostgreSQL. Session cookies are signed with `REVEALUI_SECRET`, so all replicas must share the same secret.

### Admin

The admin (Next.js standalone) can also run multiple replicas. ISR revalidation is coordinated via the API's `/api/revalidate` endpoint.

---

## Migrating from hosted

If you're migrating from hosted RevealUI to a self-hosted Fleet deployment:

1. **Export your data** — use the admin panel (Settings → Export) or the API: `GET /api/export?collections=pages,posts,products,users`
2. **Set up Fleet** — follow the quick start above
3. **Import your data** — `POST /api/import` with the exported JSON
4. **Update DNS** — point your domain to the Fleet instance
5. **Transfer Stripe** — update your Stripe webhook endpoint URL to your new domain

Contact support for assistance with large migrations or custom data transformations.

---

## Related

- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md)
- [Auth & Security](./AUTH.md)
- [Pro overview](./PRO.md)
- [RevFleet overview](./REVFLEET.md)
