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

let child;
let stdout = '';
let stderr = '';
let childError;
let childExit;
let childClosed = false;
let childClose;
let stopping = false;
const cancellation = new AbortController();
const onSIGINT = () => cancellation.abort(new Error('smoke interrupted by SIGINT'));
const onSIGTERM = () => cancellation.abort(new Error('smoke interrupted by SIGTERM'));
let resolveChildClose;

function onChildError(error) {
  childError = error;
  cancellation.abort(error);
}

function onChildExit(code, signal) {
  childExit = { code, signal };
  if (!stopping) cancellation.abort(earlyExitFailure(code, signal));
}

function onChildClose() {
  childClosed = true;
  resolveChildClose();
  if (!stopping) cancellation.abort(earlyCloseFailure());
}

function onStdout(chunk) { stdout += chunk.toString(); }
function onStderr(chunk) { stderr += chunk.toString(); }


function startChild() {
  child = spawn(
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

  child.on('error', onChildError);
  child.once('exit', onChildExit);
  childClose = new Promise((resolve) => { resolveChildClose = resolve; });
  child.once('close', onChildClose);
  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
}

async function waitForClose(milliseconds) {
  if (childClosed) return true;
  let timer;
  try {
    return await Promise.race([
      childClose.then(() => true),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

let cleanup;
function stopChild() {
  cleanup ??= (async () => {
    stopping = true;
    if (!child || childClosed) return;
    const signalErrors = [];
    for (const [signal, milliseconds] of [['SIGTERM', 1000], ['SIGKILL', 2000]]) {
      try {
        if (!child.kill(signal)) signalErrors.push(new Error(`${signal} was not accepted`));
      } catch (error) {
        signalErrors.push(error);
      }
      if (await waitForClose(milliseconds)) return;
    }
    throw new AggregateError(signalErrors, 'server child shutdown was not confirmed');
  })();
  return cleanup;
}

function earlyExitFailure(code, signal) {
  const exit = signal ? `signal ${signal}` : `code ${code}`;
  return new Error(
    `server exited early with ${exit}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
  );
}

function assertChildRunning() {
  if (childError) throw childError;
  if (childExit) throw earlyExitFailure(childExit.code, childExit.signal);
  if (childClosed) throw earlyCloseFailure();
  if (child.exitCode !== null || child.signalCode !== null) {
    throw earlyExitFailure(child.exitCode, child.signalCode);
  }
}

function earlyCloseFailure() {
  return new Error(
    `server child closed before becoming healthy\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
  );
}

async function waitForHealth() {
  const start = Date.now();
  const deadline = new AbortController();
  const signal = AbortSignal.any([cancellation.signal, deadline.signal]);
  const timeoutFailure = () => new Error(
    `timed out waiting for ${HEALTH} after ${MAX_WAIT_MS}ms\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
  );
  const timer = setTimeout(() => deadline.abort(timeoutFailure()), MAX_WAIT_MS);
  try {
    while (Date.now() - start < MAX_WAIT_MS) {
      signal.throwIfAborted();
      assertChildRunning();
      let healthy = false;
      const requestTimeout = new AbortController();
      const requestTimer = setTimeout(() => {
        requestTimeout.abort(new DOMException('health request timed out', 'TimeoutError'));
      }, 2000);
      try {
        const res = await fetch(HEALTH, {
          signal: AbortSignal.any([signal, requestTimeout.signal]),
        });
        healthy = res.ok;
      } catch {
        signal.throwIfAborted();
        // not up yet
      } finally {
        clearTimeout(requestTimer);
      }
      signal.throwIfAborted();
      assertChildRunning();
      if (healthy) return;
      await new Promise((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(pollTimer);
          reject(signal.reason);
        };
        const pollTimer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }, POLL_MS);
        signal.addEventListener('abort', onAbort, { once: true });
      });
    }
    throw timeoutFailure();
  } finally {
    clearTimeout(timer);
  }
}

try {
  process.on('SIGINT', onSIGINT);
  process.on('SIGTERM', onSIGTERM);
  startChild();
  await waitForHealth();
  await stopChild();
  cancellation.signal.throwIfAborted();
  process.stdout.write(`server-tsx-boot-smoke: OK ${HEALTH}\n`);
  process.exitCode = 0;
} catch (err) {
  let failure = err;
  try {
    await stopChild();
  } catch (cleanupError) {
    if (cleanupError !== err) {
      failure = new AggregateError([err, cleanupError], `${err instanceof Error ? err.message : err}; ${cleanupError.message}`);
    }
  }
  await new Promise((resolve) => {
    process.stderr.write(`server-tsx-boot-smoke: FAIL ${failure instanceof Error ? failure.message : failure}\n`, resolve);
  });
  process.exitCode = 1;
} finally {
  process.off('SIGINT', onSIGINT);
  process.off('SIGTERM', onSIGTERM);
  child?.off('error', onChildError);
  child?.off('exit', onChildExit);
  child?.off('close', onChildClose);
  child?.stdout?.off('data', onStdout);
  child?.stderr?.off('data', onStderr);
}

// Cleanup has settled and failure output has flushed. A child whose shutdown
// remains unconfirmed may keep native handles alive, so complete the CLI failure.
if (process.exitCode === 1) process.exit(1);
