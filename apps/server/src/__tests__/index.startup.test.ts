/**
 * Regression tests for the API startup hang AND the 2026-05-18 Phase 2
 * worker extraction.
 *
 * Pre-2026-05-18 background: apps/server/src/index.ts carried two
 * near-identical NODE_ENV branches — one for dev (Fleet docker compose
 * runs) and one for production (Vercel). The production branch ran
 * every initializer (validateLicenseAtStartup, initAlerting,
 * hydrateInferenceConfigs) AND called serve() + injectWebSocket(). On
 * Vercel cold-start that bound a useless port and leaked setIntervals
 * on instance shutdown.
 *
 * Post-Phase-2 (this file's invariants): the prod block is GONE from
 * index.ts. Vercel cold-start now executes index.ts purely as a module
 * — no top-level NODE_ENV=production side effects. The long-running
 * boot logic lives in src/worker.ts (Fly entry).
 *
 * The dev block in index.ts is preserved so `pnpm dev:api` continues
 * to bind a listener under NODE_ENV=development.
 *
 * Tests read source files via fs (don't boot — importing index.ts
 * triggers the dev guard which short-circuits in NODE_ENV=test). No
 * regex authored, per `feedback_no_regex_ast_only`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSource = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');
const workerSource = readFileSync(resolve(__dirname, '..', 'worker.ts'), 'utf-8');

const PROD_GUARD = "if (process.env.NODE_ENV === 'production') {";
const DEV_GUARD = "if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {";

// The startup branch is the one that runs license validation. Other
// `process.env.NODE_ENV === 'production'` guards may exist in the file
// (e.g. Sentry init); this marker disambiguates them.
const STARTUP_BRANCH_MARKER = 'validateLicenseAtStartup';

/**
 * Walk brace depth from a known opening `{` index to its matching `}`.
 * No regex; pure index-arithmetic + linear scan. Returns body indices.
 */
function findMatchingClose(source: string, openBraceIndex: number): number {
  let depth = 1;
  let i = openBraceIndex + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  return i - 1;
}

/**
 * Walk every occurrence of `guard` in `source` and return the body of
 * the one whose interior contains `marker`. Returns '' if no occurrence
 * matches. Disambiguates branches when multiple top-level guards share
 * the same predicate text.
 */
function extractBranchBody(source: string, guard: string, marker?: string): string {
  let cursor = 0;
  while (cursor < source.length) {
    const guardStart = source.indexOf(guard, cursor);
    if (guardStart === -1) return '';
    const bodyStart = guardStart + guard.length;
    const bodyEnd = findMatchingClose(source, bodyStart - 1);
    const body = source.slice(bodyStart, bodyEnd);
    if (!marker || body.includes(marker)) return body;
    cursor = bodyEnd + 1;
  }
  return '';
}

