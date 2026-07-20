/**
 * GAP-401 — CI smoke: boot the API under `tsx` (dev path), hit /health/live, exit.
 *
 * Why: `pnpm --filter server start` (built bundle) was green for months while
 * `tsx watch src/index.ts` could not load (.ttf ESM imports + bare require).
 * E2E smoke only starts the built bundle, so the tsx path silently bit-rotted.
 *
 * This script intentionally uses the same entry as package.json "dev" without
 * the watch loop, waits for health, then SIGTERMs the child.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../..');
const SERVER = join(REPO, 'apps/server');
const ENTRY = join(SERVER, 'src/index.ts');
const PORT = process.env.PORT || '3104';
const HEALTH = `http://127.0.0.1:${PORT}/health/live`;
const MAX_WAIT_MS = 90_000;
const POLL_MS = 500;

const child = spawn(
  process.execPath,
  ['--import', 'tsx', ENTRY],
  {
    cwd: SERVER,
    env: {
      ...process.env,
      PORT,
      NODE_ENV: process.env.NODE_ENV || 'development',
      SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION || 'true',
      // Minimal DB so boot does not hang on missing URL when validate is skipped
      POSTGRES_URL:
        process.env.POSTGRES_URL ||
        process.env.DATABASE_URL ||
        'postgresql://test:test@127.0.0.1:5432/smoke',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

function killChild(signal = 'SIGTERM') {
  if (!child.killed) {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
}

async function waitForHealth() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    if (child.exitCode !== null) {
      throw new Error(
        `server exited early with code ${child.exitCode}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
      );
    }
    try {
      const res = await fetch(HEALTH, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    `timed out waiting for ${HEALTH} after ${MAX_WAIT_MS}ms\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
  );
}

try {
  await waitForHealth();
  process.stdout.write(`server-tsx-boot-smoke: OK ${HEALTH}\n`);
  killChild('SIGTERM');
  // Allow graceful exit
  await new Promise((r) => setTimeout(r, 1000));
  killChild('SIGKILL');
  process.exit(0);
} catch (err) {
  process.stderr.write(`server-tsx-boot-smoke: FAIL ${err instanceof Error ? err.message : err}\n`);
  killChild('SIGKILL');
  process.exit(1);
}
