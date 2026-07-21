# Electric latency probe

Isolated stack for measuring ElectricSQL shape-sync latency against a throwaway
Postgres. **Ephemeral only** — never the long-lived admin / fleet-marketing
database.

| Service | Host port | Identity |
|---------|-----------|----------|
| Postgres | **5434** | user/db `revealui` / `revealui_probe` |
| Electric | **5133** | local only |

Fleet seeds (`pnpm db:seed:fleet-marketing`, etc.) **refuse** this target unless
`REVEALUI_ALLOW_PROBE_DB=1` (see `scripts/lib/seed-env.ts`).

## Durable rule (do not re-break local dev)

**Never leave the probe URL in `apps/admin/.env.local`.**

That file is the durable admin database pointer (and is loaded by seed scripts).
Swapping it to port 5434 for a probe run, then forgetting to restore, makes every
later seed/bootstrap fail with a cryptic connection error against a dead port.

Use **session-scoped env** or a **separate probe env file** (below). Do not
`sed` the durable `.env.local` as the primary workflow.

## Runbook

### 1. Prerequisites

- Docker
- A cookie for an authenticated admin session (see step 5) stored in revvault:
  `revealui/dev/admin-session-cookie`

### 2. Bring up the probe stack

```bash
docker compose -f scripts/electric-latency-probe/docker-compose.yml up -d
docker compose -f scripts/electric-latency-probe/docker-compose.yml ps
# Both services should report "healthy" within ~30s.
```

### 3. Apply schema to the probe postgres (session env only)

```bash
export PROBE_DATABASE_URL='postgres://revealui:revealui@localhost:5434/revealui_probe?sslmode=disable'

DATABASE_URL="$PROBE_DATABASE_URL" POSTGRES_URL="$PROBE_DATABASE_URL" \
  pnpm --filter @revealui/db db:migrate
```

### 4. Point **this shell** (or a probe-only env file) at the probe DB

**Preferred — session env (no file mutation):**

```bash
export DATABASE_URL="$PROBE_DATABASE_URL"
export POSTGRES_URL="$PROBE_DATABASE_URL"
export ELECTRIC_SERVICE_URL='http://localhost:5133'

pnpm dev:admin
# admin uses the process env for this terminal only
```

**Alternate — probe-only env file (never overwrite durable .env.local):**

```bash
# Create once; gitignored via .env*.local
cat > apps/admin/.env.probe.local <<'EOF'
DATABASE_URL=postgres://revealui:revealui@localhost:5434/revealui_probe?sslmode=disable
POSTGRES_URL=postgres://revealui:revealui@localhost:5434/revealui_probe?sslmode=disable
ELECTRIC_SERVICE_URL=http://localhost:5133
EOF

# Load only for the probe session (example):
set -a && source apps/admin/.env.probe.local && set +a
pnpm dev:admin
```

**Forbidden as the durable workflow:** permanently rewriting
`apps/admin/.env.local` with a `sed` that points at 5434. If you must edit a
file for an old tool, take a timestamped backup and restore in the same shell
session before you leave:

```bash
# Discouraged; only if a tool cannot accept env overrides
cp apps/admin/.env.local "apps/admin/.env.local.bak.$(date +%Y%m%d%H%M%S)"
# …edit…
# restore before any fleet seed / normal admin work:
# cp apps/admin/.env.local.bak.<timestamp> apps/admin/.env.local
```

### 5. Sign in and store session cookie

```bash
pnpm dev:admin
# http://localhost:4000
```

1. Open `http://localhost:4000/admin`
2. Create an account on the **probe** DB (fresh each volume)
3. Devtools → Cookies → copy `revealui-session`
4. `echo '<cookie_value>' | revvault set revealui/dev/admin-session-cookie`

### 6. Run the probe

```bash
# Still with PROBE_DATABASE_URL / ELECTRIC_SERVICE_URL in this shell
pnpm exec tsx scripts/electric-latency-probe/probe.ts
# → scripts/electric-latency-probe/latency-notes-<timestamp>.md
```

### 7. Teardown

```bash
docker compose -f scripts/electric-latency-probe/docker-compose.yml down -v
unset DATABASE_URL POSTGRES_URL ELECTRIC_SERVICE_URL PROBE_DATABASE_URL
# Confirm durable admin env still points at docker-compose :5432 or Neon — not 5434
```

## Known gotchas

- [ ] **AI feature gate.** Shared-facts mutation may require a dev license.
- [ ] **session_id uniqueness.** Probe uses a UUID prefixed `probe-`.
- [ ] **Fleet seed refusal.** If you see `Seed refused the electric-latency-probe database`, your durable env still points at 5434; fix `apps/admin/.env.local` or export a real `POSTGRES_URL` before re-running `pnpm db:seed:fleet-marketing`.
