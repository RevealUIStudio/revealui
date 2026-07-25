'use strict';
// manager-resolver.cjs — locate the @revealui/harnesses manager module
// (GAP-421 §6.2). Mirrors gates-resolver.cjs's resolution pattern: load the
// built dist through a same-repo relative path, never the bare
// `@revealui/harnesses` specifier (which would require a package.json
// dependency edge that scripts/validate/boundary.ts Check 4 forbids for an
// optional Fair Source package).
//
// Unlike gates-resolver.cjs, this resolver has no REVEALUI_HARNESSES_DIR
// fallback: `manager` has exactly one consumer (structure.ts, in this same
// checkout), so the local dist path is the only resolution route that
// matters today.
//
// Returns null (never throws) when the dist has not been built — the caller
// decides how to degrade. structure.ts treats a null resolution as fail
// closed, matching the GAP-406 hard-fail posture for a missing/invalid
// manager.json (a silently-skipped manager check is the same class of miss
// as a silently-skipped guardrail-2 hold).

const fs = require('node:fs');
const path = require('node:path');

const LOCAL_DIST_PATH = path.join(
  __dirname,
  '..',
  '..',
  'packages',
  'harnesses',
  'dist',
  'manager',
  'index.js',
);

/**
 * @returns {unknown | null}
 */
function resolveManagerModule() {
  if (fs.existsSync(LOCAL_DIST_PATH)) {
    return require(LOCAL_DIST_PATH);
  }

  return null;
}

module.exports = { resolveManagerModule, LOCAL_DIST_PATH };
