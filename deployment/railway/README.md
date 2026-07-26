# RevealUI on Railway (marketplace template)

This directory holds the config-as-code files for a Railway template listing
that deploys RevealUI's self-hosted Fleet stack. It is a second on-ramp for
customers who already hold (or are buying) a RevealUI Fleet license and want
a fast, infrastructure-as-code deploy, alongside the existing
`docker-compose.forge.yml` path. It is a sales channel, not a replacement for
RevealUI's own production hosting, which stays on Vercel, Neon, and Fly and is
unaffected by anything in this directory.

Read this whole document once before you touch the Railway dashboard. The
license and first-boot steps are not optional, and skipping them produces a
running-but-unusable deployment.

## Who this is for

RevealUI's self-hosted runtime enforces a real license at boot for RevForge-
stamped Fleet kits (this is by design, not a bug we're working around, and it
does not change here). As of GAP-436 (owner-ruled 2026-07-26), a **plain**
self-hosted boot — this template included — can instead run at Free (OSS)
tier with no license at all: set `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true` on
the `api` service and skip `REVEALUI_LICENSE_KEY` / `REVEALUI_LICENSE_PUBLIC_KEY`
entirely. This template is for:

- Anyone who wants to try RevealUI's Free (OSS) tier on Railway with a single
  click, no license required — set `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true`
  and omit the license vars.
- An existing RevealUI Fleet (enterprise) customer moving their licensed
  deployment to Railway — set `REVEALUI_LICENSE_KEY` /
  `REVEALUI_LICENSE_PUBLIC_KEY` and leave `REVEALUI_ALLOW_UNLICENSED_SELF_HOST`
  unset.
- A prospect who has requested a trial license from RevealUI Studio for a
  Pro/Enterprise-tier walkthrough ahead of publishing the template listing.

Deploying this template with a license key present that is invalid, expired,
or mismatched still produces a container that starts, logs a clear error, and
exits — `REVEALUI_ALLOW_UNLICENSED_SELF_HOST` only ever relaxes the
requirement for a **completely absent** key; it never weakens verification of
a key you do supply.

## Architecture

Four Railway services, one Postgres database:

