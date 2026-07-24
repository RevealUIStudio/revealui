/**
 * Secret-path LIVE-drift checker (read-only).
 *
 * Two input modes (both never print secret VALUES):
 *
 * 1. **revvault sync JSONL** (`--vercel-json`) — full Orphan/Add/DropShape from a
 *    local `revvault sync vercel --json` capture (owner machine; needs age identity).
 * 2. **Vercel name-diff** (`--live-vercel` or `--vercel-names-json`) — orphan/missing
 *    only, from env-var NAMES listed by the Vercel API (or a fixture). This is the
 *    CI-safe path for GAP-258 P0-8: no vault decrypt, no age identity in Actions.
 *    Shape-violation stays a local/owner check.
 *
 * Classification vs the lockstep-guaranteed manifest (`parse-manifests.ts`):
 *
 *   • orphan          — live but NOT in the manifest vars (or revvault Orphan)
 *   • missing         — in the manifest vars but absent live (or revvault Add)
 *   • shape-violation — revvault DropShape only (not available in name-diff mode)
 *
 * KNOWN, already-tracked drift is allow-listed (surfaced as KNOWN, does not fail
 * the run); any NEW drift fails the run so it is triaged before it compounds —
 * the doc-currency-baseline pattern.
 *
 * Scheduled workflow: `.github/workflows/secret-path-drift.yml` (no-op if
 * `VERCEL_TOKEN` unset).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectVars, collectVercelProjects, type VercelProjectSpec } from './parse-manifests.js';
import { DECLARED_PATHS } from './secret-paths.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERCEL_MANIFEST = resolve(HERE, 'revvault-vercel.toml');
const FLY_MANIFEST = resolve(HERE, 'revvault-fly.toml');
// Separate staging manifest (GAP-343 Phase 3) - project slugs already
// disambiguate (e.g. "vercel:revealui-api-staging"), so it shares the same
// 'vercel' sourceLabel as the prod manifest rather than inventing a new one.
const STAGING_MANIFEST = resolve(HERE, 'revvault-vercel-staging.toml');

export type DriftCategory = 'orphan' | 'missing' | 'shape-violation';

export interface DriftFinding {
  surface: string; // "vercel:<project>" | "fly:<app>"
  key: string; // env-var name
  category: DriftCategory;
  reason: string | null;
  path?: string; // vault path, when the var is known to the manifest
}

// ── revvault sync --json shapes (mirrors DiffAction in revvault sync.rs) ──────
interface DiffEntry {
  key: string;
  action: string; // Add | Update | Match | Orphan | Skip | DropShape
  reason: string | null;
}
interface DiffDoc {
  diff: DiffEntry[];
  project: string;
}

/** revvault DiffAction → our drift category (Match/Update/Skip are in-sync, no finding). */
const ACTION_TO_CATEGORY: Record<string, DriftCategory | undefined> = {
  Orphan: 'orphan',
  Add: 'missing',
  DropShape: 'shape-violation',
};

/**
 * Already-tracked drift. Surfaced as KNOWN (not a run failure). Keyed
 * "<surface>:<key>:<category>". Neutral descriptions only — this is the PUBLIC
 * repo; the private tracking references live in the coordination repo.
 */
export const KNOWN_DRIFT: Record<string, string> = {
  'vercel:revealui-api:REVEALUI_BUNDLE_PRO:orphan':
    'Vercel-only bundle flag; vault reconciliation tracked internally',
  'vercel:revealui-admin:REVEALUI_SIGNUP_OPEN:orphan':
    'Vercel-only signup flag; vault reconciliation tracked internally',
  'vercel:revealui-api:ELECTRIC_SECRET:shape-violation':
    'known ElectricSQL empty-secret residue; remediation tracked internally',
  'vercel:revealui-admin:ELECTRIC_SECRET:shape-violation':
    'known ElectricSQL empty-secret residue; remediation tracked internally',
  'vercel:revealui-api:ELECTRIC_SERVICE_URL:shape-violation':
    'known ElectricSQL ciphertext-envelope residue; remediation tracked internally',
  'vercel:revealui-admin:ELECTRIC_SERVICE_URL:shape-violation':
    'known ElectricSQL ciphertext-envelope residue; remediation tracked internally',
};

