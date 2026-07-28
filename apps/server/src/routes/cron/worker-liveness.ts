/**
 * Cron: Fly Worker Liveness Probe (GAP-443)
 *
 * Probes the Fly worker's public `/health` endpoint from the Vercel `api`
 * project. This is the external liveness watcher: if the worker goes dark,
 * nothing on the worker itself can page anyone, so a separate deployment has
 * to do the probing.
 *
 * Chosen as a PRIVATE Vercel cron route (this file) over a public status-page
 * service (e.g. Upptime) specifically to keep the worker's hostname out of
 * the public `revealui` repo. Consequently the target URL is read from
 * `REVEALUI_WORKER_HEALTH_URL` at runtime and is NEVER hardcoded, logged, or
 * included in alert text  -  only the observed status/error is reported.
 *
 * Fetches through `createSafeFetch()` (SSRF-guarded: rejects private/reserved
 * IPs, pins the resolved address, refuses redirects) with a 10s timeout.
 *
 * Scheduling: this route is NOT wired into `dispatch.ts` and there is no
 * `vercel.json` cron entry for it. The Vercel project is on the Hobby plan
 * (one cron/day, which `dispatch.ts` already consumes for ~14 other jobs) and
 * this probe needs a sub-daily cadence, so it is driven externally by
 * `.github/workflows/worker-liveness.yml` (every 5 minutes via GitHub
 * Actions, free on a public repo) instead  -  same rationale as GAP-142's
 * `reconciliation-crons.yml`.
 *
 * Sends an alert via `sendCronFailureAlert` (log + Sentry + email to
 * `REVEALUI_ALERT_EMAIL`) on any non-200 response, timeout, or network error.
 *
 * Protected by X-Cron-Secret header (timing-safe compare).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { createSafeFetch } from '@revealui/security/server';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';

const app = new Hono();

const HEALTH_CHECK_TIMEOUT_MS = 10_000;

/**
 * Diagnostic shape version, reported on every response.
 *
 * GAP-455: after the first classifier deployed, a run came back
 * `{"healthy":false,"error":"network-error"}`  -  a body the OLD code and the
 * NEW code both produce, so it was impossible to tell from the response
 * whether the fix was live or the deploy had not taken. Bump this on any
 * change to the diagnostic contract; then one run always says which build
 * answered. Cheap, and it never leaks anything about the target.
 */
const PROBE_VERSION = 3;

const safeFetch = createSafeFetch();

/**
 * Why the probe failed, as a CONSTANT token.
 *
 * Every value here is a fixed string chosen at build time. None of them is
 * derived from the caught error's text, because the SSRF guard embeds the
 * target hostname in its messages and that hostname must never reach a log,
 * an alert email, or a response body (this is a public repo  -  see the file
 * header). The token says which CLASS of failure happened; it never says
 * where.
 */
export type ProbeFailureReason =
  | 'timeout'
  | 'dns-unresolved'
  | 'blocked-private-ip'
  | 'blocked-redirect'
  | 'invalid-target'
  | 'blocked-by-guard'
  | 'network-error';

/**
 * Distinctive fragments of `@revealui/security`'s SSRF guard messages, mapped
 * to our constant tokens. Matched with `includes` (not regex, per the fleet
 * no-regex hardline) because the guard interpolates the hostname into the
 * MIDDLE of most of these strings, so a prefix check would not fire.
 *
 * This couples us to another package's message text, which is why
 * `worker-liveness.test.ts` drives the REAL guard and asserts these tokens
 * come back  -  if the guard rewords a message, that test fails rather than
 * this classifier silently degrading every guard rejection to 'network-error'
 * (which is the exact bug GAP-455 is about).
 */
const GUARD_MESSAGE_TOKENS: ReadonlyArray<readonly [string, ProbeFailureReason]> = [
  ['did not resolve to any public IP', 'dns-unresolved'],
  ['resolved to private IP', 'blocked-private-ip'],
  ['is a private/reserved IP', 'blocked-private-ip'],
  ['refusing to follow redirect', 'blocked-redirect'],
  ['invalid URL', 'invalid-target'],
  ['disallowed protocol', 'invalid-target'],
];