describe('apps/server/src/index.ts — post-Phase-2 invariants', () => {
  it('does NOT contain a production guard that runs validateLicenseAtStartup (boot side-effect moved to worker.ts)', () => {
    // Other `process.env.NODE_ENV === 'production'` guards may exist
    // (e.g. Sentry init), but NONE may also contain validateLicenseAtStartup.
    // That combination defined the legacy prod boot block which now
    // lives in worker.ts exclusively. Re-introducing it would cause
    // Vercel cold-start to bind a useless port + leak setIntervals.
    const body = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);
    expect(
      body,
      'index.ts must NOT contain a production guard with validateLicenseAtStartup — that block moved to worker.ts',
    ).toBe('');
  });

  it('does NOT call serve() outside the dev guard (would bind a useless port on Vercel cold-start)', () => {
    // A bare `serve({ fetch: app.fetch, port })` outside any guard fires
    // unconditionally when api/index.js imports dist/index.js. The dev
    // block's `serve()` is guarded by NODE_ENV !== 'production' so it
    // short-circuits on Vercel — that's fine. This test asserts every
    // serve() call in index.ts lives inside the dev guard.
    const devBlockBody = extractBranchBody(indexSource, DEV_GUARD, STARTUP_BRANCH_MARKER);
    const serveCount = indexSource.split('serve({ fetch: app.fetch, port }').length - 1;
    const devBlockServeCount = devBlockBody.split('serve({ fetch: app.fetch, port }').length - 1;
    expect(
      serveCount,
      'All serve() calls in index.ts must live inside the dev guard',
    ).toBe(devBlockServeCount);
  });

  it('still contains the dev guard with validateLicenseAtStartup (pnpm dev:api boot path)', () => {
    const body = extractBranchBody(indexSource, DEV_GUARD, STARTUP_BRANCH_MARKER);
    expect(
      body,
      'index.ts dev block must still validate license + bind serve() for `pnpm dev:api`',
    ).toContain(STARTUP_BRANCH_MARKER);
    expect(body).toContain('serve({ fetch: app.fetch, port }');
    expect(body).toContain('terminalWs.injectWebSocket(server)');
  });

  it('exports the symbols worker.ts imports', () => {
    expect(
      indexSource,
      'index.ts must export default app for api/index.js (Vercel) AND worker.ts',
    ).toContain('export default app;');
    expect(
      indexSource,
      'index.ts must export terminalWs so worker.ts can call injectWebSocket',
    ).toContain('export const terminalWs = createTerminalRoute()');
    expect(
      indexSource,
      'index.ts must export initAlerting so worker.ts can call it',
    ).toContain('export function initAlerting');
  });
});

describe('apps/server/src/worker.ts — Fly entry invariants', () => {
  it('binds the HTTP listener via serve()', () => {
    expect(workerSource).toContain('serve({ fetch: app.fetch, port }');
  });

  it('reads port from WORKER_PORT or PORT with 8080 fallback (distinct from API_PORT)', () => {
    expect(workerSource).toContain('process.env.WORKER_PORT || process.env.PORT');
    expect(workerSource).toContain('8080');
  });

  it('runs the former prod-block initializers (validateLicenseAtStartup, initAlerting, hydrateInferenceConfigs)', () => {
    expect(workerSource).toContain('validateLicenseAtStartup()');
    expect(workerSource).toContain('initAlerting()');
    expect(workerSource).toContain('hydrateInferenceConfigs()');
  });

  it('gates startExecutor on REVMARKET_EXECUTOR_ENABLED (default OFF — wired but dormant until marketplace ready)', () => {
    expect(workerSource).toContain("process.env.REVMARKET_EXECUTOR_ENABLED === 'true'");
    expect(workerSource).toContain('startExecutor()');
  });

  it('gates terminalWs.injectWebSocket on REVEALUI_FORGE (default OFF — daemon socket only exists in Forge)', () => {
    expect(workerSource).toContain("process.env.REVEALUI_FORGE === 'true'");
    expect(workerSource).toContain('terminalWs.injectWebSocket(server)');
  });

  it('logs the running listener URL', () => {
    expect(workerSource).toContain('Worker running on http://localhost:');
  });
});

describe('index.ts dev block <-> worker.ts shape-equivalence on listener binding', () => {
  it('shared listener signals appear in both surfaces', () => {
    // If someone changes one surface's listener shape, the other must follow.
    // This prevents drift between the local-dev boot path and the Fly worker
    // boot path.
    const dev = extractBranchBody(indexSource, DEV_GUARD, STARTUP_BRANCH_MARKER);

    const sharedSignals = [
      'serve({ fetch: app.fetch, port }',
      'terminalWs.injectWebSocket(server)',
      'API documentation available at http://localhost:',
      'OpenAPI spec available at http://localhost:',
    ] as const;

    for (const signal of sharedSignals) {
      expect(dev, `dev block should contain ${signal}`).toContain(signal);
      expect(workerSource, `worker.ts should contain ${signal}`).toContain(signal);
    }
  });
});
