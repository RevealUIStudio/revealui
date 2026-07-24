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

/**
 * One Vercel project block from the sync manifest (slug + project_id + skip + vars).
 * Used by the scheduled name-diff drift check (GAP-258 P0-8): live env NAMES from
 * the Vercel API vs declared vars — no vault decrypt, no secret values.
 */
export interface VercelProjectSpec {
  slug: string;
  projectId: string;
  /** Env names intentionally not managed by revvault (never orphans). */
  skip: readonly string[];
  /** Declared var name → vault path. */
  vars: ReadonlyMap<string, string>;
}

/**
 * Parse `[projects.<slug>]` blocks for Vercel name-diff classification.
 * Projects without a usable `project_id` string are skipped (fail soft for that block).
 */
export function collectVercelProjects(tomlText: string): VercelProjectSpec[] {
  const parsed = parseToml(tomlText) as Record<string, unknown>;
  const container = parsed.projects;
  if (container === undefined || container === null || typeof container !== 'object') return [];
  const out: VercelProjectSpec[] = [];
  for (const [slug, block] of Object.entries(container as Record<string, unknown>)) {
    if (block === null || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (typeof b.project_id !== 'string' || b.project_id.length === 0) continue;
    const skip: string[] = [];
    if (Array.isArray(b.skip)) {
      for (const s of b.skip) {
        if (typeof s === 'string' && s.length > 0) skip.push(s);
      }
    }
    const vars = new Map<string, string>();
    if (b.vars !== undefined && b.vars !== null && typeof b.vars === 'object') {
      for (const [name, value] of Object.entries(b.vars as Record<string, unknown>)) {
        const parsedVar = readVarPath(value);
        if (parsedVar === null) continue;
        vars.set(name, parsedVar.path);
      }
    }
    out.push({ slug, projectId: b.project_id, skip, vars });
  }
  return out;
}
