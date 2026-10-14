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
//
// The local bundle must stay inside this file's checkout. A symlink that
// resolves outside that checkout is ignored. CI runs this file from the
// base commit so a pull request cannot point the gate at its own bundle.

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
 * True when `target` is `root` or a path inside it. Both arguments are
 * absolute real paths.
 * @param {string} root
 * @param {string} target
 * @returns {boolean}
 */
function isResolvedInside(root, target) {
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return target === root || target.startsWith(prefix);
}

/**
 * @returns {unknown | null}
 */
function resolveGatesModule() {
  if (fs.existsSync(LOCAL_DIST_CJS)) {
    try {
      const root = fs.realpathSync(path.join(__dirname, '..', '..'));
      const real = fs.realpathSync(LOCAL_DIST_CJS);
      if (isResolvedInside(root, real)) {
        return require(real);
      }
    } catch {
      // Missing or unreadable bundle. Try the install-dir fallback below.
    }
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
  isResolvedInside,
  /** Absolute path of the local CJS gates bundle (for diagnostics). */
  LOCAL_DIST_CJS,
};
