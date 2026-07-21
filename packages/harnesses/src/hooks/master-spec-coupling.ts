/**
 * Master-spec / architecture coupling advisory (GAP-199 native twin).
 *
 * Claude-side pair: `~/.claude/hooks/master-spec-pr-coupling.js` (PostToolUse
 * warn-only). This module is the provider-agnostic RevealUI implementation so
 * every harness that runs `runHookCommand` (Claude Code, Cursor, VS Code, …)
 * gets the same warn when contract/schema/app product code is edited without
 * the product canon doc dirty in the same working tree.
 *
 * Never blocks: returns advisory messages only. Callers write them to stderr
 * and leave the policy decision as allow.
 */

import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

/** One advisory warning for a single edited path (or aggregate). */
export interface MasterSpecCouplingWarning {
  readonly filePath: string;
  readonly productRoot: string;
  readonly productName: string;
  readonly expectedCanon: string;
  readonly message: string;
}

export interface MasterSpecCouplingOptions {
  /**
   * Inject dirty paths (relative to product root, posix-style) for tests.
   * When omitted, reads `git status --porcelain` in the product root.
   */
  readonly dirtyPaths?: readonly string[];
  /**
   * Inject product-root resolution (tests). When omitted, walks known fleet
   * markers under the absolute file path.
   */
  readonly resolveProduct?: (absFile: string) => ProductContext | null;
}

export interface ProductContext {
  readonly root: string;
  readonly name: string;
  /** Relative path from root, posix, e.g. `docs/ARCHITECTURE.md`. */
  readonly canonRel: string;
}

const TRIGGER_PACKAGES_CONTRACTS = `${sep}packages${sep}contracts${sep}`;
const TRIGGER_DB_SCHEMA = `${sep}packages${sep}db${sep}src${sep}schema${sep}`;
const TRIGGER_APPS = `${sep}apps${sep}`;

const APP_SKIP = [
  `${sep}__tests__${sep}`,
  `${sep}__mocks__${sep}`,
  `${sep}node_modules${sep}`,
  `${sep}dist${sep}`,
  `${sep}.next${sep}`,
] as const;

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const PRODUCT_MARKERS: readonly { readonly needle: string; readonly name: string }[] = [
  { needle: `${sep}revfleet${sep}revealui${sep}`, name: 'revealui' },
  { needle: `${sep}revfleet${sep}revdev${sep}`, name: 'revdev' },
  { needle: `${sep}revfleet${sep}agency${sep}`, name: 'agency' },
];

/** True when `absFile` is a contract / schema / app product-source path. */
export function isMasterSpecTriggerPath(absFile: string): boolean {
  const n = resolve(absFile);
  for (const skip of APP_SKIP) {
    if (n.includes(skip)) return false;
  }
  if (n.includes(TRIGGER_PACKAGES_CONTRACTS)) return true;
  if (n.includes(TRIGGER_DB_SCHEMA)) return true;
  if (!n.includes(TRIGGER_APPS)) return false;
  if (!SOURCE_EXTS.has(extname(n))) return false;
  const appsIdx = n.indexOf(TRIGGER_APPS);
  if (appsIdx === -1) return false;
  const after = n.slice(appsIdx + TRIGGER_APPS.length);
  const parts = after.split(sep);
  // appName / (app|src) / ...
  if (parts.length < 3) return false;
  return parts[1] === 'app' || parts[1] === 'src';
}

/**
 * Resolve product root + canon doc for a file under a known fleet product.
 * Prefers `docs/MASTER_SPEC.md` when present, else `docs/ARCHITECTURE.md`.
 */
export function resolveProductContext(absFile: string): ProductContext | null {
  const n = resolve(absFile);
  for (const m of PRODUCT_MARKERS) {
    const idx = n.indexOf(m.needle);
    if (idx === -1) continue;
    const root = n.slice(0, idx + m.needle.length - 1);
    const masterSpec = join(root, 'docs', 'MASTER_SPEC.md');
    const architecture = join(root, 'docs', 'ARCHITECTURE.md');
    if (existsSync(masterSpec)) {
      return { root, name: m.name, canonRel: 'docs/MASTER_SPEC.md' };
    }
    if (existsSync(architecture)) {
      return { root, name: m.name, canonRel: 'docs/ARCHITECTURE.md' };
    }
    return null;
  }
  return null;
}

function readGitDirtyPaths(repoRoot: string): string[] | null {
  try {
    const out = execFileSync('git', ['-c', 'core.fileMode=false', 'status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 5000,
    });
    const paths: string[] = [];
    for (const line of out.split('\n')) {
      if (!line || line.length < 4) continue;
      let p = line.slice(3).trim();
      const arrow = p.indexOf(' -> ');
      if (arrow !== -1) p = p.slice(arrow + 4);
      paths.push(p.split('\\').join('/'));
    }
    return paths;
  } catch {
    return null;
  }
}

export function isCanonDirty(dirtyPaths: readonly string[], canonRel: string): boolean {
  const want = canonRel.split('\\').join('/');
  for (const p of dirtyPaths) {
    const norm = p.split('\\').join('/');
    if (norm === want) return true;
    if (norm.endsWith(`/${want}`)) return true;
  }
  return false;
}

/**
 * Evaluate master-spec coupling for one or more absolute edited paths.
 * Returns zero or more warnings (never throws).
 */
export function evaluateMasterSpecCoupling(
  filePaths: readonly string[],
  options: MasterSpecCouplingOptions = {},
): MasterSpecCouplingWarning[] {
  const resolveProduct = options.resolveProduct ?? resolveProductContext;
  const warnings: MasterSpecCouplingWarning[] = [];
  const seen = new Set<string>();

  for (const raw of filePaths) {
    if (!raw) continue;
    const abs = resolve(raw);
    if (!isMasterSpecTriggerPath(abs)) continue;
    const ctx = resolveProduct(abs);
    if (!ctx) continue;
    const key = `${ctx.root}::${ctx.canonRel}`;
    if (seen.has(key)) continue;

    const dirty =
      options.dirtyPaths !== undefined ? [...options.dirtyPaths] : readGitDirtyPaths(ctx.root);
    if (dirty === null) continue;
    if (isCanonDirty(dirty, ctx.canonRel)) continue;

    seen.add(key);
    const message =
      `[GAP-199] contract/schema/app edit without ${ctx.canonRel} in the same tree ` +
      `(${ctx.name}). Update the product canon doc in this change set, or ignore if intentional.`;
    warnings.push({
      filePath: abs,
      productRoot: ctx.root,
      productName: ctx.name,
      expectedCanon: ctx.canonRel,
      message,
    });
  }

  return warnings;
}

/**
 * Emit warnings for a harness hook event's filePaths (file-edit / post-tool).
 * Writes each warning line to `write` (default stderr). Returns the warning list.
 */
export function emitMasterSpecCouplingWarnings(
  filePaths: readonly string[] | undefined,
  options: MasterSpecCouplingOptions & {
    readonly write?: (line: string) => void;
  } = {},
): MasterSpecCouplingWarning[] {
  if (!filePaths || filePaths.length === 0) return [];
  const warnings = evaluateMasterSpecCoupling(filePaths, options);
  const write = options.write ?? ((line: string) => process.stderr.write(`${line}\n`));
  for (const w of warnings) {
    write(w.message);
  }
  return warnings;
}
