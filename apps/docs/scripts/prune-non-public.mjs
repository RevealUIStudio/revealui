#!/usr/bin/env node
// Remove copied internal docs from the public docs tree, enforcing the
// fail-closed visibility boundary (see ./served-docs.mjs).
//
// SCOPED to docs that were COPIED from the docs/ source: a public/ markdown file
// is pruned only when the same relative path exists in docs/ AND is not
// `visibility: public`. Files that live ONLY in public/ — hand-maintained
// tracked content such as public/docs-pro/, plus every non-markdown asset — are
// never touched. (The visibility frontmatter is the source of truth; we read it
// from docs/, which the public copy mirrors verbatim.)
//
// Usage: node prune-non-public.mjs <publicDir> <docsSource>

import { readFile, readdir, rm, rmdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { isPubliclyServed } from './served-docs.mjs';

const publicDir = process.argv[2];
const docsSource = process.argv[3];
if (!publicDir || !docsSource) {
  process.stderr.write('prune-non-public: usage: prune-non-public.mjs <publicDir> <docsSource>\n');
  process.exit(1);
}

let removed = 0;

async function walk(dir) {
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) {
      await walk(full);
      try {
        if ((await readdir(full)).length === 0) {
          await rmdir(full);
        }
      } catch {
        // non-empty or already gone — leave it
      }
      continue;
    }
    if (!(name.endsWith('.md') || name.endsWith('.mdx'))) {
      continue; // never touch non-markdown assets
    }
    const rel = relative(publicDir, full);
    let sourceContent;
    try {
      sourceContent = await readFile(join(docsSource, rel), 'utf8');
    } catch {
      continue; // public-only file (not copied from docs/) — leave it
    }
    if (!isPubliclyServed(rel, sourceContent)) {
      await rm(full);
      removed += 1;
    }
  }
}

await walk(publicDir);
process.stdout.write(`   Visibility prune: removed ${removed} non-public doc(s).\n`);