export function knownKey(f: DriftFinding): string {
  return `${f.surface}:${f.key}:${f.category}`;
}

/** Parse the JSONL emitted by `revvault sync ... --json` (one DiffDoc per line). */
export function parseSyncDiffJsonl(text: string): DiffDoc[] {
  const docs: DiffDoc[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed[0] !== '{') continue; // skip shell/banner noise
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (
      obj !== null &&
      typeof obj === 'object' &&
      Array.isArray((obj as DiffDoc).diff) &&
      typeof (obj as DiffDoc).project === 'string'
    ) {
      docs.push(obj as DiffDoc);
    }
  }
  return docs;
}

/** Build "vercel:<project>" / "fly:<app>" → (env-var name → vault path). */
function manifestNamePathIndex(): Map<string, Map<string, string>> {
  const index = new Map<string, Map<string, string>>();
  const add = (tomlPath: string, containerKey: string, label: string) => {
    for (const v of collectVars(readFileSync(tomlPath, 'utf8'), containerKey, label)) {
      if (!index.has(v.source)) index.set(v.source, new Map());
      index.get(v.source)?.set(v.name, v.path);
    }
  };
  add(VERCEL_MANIFEST, 'projects', 'vercel');
  add(FLY_MANIFEST, 'fly-apps', 'fly');
  add(STAGING_MANIFEST, 'projects', 'vercel');
  return index;
}

/** Classify a set of parsed Vercel diff docs into drift findings. */
export function classifyVercelDrift(
  docs: DiffDoc[],
  nameToPath: Map<string, Map<string, string>>,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  for (const doc of docs) {
    const surface = `vercel:${doc.project}`;
    const projMap = nameToPath.get(surface);
    for (const entry of doc.diff) {
      const category = ACTION_TO_CATEGORY[entry.action];
      if (!category) continue;
      findings.push({
        surface,
        key: entry.key,
        category,
        reason: entry.reason,
        path: projMap?.get(entry.key),
      });
    }
  }
  return findings;
}

/**
 * Name-only classification (CI path): live env keys vs declared manifest vars.
 * `skip` names are never orphans (intentionally Vercel-direct / platform-managed).
 * No shape-violation — values are never fetched.
 */
export function classifyVercelNameDrift(
  projects: readonly VercelProjectSpec[],
  liveNamesBySlug: ReadonlyMap<string, readonly string[]>,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  for (const proj of projects) {
    const surface = `vercel:${proj.slug}`;
    const live = new Set(liveNamesBySlug.get(proj.slug) ?? []);
    const skip = new Set(proj.skip);
    for (const name of live) {
      if (skip.has(name)) continue;
      if (!proj.vars.has(name)) {
        findings.push({
          surface,
          key: name,
          category: 'orphan',
          reason: 'live on Vercel, not in manifest vars',
        });
      }
    }
    for (const [name, path] of proj.vars) {
      if (!live.has(name)) {
        findings.push({
          surface,
          key: name,
          category: 'missing',
          reason: 'in manifest vars, absent on Vercel (production target)',
          path,
        });
      }
    }
  }
  return findings;
}

/** Fixture / offline shape for `--vercel-names-json`. */
export interface VercelNamesDoc {
  projects: Array<{ project: string; names: string[] }>;
}

export function parseVercelNamesJson(text: string): Map<string, string[]> {
  const obj = JSON.parse(text) as VercelNamesDoc;
  const map = new Map<string, string[]>();
  if (!(obj && Array.isArray(obj.projects))) {
    throw new Error('vercel-names-json: expected { projects: [{ project, names }] }');
  }
  for (const p of obj.projects) {
    if (typeof p.project !== 'string' || !Array.isArray(p.names)) continue;
    map.set(
      p.project,
      p.names.filter((n): n is string => typeof n === 'string' && n.length > 0),
    );
  }
  return map;
}

