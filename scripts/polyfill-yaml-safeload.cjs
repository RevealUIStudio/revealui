/**
 * Polyfill js-yaml safeLoad/safeDump for @changesets/cli → read-yaml-file@1.x.
 *
 * Fleet pnpm overrides pin js-yaml@5 for security floors. js-yaml 4+ removed
 * safeLoad (use load). read-yaml-file@1.1.0 still calls yaml.safeLoad, so
 * `pnpm changeset status|version|publish` dies in CI and local.
 *
 * Load with: node --require ./scripts/polyfill-yaml-safeload.cjs …
 *
 * Prefer this over pinning js-yaml@3 (blocked by dependency-review CVEs).
 */
'use strict';

const Module = require('node:module');
const path = require('node:path');

const originalRequire = Module.prototype.require;

function isJsYamlId(id) {
  if (id === 'js-yaml') return true;
  if (typeof id !== 'string') return false;
  // Absolute path into a js-yaml package (pnpm layout)
  return (
    id.endsWith(`${path.sep}js-yaml${path.sep}index.js`) ||
    id.endsWith(`${path.sep}js-yaml${path.sep}dist${path.sep}index.js`) ||
    /[/\\]js-yaml[/\\]index\.js$/.test(id)
  );
}

function patchYaml(yaml) {
  if (!yaml || typeof yaml !== 'object') return;
  if (typeof yaml.safeLoad !== 'function' && typeof yaml.load === 'function') {
    yaml.safeLoad = yaml.load.bind(yaml);
  }
  if (typeof yaml.safeDump !== 'function' && typeof yaml.dump === 'function') {
    yaml.safeDump = yaml.dump.bind(yaml);
  }
}

Module.prototype.require = function patchedRequire(id) {
  const exported = originalRequire.apply(this, arguments);
  if (isJsYamlId(id)) {
    patchYaml(exported);
  }
  return exported;
};

// Patch already-cached js-yaml copies (if any loaded before this file).
for (const key of Object.keys(require.cache)) {
  if (isJsYamlId(key) || key.includes(`${path.sep}js-yaml${path.sep}`)) {
    try {
      patchYaml(require.cache[key].exports);
    } catch {
      /* ignore */
    }
  }
}