/**
 * Classify a probe failure into one constant token.
 *
 * Walks the whole error TREE (`cause` chain plus `AggregateError.errors`  -
 * see walkErrorTree for why both are load-bearing): the guard's pre-flight
 * `assertPublicUrl` throws directly, while a rejection from the undici
 * dispatcher's validating `lookup` surfaces wrapped, several levels down, and
 * possibly beside its siblings inside an AggregateError.
 *
 * Only the classification escapes this function  -  never the message.
 */
export function classifyProbeError(err: unknown): ProbeFailureReason {
  let sawGuardRejection = false;
  let reason: ProbeFailureReason | undefined;

  walkErrorTree(err, (current) => {
    if (reason) return;

    if (current.name === 'TimeoutError' || current.name === 'AbortError') {
      reason = 'timeout';
      return;
    }

    const message = current.message;
    for (const [fragment, token] of GUARD_MESSAGE_TOKENS) {
      if (message.includes(fragment)) {
        reason = token;
        return;
      }
    }
    if (message.startsWith('SSRF:')) sawGuardRejection = true;
  });

  if (reason) return reason;

  // A guard rejection we have no specific token for still beats reporting a
  // network fault: it means the request never left the process.
  return sawGuardRejection ? 'blocked-by-guard' : 'network-error';
}

/**
 * Visit an error and everything nested beneath it.
 *
 * Two nesting shapes matter here, and missing either one silently degrades a
 * precise diagnosis into 'network-error':
 *
 *   1. `cause`   - undici wraps a dispatcher/socket failure as
 *                  `TypeError: fetch failed` with the real error one or more
 *                  levels down.
 *   2. `errors`  - Node's Happy Eyeballs (`autoSelectFamily`, on by default)
 *                  tries every address our SSRF lookup returns, and when all
 *                  of them fail it throws an `AggregateError`. That error has
 *                  NO `code` and NO `cause`; the real failures are in
 *                  `.errors[]`. Because the guard deliberately returns BOTH
 *                  the A and AAAA records, this is the LIKELY shape for a real
 *                  outage here, not an exotic one.
 *
 * GAP-455: the first deployed version of this classifier followed only
 * `cause`, so it stopped at the AggregateError and reported a bare
 * 'network-error' with no code  -  which is exactly what the first real run
 * returned, and exactly as undiagnosable as the bug it was meant to fix.
 */
function walkErrorTree(root: unknown, visit: (err: Error) => void): void {
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!(current instanceof Error) || seen.has(current)) continue;
    seen.add(current);

    visit(current);

    if (current.cause !== undefined) queue.push(current.cause);
    // AggregateError, and anything else exposing sibling failures.
    const nested = (current as AggregateError).errors;
    if (Array.isArray(nested)) queue.push(...nested);
  }
}

/**
 * The error's `code`, when it is a safe constant to report.
 *
 * Node and undici codes are fixed identifiers (`ENOTFOUND`, `ECONNREFUSED`,
 * `UND_ERR_CONNECT_TIMEOUT`, ...) that carry no hostname, so surfacing one
 * turns an opaque 'network-error' into an actionable one. The VALUE is
 * reported, never the message that may accompany it.
 */
export function safeErrorCode(err: unknown): string | undefined {
  let code: string | undefined;

  walkErrorTree(err, (current) => {
    if (code) return;
    const candidate = (current as NodeJS.ErrnoException).code;
    if (typeof candidate === 'string' && candidate.length > 0) code = candidate;
  });

  return code;
}

/**
 * Error class names we are willing to echo, because each is a fixed identifier
 * from Node/undici/the platform and carries nothing about the target.
 *
 * An allowlist rather than "just report err.name": a custom error class could
 * in principle carry data in its name, and this response is read from a PUBLIC
 * repo's CI logs. Anything unrecognized is reported as 'other', which is still
 * the diagnostic signal we need (it says "not one of the known shapes") while
 * making a leak structurally impossible.
 */
const REPORTABLE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'AbortError',
  'AggregateError',
  'DOMException',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SocketError',
  'SyntaxError',
  'TimeoutError',
  'TypeError',
  'URIError',
  'UndiciError',
]);

