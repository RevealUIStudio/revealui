/**
 * Electric Latency Probe — Local End-to-End Measurement
 *
 * Scaffold per web Claude's spec. Measures propagation latency through
 * your LOCAL admin app:
 *     write → POST /api/sync/shared-facts → DB
 *          → Electric shape stream → subscriber callback
 *
 * See README.md in this directory for setup + TODO list.
 *
 * Run:
 *     pnpm exec tsx scripts/electric-latency-probe/probe.ts
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Config — revvault is the single source of truth. No env fallback.
// See ~/.claude/rules/secrets.md for the hard rule.
// ---------------------------------------------------------------------------

const REVVAULT_BIN =
  process.env.REVVAULT ?? '/home/joshua-v-dev/suite/revvault/target/release/revvault';

interface SecretOptions {
  optional?: boolean;
}

function revvault(path: string): string;
function revvault(path: string, options: { optional: true }): string | null;
function revvault(path: string, options: SecretOptions = {}): string | null {
  const result = spawnSync(REVVAULT_BIN, ['get', '--full', path], { encoding: 'utf8' });
  if (result.status === 0) {
    const value = result.stdout.trimEnd();
    if (value.length > 0) return value;
  }

  if (options.optional) return null;

  console.error(`
FAIL: revvault path not found or empty.
  path:   '${path}'
  binary: ${REVVAULT_BIN}

Set it:
  echo "<value>" | revvault set ${path}

See scripts/electric-latency-probe/README.md for the full path list.
`);
  process.exit(1);
}

const ADMIN_BASE_URL = revvault('revealui/dev/admin-base-url');
const ELECTRIC_SERVICE_URL = revvault('revealui/dev/electric/service-url');
const SESSION_COOKIE = revvault('revealui/dev/admin-session-cookie');
// Electric's shared secret (if any) is handled server-side by the admin proxy;
// the probe never calls Electric directly, so it doesn't need the secret here.

const SESSION_COOKIE_NAME = 'revealui-session';

// ---------------------------------------------------------------------------
// Probe parameters
// ---------------------------------------------------------------------------

const TOTAL_SAMPLES = 50;
const WARMUP_SAMPLES = 5;
const PROBE_SESSION_ID = `probe-${crypto.randomUUID()}`;
const PROBE_AGENT_ID = 'latency-probe';
// Must match one of the VALID_FACT_TYPES in the mutation route:
//   discovery | bug | decision | warning | question | answer
const FACT_TYPE = 'discovery';
const SLEEP_BETWEEN_SAMPLES_MS = 250;

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOTES_PATH = join(
  __dirname,
  `latency-notes-${new Date().toISOString().replace(/[:.]/g, '-')}.md`,
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sample {
  sampleIndex: number;
  isWarmup: boolean;
  factId: string;
  mutationStartMs: number;
  mutation201Ms: number;
  subscriberFiredMs: number;
  /** Write initiated → subscriber fires (diagnostic). */
  commitConfirmedToSubscriberMs: number;
  /** Mutation 201 → subscriber fires (room-quotable). */
  mutationAcceptedToSubscriberMs: number;
}

