/**
 * Importable sync-manifest parser. Extracted from secret-paths-lockstep.test.ts
 * (P0-2) so the lockstep test AND the live-drift checker (secret-path-drift.ts,
 * P0-8) share ONE vault-path ↔ env-var-name mapping instead of two copies.
 *
 * A manifest maps, per project/app, a Vercel/Fly env-var NAME (the TOML key) to
 * a canonical revvault PATH (the value: a bare string, or an inline table with
 * `path`/`sensitive`). Zero network, zero secret values — path metadata only.
 */

import { parse as parseToml } from 'smol-toml';
import type { ManifestVar } from './secret-paths.js';

/** A manifest var value is either a bare path string or an inline table with `path`/`sensitive`. */
export function readVarPath(value: unknown): { path: string; sensitive: boolean } | null {
  if (typeof value === 'string') return { path: value, sensitive: false };
  if (value !== null && typeof value === 'object' && 'path' in value) {
    const obj = value as { path: unknown; sensitive?: unknown };
    if (typeof obj.path === 'string') {
      return { path: obj.path, sensitive: obj.sensitive === true };
    }
  }
  return null;
}

/**
 * Collect every synced var from a manifest's app/project blocks under `containerKey`
 * (`projects` for Vercel, `fly-apps` for Fly). `source` on each result is
 * `<sourceLabel>:<slug>` so a caller can group by project/app.
 */
export function collectVars(
  tomlText: string,
  containerKey: string,
  sourceLabel: string,
): ManifestVar[] {
  const parsed = parseToml(tomlText) as Record<string, unknown>;
  const container = parsed[containerKey];
  if (container === undefined || container === null || typeof container !== 'object') return [];
  const out: ManifestVar[] = [];
  for (const [slug, block] of Object.entries(container as Record<string, unknown>)) {
    if (block === null || typeof block !== 'object') continue;
    const vars = (block as Record<string, unknown>).vars;
    if (vars === undefined || vars === null || typeof vars !== 'object') continue;
    for (const [name, value] of Object.entries(vars as Record<string, unknown>)) {
      const parsedVar = readVarPath(value);
      if (parsedVar === null) continue;
      out.push({
        name,
        path: parsedVar.path,
        sensitive: parsedVar.sensitive,
        source: `${sourceLabel}:${slug}`,
      });
    }
  }
  return out;
}