| Service | Source | Role |
|---|---|---|
| `postgres` | Docker image `pgvector/pgvector:pg16` | Primary database. Must be the `pgvector` image, not plain Postgres. Migration `0000` runs `CREATE EXTENSION vector`, which a vanilla `postgres` image (including Railway's own managed Postgres plugin) cannot satisfy. See [docker-compose.yml](../../docker-compose.yml) for the same requirement on the existing self-host path. |
| `migrate` | Docker image `ghcr.io/revealuistudio/revealui-migrate` | One-shot job. Runs `drizzle-kit migrate` against `postgres` once, then exits. Idempotent, so it's safe to re-run. |
| `api` | This repo, [`apps/server/Dockerfile`](../../apps/server/Dockerfile) | Hono REST API (OpenAPI/Swagger at `/docs`). |
| `admin` | This repo, [`apps/admin/Dockerfile`](../../apps/admin/Dockerfile) | Next.js admin dashboard. Seeds the first admin user on boot. |

There is no ElectricSQL or worker service in this template. Both are
optional in the current codebase (`ELECTRIC_SERVICE_URL` is read only if
set, and neither `apps/server/src/lib/required-env.ts` list requires it);
the long-running worker (`apps/server/Dockerfile.worker`, WS collab rooms,
the RevMarket executor) is Fly-only infrastructure for RevealUI's own hosted
product and is out of scope for a customer's self-hosted kit. Add
`infrastructure/docker-compose/services/electric.yml` as a fifth service
later if a deployment needs real-time sync.

### Audit finding this template's Dockerfile choice depends on (read this)

The task that produced this template originally pointed at
`apps/server/Dockerfile` and `apps/admin/Dockerfile` as-is. Auditing them
against `apps/server/src/index.ts`, `apps/server/src/worker.ts`, and the
already-working `apps/server/Dockerfile.forge` / `apps/admin/Dockerfile.forge`
(the pair RevealUI's own CI actually builds, see
[`.github/workflows/docker.yml`](../../.github/workflows/docker.yml)) found
two real bugs in the plain Dockerfiles, now fixed in this PR:

1. **`apps/server/Dockerfile` never started an HTTP server.** Its `CMD` ran
   `dist/index.js`, which is the Vercel serverless handler. Its
   `NODE_ENV === 'production'` branch deliberately skips `serve()` (see the
   comment block at `apps/server/src/index.ts:1481-1502`), because on Vercel
   the platform calls the exported handler directly. Run as a plain
   container, that file validates env, then returns, and the container never
   binds a port. `dist/worker.ts` is the long-running entry that calls
   `serve()`, and `Dockerfile.forge` already used it. Fixed by changing this
   Dockerfile's `CMD` to `dist/worker.js` and its port env from the
   unread `API_PORT` to `PORT` (the variable `worker.ts` actually checks).
2. **`apps/admin/Dockerfile` never seeded the first admin user.** The
   first-admin bootstrap (`apps/admin/revealui.config.ts` `onInit`, reading
   `REVEALUI_ADMIN_EMAIL` / `REVEALUI_ADMIN_PASSWORD`) is gated by
   `RUNTIME_INIT` in `packages/core/src/instance/RevealUIInstance.ts:407-410`.
   Without it, `NODE_ENV=production` alone is treated as build time and
   `onInit` never runs. `Dockerfile.forge` already sets `RUNTIME_INIT=1`;
   the plain Dockerfile did not. Fixed by adding the same env var.

Both fixes also benefit the existing plain `docker-compose.yml` self-host
path, which had the identical defects. `docker-compose.forge.yml` was not
touched; see the note below.

### Separately found, not fixed here (filed as a follow-up gap)

While tracing the license and Postgres requirements, the audit also found
`docker-compose.forge.yml`, the currently-documented enterprise self-host
path, appears to be stale against the current code:

- It sets `REVEALUI_PUBLIC_KEY` / `REVEALUI_PRIVATE_KEY` and never sets
  `REVEALUI_LICENSE_KEY`, but `apps/server/src/lib/validate-startup.ts` and
  `apps/server/src/lib/required-env.ts` check `REVEALUI_LICENSE_PUBLIC_KEY` /
  `REVEALUI_LICENSE_PRIVATE_KEY` / `REVEALUI_LICENSE_KEY`. None of the names
  it sets match what the code reads.
- It passes `JWT_SECRET` and `RESEND_API_KEY` / `RESEND_FROM_EMAIL`, neither
  of which has any remaining reader in `apps/server` or `apps/admin`
  (Resend was removed in PR #227; email is Gmail-service-account based now).
- Its `postgres` service uses `postgres:16-alpine`, not `pgvector/pgvector`,
  so the same `CREATE EXTENSION vector` failure this template avoids would
  hit that compose file too.
- `apps/server/Dockerfile.forge` builds a dedicated `migrate` stage
  (published to `ghcr.io/revealuistudio/revealui-migrate` by
  `.github/workflows/docker.yml`) specifically so a fresh kit's schema gets
  created, but `docker-compose.forge.yml` never wires up a `migrate` service
  to run it. A fresh compose-based kit currently boots with zero tables.

This is a real, separate bug in an existing production artifact, not
something this PR introduces, and touching license verification wiring is
its own security-surface review, not a deployment-template change. It is not
fixed in this PR. It's filed as a gap in the internal tracker for the next
Design/Verify pass; this template's env var table below uses the current,
code-verified names so it does not repeat the same drift.

## Deploying the template

Railway resolves each service's config-as-code file from an **absolute
path you set on that service** (Settings, Config as Code, Config File
Path). There is no automatic per-service naming convention, and the path
does not follow that service's Root Directory setting. Leave every
source-built service's Root Directory at the repo root (the Dockerfiles use
`context: .` for pnpm workspace access) and point the config path at the
files below:

1. **Create the project**, add a service per row, in this order:
   - `postgres`: deploy from Docker Image `pgvector/pgvector:pg16`. Set
     `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (see table below).
     No config-as-code file needed for an image-only service.
   - `migrate`: deploy from Docker Image
     `ghcr.io/revealuistudio/revealui-migrate:latest` (or a `sha-<shortsha>`
     tag matching the commit you're deploying; check
     `github.com/RevealUIStudio/revealui/pkgs/container/revealui-migrate`
     for available tags. **`latest` is only pushed from `main`**, per
     `.github/workflows/docker.yml`). Set `POSTGRES_URL` (see table below)
     and **set Restart Policy to `NEVER`** in the service's Deploy settings,
     because this container runs `drizzle-kit migrate` once and exits 0; a
     restart policy of `ON_FAILURE`/`ALWAYS` would treat that as a crash
     loop. Trigger a deploy once after `postgres` is healthy. It's idempotent,
     so re-running it (e.g. after a later template update) is safe.
   - `api`: deploy from this GitHub repo. Set the service's Config File
     Path to `/deployment/railway/api.json`. Enable a public domain if the
     admin app or outside clients need to reach it directly.
   - `admin`: deploy from this GitHub repo. Set the service's Config File
     Path to `/deployment/railway/admin.json`. Enable a public domain;
     this is the URL you'll log into.
2. **Set environment variables** per the table below on each service.
3. **Deploy `postgres`**, wait for it healthy, then deploy `migrate`, then
   `api`, then `admin`. (The `/health` and `/api/health` endpoints only
   check DB connectivity, not schema, so `api` and `admin` will report
   healthy even before `migrate` has run. Log in only after `migrate` has
   completed, or `admin`'s first-boot seed will fail with a missing
   `users` table.)
4. Because `admin`'s build needs the `api` service's public URL baked in at
   *build* time (`NEXT_PUBLIC_API_URL` is a Next.js `NEXT_PUBLIC_*` var,
   inlined into the client bundle at build, not read at runtime), generate
   `api`'s public domain **before** the first `admin` build if you can. If
   `admin` built before `api` had a domain, redeploy `admin` once `api`'s
   domain exists. Railway's variable reference does not retroactively
   patch an already-built bundle.

## Environment variables

Generate every secret below with a real command; do not hand-type a "good
enough" string. Names are the ones `apps/server/src/lib/validate-startup.ts`
and `apps/server/src/lib/required-env.ts` actually check today, not the
(partly stale) names in `docker-compose.forge.yml`.

### `postgres` service

| Variable | Required | Value |
|---|---|---|
| `POSTGRES_DB` | required | `revealui` |
| `POSTGRES_USER` | required | `revealui` |
| `POSTGRES_PASSWORD` | required, secret | Generate: `openssl rand -hex 24` |

### `migrate` service

| Variable | Required | Value |
|---|---|---|
| `POSTGRES_URL` | required | `postgresql://${{postgres.POSTGRES_USER}}:${{postgres.POSTGRES_PASSWORD}}@${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{postgres.POSTGRES_DB}}?sslmode=disable`. Build this with Railway's variable reference picker in the dashboard rather than typing it by hand, so the service name matches what you actually named it. `sslmode=disable` is correct here because this connection stays on Railway's private network between services in the same project; do not expose `postgres` publicly with this setting. |

### `api` service (owner must supply the license + secrets rows)

| Variable | Required | Value |
|---|---|---|
| `POSTGRES_URL` | required | Same reference as the `migrate` service, above |
| `NODE_ENV` | required | `production` |
| `REVEALUI_SECRET` | required, secret | `openssl rand -hex 32` (32-char minimum; this produces 64) |
| `REVEALUI_KEK` | required, secret | `openssl rand -hex 32`, must be exactly 64 hex chars (AES-256-GCM envelope key) |
| `REVEALUI_AUDIT_SIGNING_KEY` | required, secret | Ed25519 PKCS#8 PEM that signs every audit row: `openssl genpkey -algorithm Ed25519 -out audit-signing-key.pem`, then paste the file contents (with real newlines, or `\n`-escaped; both are normalized) |
| `REVEALUI_LICENSE_KEY` | required, secret | **Issued by RevealUI Studio, not self-generated.** Contact RevealUI Studio or your account rep after purchasing a Fleet license at revealui.com/pricing. |
| `REVEALUI_LICENSE_PUBLIC_KEY` | required | Issued alongside `REVEALUI_LICENSE_KEY` above, the matching Ed25519 public key. |
| `REVEALUI_PUBLIC_SERVER_URL` | required | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
| `NEXT_PUBLIC_SERVER_URL` | required | Same value as `REVEALUI_PUBLIC_SERVER_URL`. The boot validator rejects a mismatch. |
| `CORS_ORIGIN` | required | `https://${{admin.RAILWAY_PUBLIC_DOMAIN}}` (comma-separate if you add more origins) |
| `REVFORGE_LICENSED_DOMAIN` | optional | Set to your `admin` service's domain to enforce the RevForge domain lock (`apps/admin/src/proxy.ts`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | optional | Only if you want transactional email (password reset, notifications). If omitted, email sends no-op silently rather than failing boot. |
| `X402_ENABLED` / `X402_RECEIVING_ADDRESS` | optional | Only if enabling x402 micropayments; see `docs/architecture/x402.md` |

### `admin` service

| Variable | Required | Value |
|---|---|---|
| `POSTGRES_URL` | required | Same reference as `api` |
| `NODE_ENV` | required | `production` |
| `REVEALUI_SECRET` | required, secret | Same value as `api`'s |
| `REVEALUI_KEK` | required, secret | Same value as `api`'s |
| `REVEALUI_AUDIT_SIGNING_KEY` | required, secret | Same value as `api`'s |
| `REVEALUI_LICENSE_KEY` / `REVEALUI_LICENSE_PUBLIC_KEY` | required, secret | Same values as `api`'s |
| `NEXT_PUBLIC_API_URL` / `API_URL` | required | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}`. Build-time var; see the ordering note above. |
| `REVEALUI_PUBLIC_SERVER_URL` / `NEXT_PUBLIC_SERVER_URL` | required | `https://${{admin.RAILWAY_PUBLIC_DOMAIN}}` |
| `REVEALUI_ADMIN_EMAIL` | required for first login | Your email. Seeds the first admin user on first boot. |
| `REVEALUI_ADMIN_PASSWORD` | required, secret, for first login | A real password. Change it after first login; this only seeds the account once (idempotent, checked via `users.totalDocs === 0`). |

