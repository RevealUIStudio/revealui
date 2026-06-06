---
title: Fly.io Deployment — apps/server Worker
description: Deploy + secrets workflow for the apps/server long-running worker on Fly.io.
category: deployment
audience: maintainer
---

# Fly Deployment — apps/server worker

The apps/server long-running worker runs on Fly in region `iad`
(Ashburn, VA — matched to Neon's prod region `us-east-1` for sub-ms
latency on shape queries via the worker's Hono app surface).

## Apps

| Fly app | Purpose | Status |
|---------|---------|--------|
| `revealui-worker` | apps/server long-running subset (alerting, Yjs collab WS, agent-collab WS, terminal-ws Forge-gated, RVMarket executor flag-gated) | Phase 3 — scaffolded, first deploy pending |
| `revealui-electric` | ElectricSQL sync service, replicates from Neon | Phase 5 — Electric cutover from Railway |

## First deploy (one-time setup)

Run from the monorepo root (`~/revfleet/revealui`) so flyctl uses
the right build context for the pnpm workspace:

```bash
cd ~/revfleet/revealui

# 1. Authenticate to Fly (one-time per machine)
flyctl auth login

# 2. Create the Fly app (one-time per environment)
flyctl apps create revealui-worker --org personal

# 3. Mirror prod secrets from revvault → Fly.
#
#    NOTE: `revvault sync fly` is NOT YET IMPLEMENTED — the installed revvault
#    CLI only supports `sync vercel`. Until it lands, set the secrets with
#    `flyctl secrets set`, reading EVERY var under [fly-apps.revealui-worker.vars]
#    in scripts/sync/revvault-fly.toml. The worker imports the full Hono app, so
#    it needs API-PARITY env (same set as the Vercel revealui-api project) — a
#    minimal subset fails startup validation. Example (abbreviated — include the
#    full manifest set: R2_*, GOOGLE_*, EMAIL_*, PASSKEY_*, STRIPE price/webhook,
#    CORS_ORIGIN, SESSION_COOKIE_DOMAIN, …):
flyctl secrets set --stage --app revealui-worker \
  POSTGRES_URL="$(revvault --json get revealui/prod/db/postgres-url | jq -r .value)" \
  REVEALUI_SECRET="$(revvault --json get revealui/prod/secret | jq -r .value)" \
  REVEALUI_KEK="$(revvault --json get revealui/prod/kek | jq -r .value)" \
  REVEALUI_PUBLIC_SERVER_URL="$(revvault --json get revealui/prod/public/server-url | jq -r .value)" \
  NEXT_PUBLIC_SERVER_URL="$(revvault --json get revealui/prod/public/server-url | jq -r .value)" \
  REVEALUI_ALERT_EMAIL="$(revvault --json get revealui/prod/alert-email | jq -r .value)" \
  REVEALUI_BILLING_PORTAL_CONFIG_ID="$(revvault --json get revealui/prod/billing/portal-config-id | jq -r .value)" \
  REVEALUI_LICENSE_PRIVATE_KEY="$(revvault --json get revealui/prod/license/private-key | jq -r .value)" \
  REVEALUI_LICENSE_PUBLIC_KEY="$(revvault --json get revealui/prod/license/public-key | jq -r .value)" \
  SENTRY_DSN="$(revvault --json get revealui/prod/sentry/dsn | jq -r .value)"

# 3b. STRIPE — set Fly-direct, NOT from the vault secret-key path. In the current
#     test-mode posture (STRIPE_LIVE_MODE unset), startup validation REQUIRES
#     STRIPE_SECRET_KEY to be a sk_test_ key; revealui/prod/stripe/secret-key
#     holds the staged LIVE key. Set the prod TEST key directly:
flyctl secrets set --stage --app revealui-worker STRIPE_SECRET_KEY="sk_test_..."

# 4. Deploy
flyctl deploy --config apps/server/fly.toml \
  --dockerfile apps/server/Dockerfile.worker \
  --remote-only

# 5. Verify
flyctl status --app revealui-worker
flyctl logs --app revealui-worker --tail
# expect:
#   - "Worker startup validation failed" → check secrets
#   - "License tier: <tier>" → license validation passed
#   - "Alerting system started (60s interval)" → initAlerting fired
#   - "Worker running on http://localhost:8080" → serve() bound
#   - Every 60s: alerting evaluating rules
```

## Regular deploys (post-bootstrap)

Manual deploys from the monorepo root:

```bash
cd ~/revfleet/revealui
flyctl deploy --config apps/server/fly.toml \
  --dockerfile apps/server/Dockerfile.worker \
  --remote-only
```

Automated deploys via GitHub Actions land in a future phase
(track via the lane plan).

## Secrets

All secrets live in revvault per [`docs/SECRETS.md`](../SECRETS.md).
The worker's full secret set (API-PARITY with the Vercel `revealui-api`
project) is defined in
[`scripts/sync/revvault-fly.toml`](../../scripts/sync/revvault-fly.toml).