interface HealthInfo {
  electricReachable: boolean;
  electricResponse: string;
  adminReachable: boolean;
  adminResponse: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Shape stream subscription (long-poll against the admin proxy)
// ---------------------------------------------------------------------------

/**
 * Subscribes to the shared-facts shape for PROBE_SESSION_ID via the
 * admin proxy (http://admin/api/shapes/shared-facts?session_id=...).
 *
 * Fires `onRow` with the current wall-clock and the fact_id whenever a
 * new row arrives. Returns an abort handle.
 */
function subscribeToShape(onRow: (factId: string, ts: number) => void): () => void {
  const controller = new AbortController();
  let offset = '-1';
  let shapeHandle: string | undefined;
  let cancelled = false;
  const seenIds = new Set<string>();

  (async () => {
    while (!cancelled) {
      const url = new URL(`${ADMIN_BASE_URL}/api/shapes/shared-facts`);
      url.searchParams.set('session_id', PROBE_SESSION_ID);
      url.searchParams.set('offset', offset);
      if (shapeHandle) url.searchParams.set('handle', shapeHandle);
      url.searchParams.set('live', 'true');

      try {
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION_COOKIE}` },
        });
        if (!res.ok) {
          if (res.status === 401) {
            console.error('Shape subscribe unauthorized — session cookie invalid or expired.');
            process.exit(2);
          }
          if (res.status === 409) {
            // Handle shift — Electric says our handle/offset is stale.
            shapeHandle = undefined;
            offset = '-1';
            continue;
          }
          console.error(`Shape subscribe HTTP ${res.status} — retrying.`);
          await sleep(500);
          continue;
        }

        const newHandle = res.headers.get('electric-handle');
        const newOffset = res.headers.get('electric-offset');
        if (newHandle) shapeHandle = newHandle;
        if (newOffset) offset = newOffset;

        const ts = performance.now();
        const messages = (await res.json()) as Array<{
          headers?: { operation?: string };
          value?: { id?: string };
        }>;

        for (const msg of messages) {
          if (msg.headers?.operation === 'insert' && msg.value?.id) {
            const factId = msg.value.id;
            if (!seenIds.has(factId)) {
              seenIds.add(factId);
              onRow(factId, ts);
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        const name = (err as Error).name;
        if (name === 'AbortError') return;
        console.error('Shape subscribe error:', (err as Error).message, '— retrying.');
        await sleep(500);
      }
    }
  })();

  return () => {
    cancelled = true;
    controller.abort();
  };
}

// ---------------------------------------------------------------------------
// Write a single fact, measure propagation
// ---------------------------------------------------------------------------

async function postOneFact(): Promise<{ factId: string; startMs: number; acceptedMs: number }> {
  const content = `probe-${crypto.randomUUID().slice(0, 8)}`;
  const startMs = performance.now();

  const res = await fetch(`${ADMIN_BASE_URL}/api/sync/shared-facts`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${SESSION_COOKIE_NAME}=${SESSION_COOKIE}`,
    },
    body: JSON.stringify({
      session_id: PROBE_SESSION_ID,
      agent_id: PROBE_AGENT_ID,
      content,
      fact_type: FACT_TYPE,
      confidence: 1.0,
    }),
  });

  const acceptedMs = performance.now();

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST shared-facts HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const created = (await res.json()) as { id: string };
  return { factId: created.id, startMs, acceptedMs };
}

// ---------------------------------------------------------------------------
// Liveness check
// ---------------------------------------------------------------------------

async function checkHealth(): Promise<HealthInfo> {
  const info: HealthInfo = {
    electricReachable: false,
    electricResponse: '',
    adminReachable: false,
    adminResponse: '',
    timestamp: new Date().toISOString(),
  };

  // Electric direct
  try {
    const res = await fetch(`${ELECTRIC_SERVICE_URL}/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    info.electricReachable = res.ok;
    info.electricResponse = `HTTP ${res.status} ${res.statusText}`;
  } catch (err) {
    info.electricResponse = `unreachable: ${(err as Error).message}`;
  }

  // Admin proxy (via a shape request with auth — lighter-weight than signing in)
  try {
    const url = new URL(`${ADMIN_BASE_URL}/api/shapes/shared-facts`);
    url.searchParams.set('session_id', 'liveness-check');
    url.searchParams.set('offset', '-1');
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(3000),
      headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION_COOKIE}` },
    });
    info.adminReachable = res.ok || res.status === 404; // 404 means route works but no shape yet
    info.adminResponse = `HTTP ${res.status} ${res.statusText}`;
  } catch (err) {
    info.adminResponse = `unreachable: ${(err as Error).message}`;
  }

  return info;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

