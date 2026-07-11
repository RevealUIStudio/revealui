/**
 * Secret-path LIVE-drift checker (read-only).
 *
 * Consumes the JSON output of `revvault sync vercel --json` (and, optionally,
 * `flyctl secrets list --json`) and classifies each live env var against the
 * canonical secret spec (`SECRET_PATHS`, via the lockstep-guaranteed manifest
 * mapping in parse-manifests.ts) into:
 *
 *   • orphan          — live in Vercel/Fly but NOT in the vault/spec (DiffAction Orphan)
 *   • missing         — in the vault/spec but absent live            (DiffAction Add)
 *   • shape-violation — present live but corrupt: empty / at-rest ciphertext (DiffAction DropShape)
 *
 * NEVER writes, NEVER applies, NEVER prints a secret VALUE — the sync `--json`
 * emits env-var NAMES + action + reason only. This process itself takes no token
 * and makes no network call; the workflow feeds it the captured `--json` files.
 * Token-gating + the live `revvault`/`flyctl` invocation live in
 * .github/workflows/secret-path-drift.yml.
 *
 * KNOWN, already-tracked drift is allow-listed (surfaced as KNOWN, does not fail
 * the run); any NEW drift fails the run so it is triaged before it compounds —
 * the doc-currency-baseline pattern.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectVars } from './parse-manifests.js';
import { DECLARED_PATHS } from './secret-paths.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERCEL_MANIFEST = resolve(HERE, 'revvault-vercel.toml');
const FLY_MANIFEST = resolve(HERE, 'revvault-fly.toml');

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

function main(): void {
  const argv = process.argv.slice(2);
  const vercelJsonPath = argValue(argv, '--vercel-json');
  const flyJsonPath = argValue(argv, '--fly-json');
  if (!vercelJsonPath) {
    process.stderr.write('usage: secret-path-drift --vercel-json <file> [--fly-json <file>]\n');
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

  // Belt-and-suspenders: a non-orphan live key whose manifest path is undeclared
  // would mean manifest↔spec drift the per-PR lockstep somehow missed.
  const undeclared = findings.filter((f) => f.path !== undefined && !DECLARED_PATHS.has(f.path));

  const { fresh, known } = partitionFindings(findings);

  process.stdout.write('── secret-path live-drift check (read-only) ──\n');
  process.stdout.write(`vercel projects scanned: ${vercelDocs.length}\n\n`);

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

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