The `revvault sync fly` target that would push it is **not yet implemented**
(the CLI only supports `sync vercel`); until it lands, set them manually with
`flyctl secrets set` as in §First deploy. `STRIPE_SECRET_KEY` + `STRIPE_LIVE_MODE`
are set Fly-direct (mode-gated), not synced.

**Never** paste secrets into `apps/server/fly.toml` — that file is
committed to the public repo. The `[env]` block in `fly.toml` is for
non-secret configuration only (NODE_ENV, port numbers, feature
flags).

## Env vars (non-secret, in `fly.toml`)

| Var | Default | Purpose |
|-----|---------|---------|
| `NODE_ENV` | `production` | Required for worker boot path |
| `WORKER_PORT` | `8080` | Fly maps this internally to public 80/443 via the `[http_service]` block |
| `REVMARKET_EXECUTOR_ENABLED` | `false` | Flip to `true` when marketplace UI is ready to accept real customer task submissions |
| `REVEALUI_FORGE` | `false` | Forge stamp pipeline sets `true` for self-hosted deployments (mounts terminal-ws WebSocket bridge) |

## Health check

Fly hits `/api/health` every 30s. That route is served by
`apps/server/src/routes/health.ts` (mounted by the Hono `app` that
worker.ts imports). The route returns 200 when:

- DB is reachable
- License validation has completed
- No catastrophic startup errors

If health checks fail repeatedly, Fly will mark the machine
unhealthy. Investigate via `flyctl logs --app revealui-worker`.

## Known gotchas

1. **pnpm workspace Docker builds**: optional peers
   (`@revealui/ai`, `@revealui/services` per
   `apps/server/package.json` `peerDependenciesMeta.optional`) can
   dangle as broken symlinks after `pnpm deploy --legacy`. The
   `Dockerfile.worker` takes the "include the packages in the
   runtime image" path to avoid this. See memory
   `feedback_pnpm_deploy_optional_peer_dangles`.

2. **Worker port vs API port**: worker binds `WORKER_PORT` (default
   8080). The Vercel-deployed apps/server uses
   `API_PORT||PORT||3004`. Different ports prevent local-dev
   collision when running both.

3. **Auto-stop is OFF**: `auto_stop_machines = 'off'` because the
   worker has in-memory state (collab rooms, executor poll loop,
   alerting interval). Stopping the machine drops the state.
   `min_machines_running = 1` keeps it always-on.

4. **Build context = monorepo root**: not `apps/server/`. flyctl
   auto-uses the right context when invoked from `~/revfleet/revealui`.
   If invoked from `apps/server/`, the build fails on missing
   `pnpm-workspace.yaml`.

5. **Dependency on `apps/server/src/worker.ts`** (Phase 2 of the
   infra-consolidation lane). Until Phase 2 lands on `test`,
   `flyctl deploy` will fail at the build step (no
   `dist/worker.js` to ship).

## Electric (Phase 5)

ElectricSQL Fly setup lives in a separate `fly.electric.toml`
(landing in Phase 5 of the infra-consolidation lane). Same region
(iad), same Fly account. Connects to the same Neon `POSTGRES_URL`
the worker uses. The cutover from Railway-hosted Electric to
Fly-hosted Electric is the load-bearing piece of Phase 5 — see the
lane plan for sequencing.