function p95(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`
================================================================
  Electric Latency Probe
================================================================
  session_id:  ${PROBE_SESSION_ID}
  admin:       ${ADMIN_BASE_URL}
  electric:    ${ELECTRIC_SERVICE_URL}
  samples:     ${TOTAL_SAMPLES} (${WARMUP_SAMPLES} warmup, ${TOTAL_SAMPLES - WARMUP_SAMPLES} measured)
  notes file:  ${NOTES_PATH}
`);

  console.log('Liveness check...');
  const health = await checkHealth();
  console.log(`  electric: ${health.electricResponse}`);
  console.log(`  admin:    ${health.adminResponse}`);
  if (!health.adminReachable) {
    console.error('\nAdmin app not reachable. Is `pnpm dev:admin` running on the URL in revvault?');
    process.exit(3);
  }

  console.log('\nOpening shape subscription...');
  const samples: Sample[] = [];
  const pending = new Map<string, { sampleIndex: number; startMs: number; acceptedMs: number }>();

  const stopSubscribe = subscribeToShape((factId, subscriberFiredMs) => {
    const entry = pending.get(factId);
    if (!entry) return; // not from this probe run
    pending.delete(factId);

    samples.push({
      sampleIndex: entry.sampleIndex,
      isWarmup: entry.sampleIndex < WARMUP_SAMPLES,
      factId,
      mutationStartMs: entry.startMs,
      mutation201Ms: entry.acceptedMs,
      subscriberFiredMs,
      commitConfirmedToSubscriberMs: subscriberFiredMs - entry.startMs,
      mutationAcceptedToSubscriberMs: subscriberFiredMs - entry.acceptedMs,
    });
  });

  // Give the subscription a moment to establish before the first write.
  await sleep(1000);

  console.log(`\nRunning ${TOTAL_SAMPLES} samples (first ${WARMUP_SAMPLES} are warmup)...\n`);
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    try {
      const { factId, startMs, acceptedMs } = await postOneFact();
      pending.set(factId, { sampleIndex: i, startMs, acceptedMs });
    } catch (err) {
      console.error(`  sample ${i}: write failed — ${(err as Error).message}`);
      if (i === 0) {
        console.error('\nFirst sample failed. Stopping — check the AI feature gate + auth.');
        stopSubscribe();
        process.exit(4);
      }
    }
    if (i < TOTAL_SAMPLES - 1) await sleep(SLEEP_BETWEEN_SAMPLES_MS);
  }

  // Give the tail writes time to propagate
  console.log('\nWaiting 5s for any in-flight propagation...');
  await sleep(5000);
  stopSubscribe();

  if (pending.size > 0) {
    console.warn(`\nWARN: ${pending.size} writes did not receive a subscriber callback.`);
  }

  // ----- Format report -----
  samples.sort((a, b) => a.sampleIndex - b.sampleIndex);
  const measured = samples.filter((s) => !s.isWarmup);
  const roomQuoteValues = measured.map((s) => s.mutationAcceptedToSubscriberMs);
  const diagnosticValues = measured.map((s) => s.commitConfirmedToSubscriberMs);

  const report = `# Electric Latency Probe — ${new Date().toISOString()}

**Measured against:** local admin (\`${ADMIN_BASE_URL}\`) → local Electric (\`${ELECTRIC_SERVICE_URL}\`)
**Backend identification:**
- Electric: ${health.electricResponse}
- Admin:    ${health.adminResponse}

**Measured in dev mode; prod middleware posture may differ.**

---

## Summary (room-quotable number)

**mutation_accepted_to_subscriber_ms** — wall-clock from the server
committing the write (HTTP 201 returned) to the Electric shape subscriber
receiving the row.

- **median: ${median(roomQuoteValues).toFixed(0)} ms**
- p95:    ${p95(roomQuoteValues).toFixed(0)} ms
- samples: ${measured.length} of ${TOTAL_SAMPLES} (first ${WARMUP_SAMPLES} excluded as warmup)

## Diagnostic (decomposition only)

**commit_confirmed_to_subscriber_ms** — includes the mutation route's
own latency (auth, validation, DB insert, network back to client).

- median: ${median(diagnosticValues).toFixed(0)} ms
- p95:    ${p95(diagnosticValues).toFixed(0)} ms

## Raw samples (warmup excluded from summary)

| # | warmup | mut 201→sub (ms) | commit start→sub (ms) | fact_id |
|---|--------|-----------------:|---------------------:|---------|
${samples
  .map(
    (s) =>
      `| ${s.sampleIndex} | ${s.isWarmup ? '[warmup, excluded]' : ''} | ${s.mutationAcceptedToSubscriberMs.toFixed(0)} | ${s.commitConfirmedToSubscriberMs.toFixed(0)} | ${s.factId.slice(0, 8)}… |`,
  )
  .join('\n')}

## Not measured

- Concurrent-write load. This is an unloaded serial measurement.
  Propagation under 50 concurrent agents is unknown.
- The Vercel→Railway→Supabase cloud path. Allevia's Forge deployment
  is local-box; cloud measurement would add hops that won't exist on
  the customer's box.
`;

  mkdirSync(dirname(NOTES_PATH), { recursive: true });
  writeFileSync(NOTES_PATH, report);
  console.log(`\n================================================================`);
  console.log(`Written to: ${NOTES_PATH}`);
  console.log(`\nmedian (room-quotable): ${median(roomQuoteValues).toFixed(0)} ms`);
  console.log(`p95:                     ${p95(roomQuoteValues).toFixed(0)} ms`);
  console.log(`samples:                 ${measured.length}/${TOTAL_SAMPLES}`);
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