## First-boot login

Once `admin` reports healthy and you've set `REVEALUI_ADMIN_EMAIL` /
`REVEALUI_ADMIN_PASSWORD` before its **first** boot, visit
`https://<your-admin-domain>/` and log in with those credentials
(`apps/admin/revealui.config.ts` `onInit` creates the account the first time
it finds zero rows in `users`; self-signup is closed by default outside
hosted SaaS, so this is the only way in). Rotate the password immediately
after confirming access, since it lives in Railway's env history until you
overwrite it.

## Health checks

| Service | Path | Checks |
|---|---|---|
| `api` | `/health` | Postgres connectivity (`SELECT 1`) + memory. Does **not** check schema; will report healthy before `migrate` runs. |
| `admin` | `/api/health` | Same shape, Next.js route. |

## Kickback / template queue opt-in

Railway's template partner program pays template creators a commission
(publicly documented as up to 25%) on paid usage its Template Queue
generates for a listed template
(`https://station.railway.com/my-template-queue`,
`docs.railway.com/reference/templates`). To opt in:

1. Publish this template from the Railway dashboard once the services above
   compose cleanly end to end (Project, Settings, "Generate Template", or
   the equivalent current entry point. Railway's UI for this has moved
   before, so treat the dashboard as the source of truth over this doc).
