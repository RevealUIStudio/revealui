// Single source of truth for the docs public/internal serving boundary.
//
// FAIL-CLOSED: a doc is served on the public site (docs.revealui.com) only when
// its frontmatter explicitly says `visibility: public`. Anything else — internal,
// a missing visibility field, an unknown value, or no frontmatter at all — is
// withheld. This replaces the previous fail-open hardcoded blocklists (which
// leaked any internal doc that nobody remembered to add to the list).
//
// No authored regex (fleet M2 hardline): a line scan over the frontmatter block.
// Plain .mjs so it can be imported by the Vite plugin and the manifest builder
// (TS) AND run under bare `node` from copy-docs.sh's prune step.

import { basename } from 'node:path';

// Defense-in-depth backstop: these credential-bearing files are NEVER served,
// even if their frontmatter is mis-tagged `visibility: public`.
export const NEVER_SERVE = new Set([
  'SECRETS.md',
  'CREDENTIAL-ROTATION-RUNBOOK.md',
  'DEPLOYMENT-RUNBOOK.md',
]);

/**
 * Read the `visibility` value from a doc's leading YAML frontmatter.
 * Returns the (unquoted) value, or null when there is no frontmatter block or no
 * `visibility` key inside it.
 * @param {string} content
 * @returns {string | null}
 */
export function readVisibility(content) {
  const lines = content.split('\n');
  if ((lines[0] ?? '').trim() !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.trim() === '---') {
      return null; // end of frontmatter, no visibility key
    }
    const idx = line.indexOf(':');
    if (idx > 0 && line.slice(0, idx).trim() === 'visibility') {
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
  return null;
}

/**
 * Fail-closed serving decision: served only when `visibility: public` AND the
 * file is not on the never-serve backstop list.
 * @param {string} relativePath  path of the doc relative to the docs/ root
 * @param {string} content       the doc's full text
 * @returns {boolean}
 */
export function isPubliclyServed(relativePath, content) {
  if (NEVER_SERVE.has(basename(relativePath))) {
    return false;
  }
  return readVisibility(content) === 'public';
}
