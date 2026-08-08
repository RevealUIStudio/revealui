'use strict';
// gates-resolver.cjs — locate the @revealui/harnesses gates module (GAP-408).
// Shared by guardrail2-verdict.cjs, security-review-gate, and archive-check.
//
// Resolution order:
//   1. packages/harnesses/dist/gates/index.cjs — the only supported local path.
//      CommonJS is required: the package is "type":"module", so require() of
//      a .js gates bundle is not a supported contract.
//   2. REVEALUI_HARNESSES_DIR — npm install prefix of @revealui/harnesses
//      (require.resolve('@revealui/harnesses/gates')).
//
// Build contract for (1): `pnpm --filter @revealui/harnesses exec tsup --config
// tsup.gates-cjs.ts` (or full package build, which runs that config second).
// Sparse CI must never run full package DTS (needs @revealui/security).
//
// Returns null (never throws) when nothing resolves.

const fs = require('node:fs');
const path = require('node:path');

const LOCAL_DIST_CJS = path.join(
  __dirname,
  '..',
  '..',
  'packages',
  'harnesses',
  'dist',
  'gates',
  'index.cjs',
);

/**
 * @returns {unknown | null}
 */
function resolveGatesModule() {
  if (fs.existsSync(LOCAL_DIST_CJS)) {
    return require(LOCAL_DIST_CJS);
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

module.exports = {
  resolveGatesModule,
  /** Absolute path of the local CJS gates bundle (for diagnostics). */
  LOCAL_DIST_CJS,
};