/**
 * Fetch production env-var NAMES for a Vercel project (no values used).
 * Uses the public list endpoint; decrypt is never requested.
 */
export async function fetchVercelProductionEnvNames(
  token: string,
  projectId: string,
): Promise<string[]> {
  const names = new Set<string>();
  let url: string | null =
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?limit=100`;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Vercel env list failed for ${projectId}: HTTP ${res.status} ${body.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      envs?: Array<{ key?: string; target?: string[] | string }>;
      pagination?: { next?: number | null };
    };
    for (const env of data.envs ?? []) {
      if (typeof env.key !== 'string' || env.key.length === 0) continue;
      const targets = Array.isArray(env.target)
        ? env.target
        : typeof env.target === 'string'
          ? [env.target]
          : [];
      // Name-diff CI scopes to production (manifest targets = production-only).
      if (targets.length === 0 || targets.includes('production')) {
        names.add(env.key);
      }
    }
    // Vercel pagination: next is a timestamp cursor when more pages exist.
    const next = data.pagination?.next;
    if (typeof next === 'number' && next > 0) {
      url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?limit=100&until=${next}`;
    } else {
      url = null;
    }
  }
  return [...names].sort();
}

interface FlySecret {
  Name?: string;
}

/**
 * Fly has no shape info from `flyctl secrets list --json` (name + digest only),
 * so only orphan (live-not-in-spec) and missing (spec-not-live) are derivable.
 */
export function classifyFlyDrift(
  liveNames: string[],
  nameToPath: Map<string, Map<string, string>>,
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const live = new Set(liveNames);
  // The Fly manifest declares exactly one app block; collapse all fly:* sources.
  const expected = new Map<string, string>();
  for (const [source, m] of nameToPath) {
    if (source.startsWith('fly:')) for (const [n, p] of m) expected.set(n, p);
  }
  for (const name of live) {
    if (!expected.has(name)) {
      findings.push({
        surface: 'fly:worker',
        key: name,
        category: 'orphan',
        reason: 'live on Fly, not in spec',
      });
    }
  }
  for (const [name, path] of expected) {
    if (!live.has(name)) {
      findings.push({
        surface: 'fly:worker',
        key: name,
        category: 'missing',
        reason: 'in spec, absent on Fly',
        path,
      });
    }
  }
  return findings;
}

