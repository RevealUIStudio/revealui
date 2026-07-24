/**
 * GAP-260 P2-2: public-only license consumers must not mint.
 *
 * `with-secrets:license` loads revealui/env/license (public SPKI only).
 * Mint/sign call sites must use with-secrets:license-signing (private) or
 * production env that intentionally holds REVEALUI_LICENSE_PRIVATE_KEY.
 *
 * Mechanical: any file that documents `with-secrets license` (not
 * license-signing) must not also call generateLicenseKey.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git' || name === 'coverage') {
      continue;
    }
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (
      name.endsWith('.ts') ||
      name.endsWith('.tsx') ||
      name.endsWith('.md') ||
      name.endsWith('.sh')
    ) {
      out.push(p);
    }
  }
  return out;
}

describe('GAP-260 P2-2 public-only mint boundary', () => {
  it('no file both invokes with-secrets license (public) and generateLicenseKey', () => {
    const files = walk(REPO_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      // Skip this test file and the with-secrets definition itself.
      const rel = relative(REPO_ROOT, file);
      if (rel.includes('license-public-only-mint-boundary')) continue;
      if (rel.includes('45-with-secrets')) continue;
      const text = readFileSync(file, 'utf8');
      // Match public license namespace only — not "license-signing".
      const usesPublicLicenseNs =
        text.includes('with-secrets license ') ||
        text.includes('with-secrets license\n') ||
        text.includes('with-secrets license --') ||
        text.includes("with-secrets:license'") ||
        text.includes('with-secrets:license"') ||
        text.includes("consumers: ['with-secrets:license']") ||
        text.includes('consumers: ["with-secrets:license"]');
      // Narrow: "with-secrets license" as a command word (not license-signing)
      const cmdPublic =
        text.includes('with-secrets license --') ||
        text.includes('with-secrets license\n') ||
        (text.includes('with-secrets license') && !text.includes('license-signing'));
      if (!(usesPublicLicenseNs || cmdPublic)) continue;
      if (text.includes('generateLicenseKey')) {
        // Allow SECRET_PATHS / SECRETS docs that mention both as narrative.
        if (rel.startsWith('docs/') || rel.includes('secret-paths.ts')) continue;
        offenders.push(rel);
      }
    }
    expect(offenders, `public-only + mint offenders: ${offenders.join(', ')}`).toEqual([]);
  });
});
