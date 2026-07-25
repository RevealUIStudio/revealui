'use strict';
// gates-resolver.cjs — locate the @revealui/harnesses gates module (GAP-408
// control-layer redesign). Shared by guardrail2-verdict.cjs and
// doc-currency.ts so the resolution logic lives in exactly one place.
//
// Resolution order:
//   1. Local monorepo dist (packages/harnesses/dist/gates/index.js) — the
//      normal path whenever the package has been built in this checkout
//      (pnpm gate, or any CI job that runs `pnpm --filter @revealui/harnesses
//      build` first).
//   2. REVEALUI_HARNESSES_DIR — a directory containing an npm install of
//      @revealui/harnesses (`npm install --prefix <dir> @revealui/harnesses@<pin>`).
//      This is the path for CI jobs that only sparse-checkout a handful of
//      gate scripts and never clone packages/harnesses at all (e.g. the
//      pull_request_target security-review-gate.yml job).
//
// Loaded by a same-repo/filesystem RELATIVE path or an explicit installed
// package directory — never the bare `@revealui/harnesses` specifier resolved
// from THIS repo's own node_modules, which would require a package.json
// dependency edge that scripts/validate/boundary.ts Check 4 forbids
// (@revealui/harnesses is an optional Fair Source package).
//
// Returns null (never throws) when nothing resolves — callers decide the
// fail-open/fail-closed posture for their own gate.

const fs = require('node:fs');
const path = require('node:path');

const LOCAL_DIST_PATH = path.join(
  __dirname,
  '..',
  '..',
  'packages',
  'harnesses',
  'dist',
  'gates',
  'index.js',
);

/**
 * @returns {unknown | null}
 */
function resolveGatesModule() {
  if (fs.existsSync(LOCAL_DIST_PATH)) {
    return require(LOCAL_DIST_PATH);
  }

  const installDir = process.env.REVEALUI_HARNESSES_DIR;
  if (installDir) {
    try {
      const resolved = require.resolve('@revealui/harnesses/gates', { paths: [installDir] });
      return require(resolved);
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = { resolveGatesModule, LOCAL_DIST_PATH };