/** Split findings into new (fail) vs known (allow-listed, informational). */
export function partitionFindings(findings: DriftFinding[]): {
  fresh: DriftFinding[];
  known: DriftFinding[];
} {
  const fresh: DriftFinding[] = [];
  const known: DriftFinding[] = [];
  for (const f of findings) {
    if (knownKey(f) in KNOWN_DRIFT) known.push(f);
    else fresh.push(f);
  }
  return { fresh, known };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

function reportAndExit(findings: DriftFinding[], projectsScanned: number, mode: string): void {
  const undeclared = findings.filter((f) => f.path !== undefined && !DECLARED_PATHS.has(f.path));
  const { fresh, known } = partitionFindings(findings);

  process.stdout.write('── secret-path live-drift check (read-only) ──\n');
  process.stdout.write(`mode: ${mode}\n`);
  process.stdout.write(`vercel projects scanned: ${projectsScanned}\n\n`);

  if (known.length > 0) {
    process.stdout.write(`KNOWN drift (${known.length}, tracked — not failing):\n`);
    for (const f of known) {
      process.stdout.write(
        `  [${f.category}] ${f.surface} ${f.key} — ${KNOWN_DRIFT[knownKey(f)]}\n`,
      );
    }
    process.stdout.write('\n');
  }

  if (fresh.length === 0 && undeclared.length === 0) {
    process.stdout.write('NEW drift: none. ✓\n');
    process.exit(0);
  }

  if (fresh.length > 0) {
    process.stdout.write(`NEW drift (${fresh.length}) — triage before it compounds:\n`);
    for (const f of fresh) {
      const p = f.path ? ` (${f.path})` : '';
      process.stdout.write(
        `  [${f.category}] ${f.surface} ${f.key}${p}${f.reason ? ` — ${f.reason}` : ''}\n`,
      );
    }
  }
  if (undeclared.length > 0) {
    process.stdout.write(
      `SPEC MISMATCH (${undeclared.length}) — manifest path not in SECRET_PATHS:\n`,
    );
    for (const f of undeclared) process.stdout.write(`  ${f.surface} ${f.key} → ${f.path}\n`);
  }
  process.exit(1);
}

async function runLiveVercel(): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token || token.length === 0) {
    process.stdout.write('VERCEL_TOKEN not set; skipping live Vercel name-diff (no-op pass).\n');
    process.exit(0);
  }
  const projects = collectVercelProjects(readFileSync(VERCEL_MANIFEST, 'utf8'));
  if (projects.length === 0) {
    process.stderr.write('secret-path-drift: no projects with project_id in prod manifest\n');
    process.exit(2);
  }
  // De-dupe by projectId (staging reuses prod IDs in a separate manifest).
  const byId = new Map<string, VercelProjectSpec>();
  for (const p of projects) {
    if (!byId.has(p.projectId)) byId.set(p.projectId, p);
  }
  const unique = [...byId.values()];
  const liveNamesBySlug = new Map<string, string[]>();
  for (const p of unique) {
    process.stdout.write(`fetching production env names: ${p.slug} (${p.projectId})\n`);
    const names = await fetchVercelProductionEnvNames(token, p.projectId);
    liveNamesBySlug.set(p.slug, names);
  }
  const findings = classifyVercelNameDrift(unique, liveNamesBySlug);
  reportAndExit(findings, unique.length, 'vercel-name-diff (live API)');
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--live-vercel')) {
    runLiveVercel().catch((err) => {
      process.stderr.write(
        `secret-path-drift --live-vercel failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    });
    return;
  }

  const namesJsonPath = argValue(argv, '--vercel-names-json');
  if (namesJsonPath) {
    const projects = collectVercelProjects(readFileSync(VERCEL_MANIFEST, 'utf8'));
    const live = parseVercelNamesJson(readFileSync(namesJsonPath, 'utf8'));
    const findings = classifyVercelNameDrift(projects, live);
    reportAndExit(findings, projects.length, 'vercel-name-diff (fixture)');
    return;
  }

  const vercelJsonPath = argValue(argv, '--vercel-json');
  const flyJsonPath = argValue(argv, '--fly-json');
  if (!vercelJsonPath) {
    process.stderr.write(
      'usage: secret-path-drift --live-vercel | --vercel-names-json <file> | --vercel-json <file> [--fly-json <file>]\n',
    );
    process.exit(2);
  }

  const nameToPath = manifestNamePathIndex();
  const findings: DriftFinding[] = [];

  const vercelDocs = parseSyncDiffJsonl(readFileSync(vercelJsonPath, 'utf8'));
  findings.push(...classifyVercelDrift(vercelDocs, nameToPath));

  if (flyJsonPath) {
    let flyLive: string[] = [];
    try {
      const parsed = JSON.parse(readFileSync(flyJsonPath, 'utf8')) as FlySecret[];
      flyLive = parsed.map((s) => s.Name).filter((n): n is string => typeof n === 'string');
    } catch {
      process.stderr.write(
        'secret-path-drift: --fly-json unreadable/empty — Fly surface skipped\n',
      );
    }
    if (flyLive.length > 0) findings.push(...classifyFlyDrift(flyLive, nameToPath));
  }

  reportAndExit(findings, vercelDocs.length, 'revvault-sync-json');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
