---
visibility: internal
status: verified
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
| `revealui-worker` | apps/server long-running subset (alerting, Yjs collab WS, agent-collab WS, terminal-ws Forge-gated, RVMarket executor flag-gated) | Phase 3 — live |
| `revealui-electric` | ElectricSQL sync service, replicates from Neon | Phase 5 — Electric cutover from the retired Railway host (ADR 2026-05-18) |
| `revealui-license-signer` | Isolated license JWT mint (GAP-260 P4-2). Holds the signing private key. | P4-4 cutover |

## First deploy (one-time setup)

Run from the monorepo root (`~/revfleet/revealui`) so flyctl uses
the right build context for the pnpm workspace:

```bash
cd ~/revfleet/revealui

# 1. Authenticate to Fly (one-time per machine)
flyctl auth login

# 2. Create the Fly app (one-time per environment)
flyctl apps create revealui-worker --org personal

# 3. Mirror prod secrets from revvault → Fly via the sync target.
#
#    The private ops/sync/revvault-fly.toml manifest defines the worker's full
#    secret set ([fly-apps.revealui-worker.vars]). The worker imports the full
#    Hono app, so it needs API-PARITY env (same set as the Vercel revealui-api
#    project) — a minimal subset fails startup validation. Auth via
#    FLY_API_TOKEN (or --token). Dry-run first (prints the add/set/orphan
#    diff, writes nothing), then apply:
revvault sync fly --manifest "$(tsx scripts/sync/print-manifest-path.ts fly)"
revvault sync fly --manifest "$(tsx scripts/sync/print-manifest-path.ts fly)" --apply

# 3b. STRIPE — set Fly-direct, NOT via the sync target. STRIPE_SECRET_KEY and
#     STRIPE_LIVE_MODE are on the manifest's `skip` list: startup validation
#     requires the key's sk_test_/sk_live_ prefix to agree with STRIPE_LIVE_MODE,
#     so the pair is set together, mode-gated, directly on the app:
flyctl secrets set --stage --app revealui-worker STRIPE_SECRET_KEY="sk_..." STRIPE_LIVE_MODE="..."

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

## License-signer (GAP-260)

Isolated mint process. Only this app (plus the offline stamper) should hold
`REVEALUI_LICENSE_PRIVATE_KEY` after api/worker cut over.

```bash
cd ~/revfleet/revealui

flyctl apps create revealui-license-signer --org personal

# Stream-safe: values stay in the child env (never printed).
revvault run \
  --env REVEALUI_LICENSE_PRIVATE_KEY=revdev/license-signing-private-key \
  --env REVEALUI_LICENSE_PUBLIC_KEY=revdev/license-signing-public-key \
  --env REVEALUI_SIGNER_INVOKE_SECRET=revealui/prod/license/signer-invoke-secret \
  -- sh -c 'flyctl secrets set --app revealui-license-signer \
    REVEALUI_LICENSE_PRIVATE_KEY="$REVEALUI_LICENSE_PRIVATE_KEY" \
    REVEALUI_LICENSE_PUBLIC_KEY="$REVEALUI_LICENSE_PUBLIC_KEY" \
    REVEALUI_SIGNER_INVOKE_SECRET="$REVEALUI_SIGNER_INVOKE_SECRET"'

flyctl deploy --config apps/license-signer/fly.toml \
  --dockerfile apps/license-signer/Dockerfile --remote-only

curl -fsS https://revealui-license-signer.fly.dev/health/live
```

Do not set `REVEALUI_LICENSE_SIGN_VIA_SIGNER=1` on api until `/health/live`
is 200 and one HMAC mint succeeds. Do not drop the worker private key until
then.

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
the private coordination-repo `ops/sync/revvault-fly.toml`.

Push it with the `revvault sync fly` target — dry-run by default, `--apply`
to write (see §First deploy step 3):

```bash
revvault sync fly --manifest "$(tsx scripts/sync/print-manifest-path.ts fly)" [--apply]
```

The sync adds absent secrets and re-sets present ones; secrets that exist on
the Fly app but not in the manifest are surfaced as orphans, never deleted.
`STRIPE_SECRET_KEY` + `STRIPE_LIVE_MODE` are on the manifest's `skip` list and
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

Config: [`deployment/fly/electric/fly.toml`](../../deployment/fly/electric/fly.toml)
+ runbook [`deployment/fly/electric/README.md`](../../deployment/fly/electric/README.md).

| | |
|--|--|
| App | `revealui-electric` |
| Image | `electricsql/electric:1.0.17` |
| Region | `iad` (same Neon us-east-1) |
| URL | `https://revealui-electric.fly.dev` |

Connects to Neon via `revealui/prod/db/postgres-url` (direct, non-pooler).
Vault paths after cutover: `revealui/prod/electric/service-url` +
`revealui/prod/electric/secret` (GAP-230 / GAP-231). Electric Cloud is
**retired** (2026-08-11); self-host only.