2. Fill in the listing metadata (name, description, icon, category).
3. Submit it to the Template Queue at
   `station.railway.com/my-template-queue` for review.
4. Confirm partner/payout enrollment in Railway's dashboard under the
   partner program settings. **This step's exact account/payout
   requirements were not fully documented on the pages this PR could
   fetch** (see verification note below); check
   `docs.railway.com/reference/templates` and the linked "Open Source &
   Technology Partners" page in the Railway dashboard at publish time
   rather than trusting this list to be exhaustive.

## Owner action before publishing

Before this template goes live on the public marketplace, decide how a
marketplace visitor obtains a `REVEALUI_LICENSE_KEY` without talking to a
human first (a self-service trial-issuing flow), or accept that this
listing targets already-licensed customers only and say so explicitly in
the listing description. Either is a legitimate product decision. Shipping
the listing without deciding produces a deploy button that dead-ends at a
license prompt for most visitors who click it.

## What was not verified

Docker was not available in the environment this PR was built in, so the
`api` and `admin` images were not build-tested end to end here. Both
Dockerfiles were reviewed line by line against the already-working
`.forge` variants and the source they build (`apps/server/src/worker.ts`,
`packages/core/src/instance/RevealUIInstance.ts`), and the same dependency
COPY lists, build stages, and deploy flattening as the CI-built `.forge`
images are used unchanged apart from the two fixes above, but a real
`docker build` was not run. The GHCR visibility of
`ghcr.io/revealuistudio/revealui-migrate` (public vs. requiring a registry
credential in Railway) was also not conclusively confirmed. An anonymous
manifest pull for the `latest` tag returned 404, which is consistent with
either "no `latest` tag exists yet" (the workflow only pushes `latest` from
`main`) or "the package is private". Check the package's visibility at
`github.com/RevealUIStudio/revealui/pkgs/container/revealui-migrate` before
relying on it, and add a Railway registry credential if it turns out to be
private.
