# Electric Latency Probe

Measures end-to-end propagation latency through the local admin app:
write → DB → Electric → shape stream → subscriber callback.

Produces a small notes file with a median + p95 number you can quote
in a meeting, with a header that identifies which backend was measured.

## Why local, not prod

- Allevia's Forge deployment is local-box, not cloud. The honest
  number is the local number; the cloud path adds Vercel→Railway
  and Railway→Supabase hops that Allevia won't experience.
- Avoids writing 50 POSTs into a prod shape other subscribers read.
- Secrets posture: the script pulls from revvault rather than
  env-vars you have to paste anywhere.

## One-time setup (~10 min)

### 1. Store the config values in revvault

Revvault is the single source of truth for all secrets. See
`~/.claude/rules/secrets.md` for the hard rule.

```bash
# Electric service URL — LOCAL running Electric (see step 2). Do NOT use prod.
echo "http://localhost:5133" | revvault set revealui/dev/electric/service-url

# Electric shared secret if your local Electric is configured with one
# (ELECTRIC_SECRET env var on the Electric process). Skip this set if
# running Electric with ELECTRIC_INSECURE=true for local dev.
echo "<secret>" | revvault set revealui/dev/electric/secret

# A valid signed-in session cookie for the local admin app.
# Get this by signing into http://localhost:4000/admin in a browser,
# opening devtools → Application → Cookies → copy the value of
# `revealui-session`.
echo "<cookie_value>" | revvault set revealui/dev/admin-session-cookie

# The admin app base URL (usually localhost:4000 in dev)
echo "http://localhost:4000" | revvault set revealui/dev/admin-base-url
```

### 2. Bring up the probe stack (postgres + electric)

Isolated compose in this directory. Uses ports 5434 (postgres) and 5133
(electric) — doesn't collide with any other compose.

```bash
cd /home/joshua-v-dev/suite/revealui
docker compose -f scripts/electric-latency-probe/docker-compose.yml up -d
docker compose -f scripts/electric-latency-probe/docker-compose.yml ps
# Both services should report "healthy" within ~30s.
```

### 3. Apply the schema to the probe postgres

Drizzle migrations create the tables the probe writes to (`shared_facts`,
etc.). Run once after bringing up the stack:

```bash
cd /home/joshua-v-dev/suite/revealui
DATABASE_URL='postgres://revealui:revealui@localhost:5434/revealui_probe?sslmode=disable' \
  pnpm --filter @revealui/db db:migrate
```

### 4. Point admin at the probe DB for this session

The admin app's `.env.local` usually points at cloud. For the probe run,
swap `DATABASE_URL` to the probe DB. Back up first so the swap is reversible:

```bash
cd /home/joshua-v-dev/suite/revealui/apps/admin
cp .env.local .env.local.backup

# Replace the DATABASE_URL line:
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://revealui:revealui@localhost:5434/revealui_probe?sslmode=disable|' .env.local

# Add the probe Electric URL (or edit if present):
grep -q '^ELECTRIC_SERVICE_URL=' .env.local \
  && sed -i 's|^ELECTRIC_SERVICE_URL=.*|ELECTRIC_SERVICE_URL=http://localhost:5133|' .env.local \
  || echo 'ELECTRIC_SERVICE_URL=http://localhost:5133' >> .env.local
```

Restore after the probe run: `cp .env.local.backup .env.local && rm .env.local.backup`.

### 5. Start admin, sign in, store session cookie

```bash
cd /home/joshua-v-dev/suite/revealui
pnpm dev:admin
# admin now serving on http://localhost:4000
```

In a browser:

1. Open `http://localhost:4000/admin`
2. Create an account (fresh probe DB has no users)
3. Devtools → Application → Cookies → `localhost:4000` → copy the value
   of `revealui-session`
4. Store it in revvault:

```bash
echo '<cookie_value>' | revvault set revealui/dev/admin-session-cookie
```

### 6. Run the probe

```bash
cd /home/joshua-v-dev/suite/revealui
pnpm exec tsx scripts/electric-latency-probe/probe.ts

# Output file:
#   scripts/electric-latency-probe/latency-notes-<timestamp>.md
```

### 7. Teardown

```bash
# Restore admin env
cd /home/joshua-v-dev/suite/revealui/apps/admin
cp .env.local.backup .env.local && rm .env.local.backup

# Bring down the probe stack (-v removes the postgres volume → fresh DB next time)
cd /home/joshua-v-dev/suite/revealui
docker compose -f scripts/electric-latency-probe/docker-compose.yml down -v
```

## Known gotchas — verify before first run

- [ ] **AI feature gate.** The shared-facts mutation route may run through
      `checkAIFeatureGate`. If it rejects without a license key, the first
      write fails with 403 and the probe exits before warmup completes.
      Resolve by issuing a dev license or bypassing the gate for
      localhost in dev mode.
- [ ] **session_id uniqueness.** Probe uses a UUID prefixed `probe-`,
      visible in the notes file header. Low clash risk; flagged for
      traceability only.

## What it measures (two timings per write)

- **mutation_accepted_to_subscriber_ms** — wall-clock from
  `POST /api/sync/shared-facts` returning 201 (server has committed
  the row) to the subscriber's callback firing with the new row.
  **This is the number you quote in the room.**
- **commit_confirmed_to_subscriber_ms** — wall-clock from the `fetch`
  call starting to the subscriber's callback firing. Includes the
  mutation route's own latency (auth, validation, DB insert, network).
  **Diagnostic only.** Use to decompose if the room number regresses.

Output has both, labeled unambiguously.

## What it does NOT measure

- Concurrent load. All writes are serial. Don't quote the measured
  number as an upper bound on propagation under concurrent writes —
  the real number at 50 concurrent agents is unknown and not addressed
  by this script. If someone asks, say exactly that.
- The Vercel → Railway → Supabase cloud path. Prod would have that
  plus CDN caching behavior we don't simulate here.
