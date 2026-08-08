'use strict';
// gates-resolver.cjs — locate the @revealui/harnesses gates module (GAP-408
// control-layer redesign). Shared by guardrail2-verdict.cjs and
// doc-currency.ts so the resolution logic lives in exactly one place.
//
// Resolution order:
//   1. Local monorepo dist — prefer index.cjs (CommonJS; works under
//      package.json "type":"module"). Fall back to index.js for older builds.
//      Prefer cjs so gate-only CI (tsup.gates-cjs / build:gates) does not need
//      a broken cjs→js copy under type:module (ReferenceError: module is not
//      defined).
//   2. REVEALUI_HARNESSES_DIR — a directory containing an npm install of
//      @revealui/harnesses (`npm install --prefix <dir> @revealui/harnesses@<pin>`).
//
// Loaded by a same-repo/filesystem RELATIVE path or an explicit installed
// package directory — never the bare `@revealui/harnesses` specifier resolved
// from THIS repo's own node_modules (boundary Check 4).
//
// Returns null (never throws) when nothing resolves — callers decide the
// fail-open/fail-closed posture for their own gate.

const fs = require('node:fs');
const path = require('node:path');

const LOCAL_GATES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'packages',
  'harnesses',
  'dist',
  'gates',
);

const LOCAL_DIST_CJS = path.join(LOCAL_GATES_DIR, 'index.cjs');
const LOCAL_DIST_JS = path.join(LOCAL_GATES_DIR, 'index.js');
/** @deprecated use LOCAL_DIST_CJS; kept for callers that read the export */
const LOCAL_DIST_PATH = LOCAL_DIST_CJS;

/**
 * @returns {unknown | null}
 */
function resolveGatesModule() {
  if (fs.existsSync(LOCAL_DIST_CJS)) {
    return require(LOCAL_DIST_CJS);
  }
  if (fs.existsSync(LOCAL_DIST_JS)) {
    return require(LOCAL_DIST_JS);
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

module.exports = { resolveGatesModule, LOCAL_DIST_PATH, LOCAL_DIST_CJS, LOCAL_DIST_JS };
