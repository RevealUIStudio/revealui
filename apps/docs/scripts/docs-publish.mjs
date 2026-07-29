// Docs publish plane — single module for "what is publicly served".
//
// SoT: monorepo docs/ only. Never materialize a second authoring-shaped tree
// under apps/docs/public/. Dev serves via Vite middleware; production emit
// writes into the Vite outDir (dist/) only.
//
// Plain .mjs so copy-docs cleanup, Vite plugin, check-links, and tests share
// one implementation. Fail-closed visibility: see served-docs.mjs.

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPubliclyServed } from './served-docs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root (…/revealui). */
export function repoRootFromDocsApp(docsAppRoot = path.resolve(__dirname, '..')) {
  return path.resolve(docsAppRoot, '../..');
}

/** Absolute path to monorepo docs/. */
export function docsSourceDir(docsAppRoot = path.resolve(__dirname, '..')) {
  return path.join(repoRootFromDocsApp(docsAppRoot), 'docs');
}

/** Hand-authored public exceptions (tracked under apps/docs/public/). */
export const HAND_AUTHORED_PUBLIC_SUBDIRS = new Set(['docs-pro']);

/** Directory names never walked under docs/. */
export const IGNORED_DOC_DIRS = new Set(['node_modules', '.next', 'dist', 'archive']);

/**
 * @param {string} docsSource absolute monorepo docs/
 * @returns {AsyncGenerator<{ rel: string, abs: string, content: string }>}
 */
export async function* walkPublicDocs(docsSource) {
  async function* walk(dir, prefix) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (IGNORED_DOC_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        yield* walk(abs, rel);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!(entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) continue;
      let content;
      try {
        content = await readFile(abs, 'utf8');
      } catch {
        continue;
      }
      if (!isPubliclyServed(rel, content)) continue;
      yield { rel: rel.split(path.sep).join('/'), abs, content };
    }
  }
  yield* walk(docsSource, '');
}

/**
 * Collect POSIX-relative paths of publicly served docs (from monorepo docs/).
 * @param {string} docsSource
 * @returns {Promise<Set<string>>}
 */
export async function collectPublicDocRels(docsSource) {
  const set = new Set();
  for await (const { rel } of walkPublicDocs(docsSource)) {
    set.add(rel);
  }
  return set;
}

/**
 * Resolve a URL path (e.g. `/ADMIN_GUIDE.md` or `blog/01.md`) to a public doc.
 * Returns null when missing, path-escapes, or not visibility:public.
 * @param {string} docsSource
 * @param {string} urlPath
 * @returns {Promise<{ rel: string, content: string } | null>}
 */
export async function resolvePublicDoc(docsSource, urlPath) {
  let raw = urlPath.split('?')[0] ?? '';
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (raw.startsWith('/')) raw = raw.slice(1);
  if (!raw || raw.includes('\0')) return null;
  // Only markdown fetches are owned by the publish plane.
  if (!(raw.endsWith('.md') || raw.endsWith('.mdx'))) return null;

  const abs = path.resolve(docsSource, raw);
  const relToSource = path.relative(docsSource, abs);
  if (relToSource.startsWith('..') || path.isAbsolute(relToSource)) return null;
  if (relToSource.split(path.sep).some((p) => p === '..' || p.startsWith('.'))) {
    // allow .md filenames but not .hidden dirs; parts starting with . already skipped in walk
  }
  const parts = relToSource.split(path.sep);
  if (parts.some((p) => p === '..')) return null;
  if (parts.some((p) => IGNORED_DOC_DIRS.has(p))) return null;

  let content;
  try {
    content = await readFile(abs, 'utf8');
  } catch {
    return null;
  }
  const rel = relToSource.split(path.sep).join('/');
  if (!isPubliclyServed(rel, content)) return null;
  return { rel, content };
}

/**
 * Remove generated markdown that was previously copied into public/ from docs/.
 * Leaves hand-authored docs-pro and non-markdown static assets alone.
 * @param {string} publicDir apps/docs/public
 * @param {string} docsSource monorepo docs/
 */
export async function cleanGeneratedPublicMirror(publicDir, docsSource) {
  let removed = 0;

  async function walk(dir) {
    let names;
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      let st;
      try {
        st = await stat(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        const rel = path.relative(publicDir, full).split(path.sep).join('/');
        const first = rel.split('/')[0] ?? '';
        if (HAND_AUTHORED_PUBLIC_SUBDIRS.has(first)) continue;
        await walk(full);
        // drop empty generated dirs (best-effort)
        try {
          const left = await readdir(full);
          if (left.length === 0) await rm(full, { recursive: true, force: true });
        } catch {
          // ignore
        }
        continue;
      }
      if (!(name.endsWith('.md') || name.endsWith('.mdx'))) continue;
      const rel = path.relative(publicDir, full).split(path.sep).join('/');
      const first = rel.split('/')[0] ?? '';
      if (HAND_AUTHORED_PUBLIC_SUBDIRS.has(first)) continue;
      // Only remove if it mirrors a monorepo docs/ path (or leftover copy).
      // Top-level generated copies always come from docs/ — safe to delete.
      try {
        await rm(full, { force: true });
        removed += 1;
      } catch {
        // ignore
      }
    }
  }

  await walk(publicDir);
  return removed;
}

/**
 * Emit publicly served markdown into a build output directory (dist/).
 * @param {string} docsSource
 * @param {string} outDir absolute path to Vite outDir
 * @returns {Promise<number>} files written
 */
export async function emitPublicDocsToDir(docsSource, outDir) {
  let count = 0;
  for await (const { rel, content } of walkPublicDocs(docsSource)) {
    const dest = path.join(outDir, ...rel.split('/'));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, content, 'utf8');
    count += 1;
  }
  return count;
}
