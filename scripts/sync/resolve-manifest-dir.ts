/**
 * Resolve the private revvault sync-manifest directory (GAP-265).
 *
 * Prod/staging TOML inventories (vault paths + Vercel project IDs) live in the
 * private coordination repo, not this public tree. Operator machines find them
 * via env or a sibling/.jv checkout. Public CI has no inventory on disk.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const MANIFEST_FILES = {
  vercel: 'revvault-vercel.toml',
  fly: 'revvault-fly.toml',
  staging: 'revvault-vercel-staging.toml',
} as const;

export type ManifestKind = keyof typeof MANIFEST_FILES;

function looksLikeManifestDir(dir: string): boolean {
  return existsSync(resolve(dir, MANIFEST_FILES.vercel));
}

/**
 * Directory that contains revvault-vercel.toml (and siblings), or null when
 * this checkout cannot see the private inventory (typical public CI).
 */
export function resolveManifestDir(): string | null {
  const fromEnv = process.env.REVEALUI_SYNC_MANIFEST_DIR?.trim();
  if (fromEnv && looksLikeManifestDir(fromEnv)) {
    return resolve(fromEnv);
  }

  const jv = process.env.JV_REPO?.trim();
  if (jv) {
    const candidate = resolve(jv, 'ops/sync');
    if (looksLikeManifestDir(candidate)) return candidate;
  }

  const candidates = [
    resolve(HERE, '../../../../.jv/ops/sync'),
    resolve(HERE, '../../../.jv/ops/sync'),
    resolve(homedir(), 'revfleet/.jv/ops/sync'),
  ];
  for (const dir of candidates) {
    if (looksLikeManifestDir(dir)) return dir;
  }
  return null;
}

export function resolveManifestPath(kind: ManifestKind): string | null {
  const dir = resolveManifestDir();
  if (!dir) return null;
  const file = resolve(dir, MANIFEST_FILES[kind]);
  return existsSync(file) ? file : null;
}

export function requireManifestPath(kind: ManifestKind): string {
  const path = resolveManifestPath(kind);
  if (path) return path;
  throw new Error(
    `Private sync manifest "${MANIFEST_FILES[kind]}" not found. ` +
      'Set REVEALUI_SYNC_MANIFEST_DIR to the coordination-repo ops/sync directory ' +
      '(or clone that repo as a sibling / set JV_REPO).',
  );
}
