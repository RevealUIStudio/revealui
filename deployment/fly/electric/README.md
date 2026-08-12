# Fly — revealui-electric (ElectricSQL)

Phase 5 of `drop-railway-migrate-to-fly`. Closes **GAP-230** / **GAP-231** when vault + Vercel admin pick up this host.

## What it is

| | |
|--|--|
| Fly app | `revealui-electric` |
| Image | `electricsql/electric:1.0.17` (pin; bump deliberately) |
| Region | `iad` (Neon prod us-east-1) |
| Volume | `electric_data` → `/var/lib/electric/persistent` |
| Public URL | `https://revealui-electric.fly.dev` |

Admin shape proxies (`apps/admin`) call this URL via `ELECTRIC_SERVICE_URL`. The worker does not serve shapes; it only carries a mirrored env for parity.

## One-time create

```bash
flyctl apps create revealui-electric --org personal
flyctl volumes create electric_data --app revealui-electric --region iad --size 1 --yes
```

## Secrets + vault (stream-safe)

Generate a secret once, force-set vault, then mirror to Fly:

```bash
# 1) secret → revvault (stdin; no TTY print)
openssl rand -hex 32 | revvault set revealui/prod/electric/secret --force

# 2) service URL after DNS/hostname known (public-config)
printf '%s' 'https://revealui-electric.fly.dev' | revvault set revealui/prod/electric/service-url --force

# 3) Fly secrets — expand vars INSIDE bash (outer shell empties them)
revvault run \
  --env DATABASE_URL=revealui/prod/db/postgres-url \
  --env ELECTRIC_SECRET=revealui/prod/electric/secret -- \
  bash -c '
    DB="$DATABASE_URL"
    case "$DB" in postgresql://*) DB="postgres://${DB#postgresql://}" ;; esac
    flyctl secrets set --app revealui-electric \
      DATABASE_URL="$DB" ELECTRIC_SECRET="$ELECTRIC_SECRET"
  '
```

Neon must have **logical replication** enabled. `revealui/prod/db/postgres-url`
must be the **direct** endpoint (not `-pooler`). Electric 1.0.17 parses
`postgres://`; rewrite `postgresql://` if the vault stores that form.

**Do not** run `flyctl secrets set DATABASE_URL="$DATABASE_URL"` as the direct
child of `revvault run` — the outer shell expands the empty var before inject.

## Deploy

```bash
cd ~/revfleet/revealui   # or worktree
flyctl deploy --config deployment/fly/electric/fly.toml --remote-only
flyctl status --app revealui-electric
curl -sS "https://revealui-electric.fly.dev/v1/health"
```

## Vercel admin (not unscoped full sync)

Prefer dry-run then apply, or single-key push after vault is clean. Full `vercel:sync:apply` can rewrite every sensitive var (GAP-339). After vault is good:

```bash
revvault run --env VERCEL_TOKEN=revealui/prod/api-keys/vercel-token -- \
  revvault sync vercel --manifest scripts/sync/revvault-vercel.toml
# inspect electric rows only, then:
revvault run --env VERCEL_TOKEN=revealui/prod/api-keys/vercel-token -- \
  revvault sync vercel --manifest scripts/sync/revvault-vercel.toml --apply
```

Redeploy **revealui-admin** so runtime picks up env. Probe:

```bash
curl -sS https://admin.revealui.com/api/health/electric
# expect {"ok":true,...}
```

## Teardown note

Do not delete the Fly volume without first dropping Neon replication slots Electric created (`electric_slot_*`), or WAL can grow unbounded.