/** Cap on reported names, so a pathological tree cannot produce unbounded output. */
const MAX_REPORTED_NAMES = 8;

/**
 * A safe structural fingerprint of the failure: the class names along the
 * error tree, in visit order.
 *
 * GAP-455, round 3. Two deployed classifiers have now both answered
 * 'network-error' with no code — meaning the throw carries no SSRF message and
 * no `code` anywhere, including inside AggregateError.errors. That narrows the
 * cause but does not name it, and each further guess costs a full deploy
 * cycle.
 *
 * Reporting the SHAPE ends the guessing: `['TypeError','AggregateError']` says
 * something very different from `['Error']` or `['other']`, and none of it can
 * leak the worker's hostname the way a message would.
 */
export function safeErrorNames(err: unknown): string[] {
  const names: string[] = [];

  walkErrorTree(err, (current) => {
    if (names.length >= MAX_REPORTED_NAMES) return;
    names.push(REPORTABLE_ERROR_NAMES.has(current.name) ? current.name : 'other');
  });

  // A throw that is not an Error at all never enters the walk, and that is
  // itself a live hypothesis for the observed body — so say so explicitly
  // rather than reporting an empty array that reads like "nothing happened".
  if (names.length === 0) names.push(err === undefined ? 'undefined-throw' : 'non-error-throw');

  return names;
}

app.get('/worker-liveness', async (c) => {
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');

  if (!(cronSecret && provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const checkedAt = new Date().toISOString();
  const healthUrl = process.env.REVEALUI_WORKER_HEALTH_URL;

  if (!healthUrl) {
    // Deliberately no fallback URL  -  this is a public repo and the worker
    // hostname must never be hardcoded. Unset is a supported no-op, not an
    // error: it lets the route ship ahead of the owner setting the var.
    logger.info('[worker-liveness] REVEALUI_WORKER_HEALTH_URL unset, probe skipped');
    return c.json({ skipped: true, checkedAt, probe: PROBE_VERSION }, 200);
  }

  try {
    const response = await safeFetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

    if (response.status === 200) {
      logger.info('[worker-liveness] worker healthy', { status: response.status });
      return c.json(
        { healthy: true, status: response.status, checkedAt, probe: PROBE_VERSION },
        200,
      );
    }

    logger.error('[worker-liveness] worker returned non-200 status', undefined, {
      status: response.status,
    });
    void sendCronFailureAlert({
      jobName: 'worker-liveness',
      error: new Error(`Worker liveness check returned non-200 status: ${response.status}`),
      severity: 'error',
      metadata: { status: response.status },
    });
    return c.json(
      { healthy: false, status: response.status, checkedAt, probe: PROBE_VERSION },
      503,
    );
  } catch (err) {
    // Never forward the caught error's message  -  the SSRF guard and
    // network-error paths can embed the target hostname in their text, and
    // that must not reach logs or the alert email. Only the constant token
    // from classifyProbeError and (when present) the constant error code.
    const reason = classifyProbeError(err);
    const code = safeErrorCode(err);
    // Round 3: two deployed classifiers both answered 'network-error' with no
    // code, so the SHAPE of the throw is now the only thing left to report.
    const names = safeErrorNames(err);

    // GAP-455: these buckets used to be one. Every non-timeout throw reported
    // 'network-error', so a probe that never opened a socket (guard rejection,
    // DNS failure, bad env value) was indistinguishable from a genuinely dark
    // worker  -  and the first live runs were exactly that false alarm. The
    // split is what makes a red run diagnosable from its body alone.
    logger.error(`[worker-liveness] probe failed (${reason})`, undefined, { reason, code, names });
    void sendCronFailureAlert({
      jobName: 'worker-liveness',
      error: new Error(
        reason === 'timeout'
          ? `Worker liveness check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`
          : `Worker liveness check failed: ${reason}${code ? ` (${code})` : ''}`,
      ),
      severity: 'error',
      metadata: { reason, code, names },
    });
    return c.json(
      { healthy: false, error: reason, code, names, checkedAt, probe: PROBE_VERSION },
      503,
    );
  }
});

export default app;
