---
visibility: public
status: verified
title: "RevealUI Fleet — Self-Host How-To"
description: "Operator how-to for self-hosting RevealUI. Not a catalog SKU. Enterprise is inquire / Contact sales."
category: guide
audience: enterprise
---

This page is a **self-host how-to**, not a commercial product page. Enterprise is a license (inquire / Contact sales). See [Enterprise](./ENTERPRISE.md). You deploy the stack on your own infrastructure. Studio does not operate a customer VM.

The compose file is this monorepo's `docker-compose.forge.yml` plus GHCR `ghcr.io/revealuistudio/revealui-{api,admin,migrate}`. RevForge is the **operator-only** stamper (private; not a public GitHub repo) that may brand a kit and issue the studio-signed license JWT. Claim hold `COPY-DEP-FLEET-DOCKER-IMAGES` is still `waiting` — images pull, but this is not a launched customer pull-and-run product.

## What's included

| Component | Image | Port |
|---|---|---|
| API (Hono) | `ghcr.io/revealuistudio/revealui-api` | 3004 |
| Admin (Next.js) | `ghcr.io/revealuistudio/revealui-admin` | 4000 |
| Migrate (one-shot) | `ghcr.io/revealuistudio/revealui-migrate` | (exits) |
| PostgreSQL 16 + pgvector | `pgvector/pgvector:pg16` | 5432 (internal) |

All three services are wired together in `docker-compose.forge.yml` at the root of the repository.

## License

Enterprise is inquire / Contact sales. This how-to is not a Fleet price, not a hosted-VM SKU, and not a catalog page. You self-host under an Enterprise license.

---

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- An Enterprise license key (inquire / Contact sales) — an EdDSA-signed JWT
- A domain you control (e.g. `admin.acme.com`)
- Stripe keys for billing (if you want to use the billing stack)
- A NeonDB or PostgreSQL 16 database URL

---

## Quick start

### 1. Pull the stack

```bash
# Public today. No GHCR login. Verified 2026-08-16 (anonymous manifest HTTP 200).
docker pull ghcr.io/revealuistudio/revealui-api:latest
docker pull ghcr.io/revealuistudio/revealui-admin:latest
docker pull ghcr.io/revealuistudio/revealui-migrate:latest
```

The images pull without a token. A Fleet license JWT is still required to *run* the kit.

### 2. Create your `.env.forge`

Do **not** copy the hosted `.env.template` mint-key block into a Fleet kit. `REVEALUI_LICENSE_PRIVATE_KEY` is the **RevealUI Studio mint key**. A Fleet customer who holds it can issue licenses. `docker-compose.forge.yml` sets `REVEALUI_DEPLOYMENT_MODE=forge`, and forge mode refuses to boot if that private key is present.

Write a Fleet-only `.env.forge`. Minimum viable config (names match `docker-compose.forge.yml`):

```bash
# Core
NODE_ENV=production
POSTGRES_PASSWORD=<secure password>
REVEALUI_SECRET=<32+ char random string>
REVEALUI_KEK=<64 hex chars>
REVEALUI_AUDIT_SIGNING_KEY=<Ed25519 PKCS#8 PEM — this instance's audit-row key, not the studio mint key>
REVEALUI_PUBLIC_SERVER_URL=https://admin.acme.com
NEXT_PUBLIC_SERVER_URL=https://admin.acme.com

# Fleet license — studio-issued JWT + studio public verify key. Never the mint private key.
REVEALUI_LICENSE_KEY=eyJhbGciOiJFZERTQSIs...
REVEALUI_LICENSE_PUBLIC_KEY=<studio Ed25519 public key PEM>
# Legacy alias accepted by compose: REVFORGE_LICENSE_KEY
REVFORGE_LICENSED_DOMAIN=admin.acme.com

# Admin URL (used by API for redirects)
ADMIN_URL=https://admin.acme.com

# CORS (must include your domain)
CORS_ORIGIN=https://admin.acme.com

# Stripe (optional — your Stripe account, not license minting)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
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
| `REVEALUI_LICENSE_KEY` | Yes | Studio-issued Fleet license JWT (`eyJhbGciOiJFZERTQSIs...`). Compose also accepts legacy `REVFORGE_LICENSE_KEY`. |
| `REVEALUI_LICENSE_PUBLIC_KEY` | Yes | Studio Ed25519 **public** key that verifies the JWT. Not a customer-generated key. |
| `REVEALUI_LICENSE_PRIVATE_KEY` | **Never on Fleet** | Studio mint private key. Hosted signer / `pnpm revforge:issue-license` only. Setting it on a Fleet kit is a mint-key leak and fails `MODE=forge` boot. |
| `REVFORGE_LICENSED_DOMAIN` | Recommended | Host domain-lock (admin proxy 403 on mismatch). Not a substitute for the JWT. |
| `POSTGRES_PASSWORD` | Yes | Postgres password (compose builds `POSTGRES_URL`) |
| `REVEALUI_SECRET` | Yes | 32+ char application secret (session signing, CSRF, HMAC operations) |
| `REVEALUI_KEK` | Yes | 64-hex at-rest encryption key (stamp generates; not the license mint key) |
| `REVEALUI_AUDIT_SIGNING_KEY` | Yes | This instance's Ed25519 PKCS#8 PEM for audit rows — not the studio license mint key |
| `ADMIN_URL` | Yes | Full URL of your admin (e.g. `https://admin.acme.com`) |
| `CORS_ORIGIN` | Yes | Comma-separated allowed origins |
| `STRIPE_SECRET_KEY` | Billing | Your Stripe secret key (optional) |
| `STRIPE_WEBHOOK_SECRET` | Billing | Your Stripe webhook signing secret (optional) |

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

## Rollback

Images are tagged. Pin the last known-good digest or tag before you upgrade so you can put it back.

```bash
# Record what is running
docker compose -f docker-compose.forge.yml images

# Restore previous API + admin tags (example: replace TAG with the prior pin)
# Edit docker-compose.forge.yml or override with:
#   REVEALUI_API_IMAGE=ghcr.io/revealuistudio/revealui-api:<TAG>
docker compose -f docker-compose.forge.yml pull
docker compose -f docker-compose.forge.yml up -d --no-deps api admin
```

If a migration already applied and has no down path, restore the database from the backup you took before the upgrade (see [Backup and restore](#backup-and-restore)), then start the older images. Do not invent a migrate-down story that the tree does not ship.

Published Studio uptime ([SLA](./SLA.md)) does not cover your kit. Your rollback is your availability story.

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

## Whose license keys are these

A Fleet customer **does not generate** the license-signing keypair and **must not** set `REVEALUI_LICENSE_PRIVATE_KEY`.

| Key | Who holds it | Role |
|---|---|---|
| `REVEALUI_LICENSE_PRIVATE_KEY` | RevealUI Studio only (revvault `revdev/license-signing-private-key`; declared move to `revealui/prod/license/*` is owner-gated and UNVERIFIED) | Mints customer license JWTs |
| `REVEALUI_LICENSE_PUBLIC_KEY` | Studio publishes; Fleet kit verifies | Verifies the studio-issued JWT |
| `REVEALUI_LICENSE_KEY` | The Fleet customer | The studio-issued JWT for this deployment |
| `REVEALUI_AUDIT_SIGNING_KEY` | The Fleet customer (per instance) | Signs audit rows on *this* deploy — unrelated to license minting |

If a domain change is needed, contact support to reissue the JWT. Do not mint your own.

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
