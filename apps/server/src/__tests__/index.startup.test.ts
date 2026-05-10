/**
 * Regression test for the API startup hang.
 *
 * Background: between 2026-04 and 2026-05-10, `apps/server/src/index.ts`
 * carried two near-identical NODE_ENV branches — one for dev (and Fleet
 * docker compose runs) at the top of the module, and one for production
 * (Vercel) lower down. The production branch ran every initializer
 * (validateLicenseAtStartup, initPriceOracle, initAlerting,
 * hydrateInferenceConfigs) but lacked the `serve()` call that actually
 * binds the HTTP listener. Result: NODE_ENV=production containers came up,
 * passed liveness, but never answered traffic — a silent hang.
 *
 * Diagnosis: HANDOFF-2026-05-10-1245Z-strategy-arc-session-archive.md §"API
 * startup hang root cause identified" (apps/server/src/index.ts:1318-1342
 * was missing serve() relative to the dev branch at lines ~1300-1305).
 *
 * This test asserts the production branch contains the literal pieces that
 * make up a binding listener so the regression cannot recur. We do not
 * boot the server (importing `index.ts` runs initializers as a side
 * effect, which is wrong for a unit test) — instead we read the source
 * file and verify shape via string containment. No regex authored, per
 * `feedback_no_regex_ast_only`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSource = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf-8');

const PROD_GUARD = "if (process.env.NODE_ENV === 'production') {";
const DEV_GUARD = "if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {";

// The startup branch is the one that runs license validation. Other
// `process.env.NODE_ENV === 'production'` guards exist in the file
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

describe('apps/server/src/index.ts startup branches', () => {
  it('production startup branch exists (disambiguated by license-validation marker)', () => {
    expect(indexSource).toContain(PROD_GUARD);
    expect(indexSource).toContain(STARTUP_BRANCH_MARKER);
    const body = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);
    expect(body, 'a production guard whose body validates the license must exist').toContain(
      STARTUP_BRANCH_MARKER,
    );
  });

  it('production startup branch binds the HTTP listener via serve()', () => {
    const body = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);
    expect(body, 'production startup branch must call serve(...)').toContain(
      'serve({ fetch: app.fetch, port }',
    );
  });

  it('production startup branch injects the terminal WebSocket so /ws routes attach', () => {
    const body = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);
    expect(
      body,
      'production startup branch must call terminalWs.injectWebSocket(server)',
    ).toContain('terminalWs.injectWebSocket(server)');
  });

  it('production startup branch reads port from API_PORT or PORT with 3004 fallback', () => {
    const body = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);
    expect(body).toContain('process.env.API_PORT || process.env.PORT');
    expect(body).toContain('3004');
  });

  it('production startup branch logs the running listener URL', () => {
    const body = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);
    expect(body).toContain('API server running on http://localhost:');
  });

  it('production and dev startup branches stay shape-equivalent on listener binding', () => {
    // If someone changes one branch's listener shape, the other must follow.
    // Asserts: every literal that appears in the dev branch's serve()/log
    // section also appears in the production startup branch.
    const dev = extractBranchBody(indexSource, DEV_GUARD, STARTUP_BRANCH_MARKER);
    const prod = extractBranchBody(indexSource, PROD_GUARD, STARTUP_BRANCH_MARKER);

    const sharedSignals = [
      'serve({ fetch: app.fetch, port }',
      'terminalWs.injectWebSocket(server)',
      'API server running on http://localhost:',
      'API documentation available at http://localhost:',
      'OpenAPI spec available at http://localhost:',
    ] as const;

    for (const signal of sharedSignals) {
      expect(dev, `dev startup branch should contain ${signal}`).toContain(signal);
      expect(prod, `production startup branch should contain ${signal}`).toContain(signal);
    }
  });
});
