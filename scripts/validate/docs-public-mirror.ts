/**
 * Fail when leftover generated markdown sits under apps/docs/public/
 * (ADR 2026-07-29 virtual serve — monorepo docs/ is the only authoring SoT).
 *
 * Hand-authored exception: apps/docs/public/docs-pro/
 *
 * Fix: pnpm --filter docs clean:public-mirror
 * Or:  node apps/docs/scripts/clean-public-mirror.mjs
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const publicDir = join(repoRoot, 'apps/docs/public');

function collectLeftoverMd(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === 'docs-pro') continue;
      collectLeftoverMd(full, acc);
    } else if (st.isFile() && name.endsWith('.md')) {
      acc.push(relative(publicDir, full));
    }
  }
  return acc;
}

const leftovers = collectLeftoverMd(publicDir);
if (leftovers.length > 0) {
  console.error(
    `[docs-public-mirror] ${leftovers.length} leftover generated .md file(s) under apps/docs/public/ (not docs-pro).\n` +
      'ADR 2026-07-29: do not materialize monorepo docs/ into public/*.md.\n' +
      'Run: pnpm --filter docs clean:public-mirror\n\n' +
      leftovers
        .slice(0, 40)
        .map((p) => `  - ${p}`)
        .join('\n') +
      (leftovers.length > 40 ? `\n  ... and ${leftovers.length - 40} more` : ''),
  );
  process.exit(1);
}

console.log('[docs-public-mirror] OK — no leftover generated public markdown.');
