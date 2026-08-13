// console-allowed
/**
 * Tier-1 presentation intrinsic gate (GAP-398, fleet window GAP-479).
 *
 * Flags JSX host elements that must come from @revealui/presentation:
 *   button | input | select | textarea | svg
 *
 * No authored regex (fleet no-regex): TypeScript compiler API AST walk only.
 *
 * Modes:
 *   default / --warn   warn on non-allowlisted hits; exit 0
 *   --hard-fail        non-allowlisted hits exit 1 (burn-down complete)
 *
 * Usage:
 *   pnpm validate:tier1-presentation
 *   pnpm validate:tier1-presentation -- --hard-fail
 *   pnpm validate:tier1-presentation -- --repo-root /path/to/demo --root app --hard-fail
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from '@revealui/ts-strada';

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

const DEFAULT_REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

/** Default scan window inside the revealui monorepo. presentation itself is the primitive home. */
export const DEFAULT_SCAN_ROOTS = [
  'apps/marketing',
  'apps/docs',
  'apps/admin',
  'apps/rsc-poc',
  'packages/core',
  'packages/cli/templates',
  'packages/editor',
] as const;

const SOURCE_EXTS = new Set(['.tsx', '.jsx']);
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.turbo',
  '.next',
  'coverage',
  'playwright-report',
  'test-results',
  '__tests__',
  '__mocks__',
]);

export const TIER1_TAGS = new Set(['button', 'input', 'select', 'textarea', 'svg']);

export interface AllowEntry {
  path: string;
  tag: string;
  reason: string;
}

export interface Hit {
  path: string;
  tag: string;
  line: number;
  col: number;
}

export interface CliOptions {
  hardFail: boolean;
  writeAllowlist: boolean;
  repoRoot: string;
  allowlistPath: string;
  scanRoots: string[];
}

export function parseCliArgs(argv: string[], defaultRepoRoot = DEFAULT_REPO_ROOT): CliOptions {
  let repoRoot = defaultRepoRoot;
  let allowlistPath = join(defaultRepoRoot, 'scripts/validate/tier1-presentation-allowlist.json');
  const roots: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo-root') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        repoRoot = resolve(next);
        i += 1;
      }
      continue;
    }
    if (arg === '--allowlist') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        allowlistPath = resolve(next);
        i += 1;
      }
      continue;
    }
    if (arg === '--root') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        roots.push(next);
        i += 1;
      }
    }
  }

  if (
    repoRoot !== defaultRepoRoot &&
    allowlistPath === join(defaultRepoRoot, 'scripts/validate/tier1-presentation-allowlist.json')
  ) {
    const sibling = join(repoRoot, 'scripts/validate/tier1-presentation-allowlist.json');
    if (existsSync(sibling)) allowlistPath = sibling;
  }

  return {
    hardFail: argv.includes('--hard-fail'),
    writeAllowlist: argv.includes('--write-allowlist'),
    repoRoot,
    allowlistPath,
    scanRoots: roots.length > 0 ? roots : [...DEFAULT_SCAN_ROOTS],
  };
}

export function walk(dir: string, outFiles: string[] = []): string[] {
  if (!existsSync(dir)) return outFiles;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p, outFiles);
      continue;
    }
    if (!SOURCE_EXTS.has(extname(ent.name))) continue;
    if (ent.name.includes('.test.') || ent.name.includes('.spec.')) continue;
    if (ent.name.endsWith('.e2e.tsx') || ent.name.endsWith('.e2e.ts')) continue;
    outFiles.push(p);
  }
  return outFiles;
}

export function loadAllowlist(allowlistPath: string): AllowEntry[] {
  if (!existsSync(allowlistPath)) return [];
  const raw = JSON.parse(readFileSync(allowlistPath, 'utf8')) as { entries?: AllowEntry[] };
  return raw.entries ?? [];
}

export function isAllowlisted(pathRel: string, tag: string, entries: AllowEntry[]): boolean {
  return entries.some((e) => e.path === pathRel && e.tag === tag && e.reason.trim().length > 0);
}

export function scanFile(absPath: string, repoRoot: string): Hit[] {
  const text = readFileSync(absPath, 'utf8');
  const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];
  const pathRel = relative(repoRoot, absPath).replaceAll('\\', '/');

  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagNode = node.tagName;
      if (ts.isIdentifier(tagNode)) {
        const tag = tagNode.text;
        if (TIER1_TAGS.has(tag)) {
          const { line, character } = sf.getLineAndCharacterOfPosition(tagNode.getStart(sf));
          hits.push({ path: pathRel, tag, line: line + 1, col: character + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

export function partitionHits(
  hits: Hit[],
  entries: AllowEntry[],
): { violations: Hit[]; allowlisted: Hit[] } {
  const violations: Hit[] = [];
  const allowlisted: Hit[] = [];
  for (const h of hits) {
    if (isAllowlisted(h.path, h.tag, entries)) allowlisted.push(h);
    else violations.push(h);
  }
  return { violations, allowlisted };
}

function collectHits(opts: CliOptions): { files: string[]; hits: Hit[] } {
  const files: string[] = [];
  for (const root of opts.scanRoots) {
    walk(resolve(opts.repoRoot, root), files);
  }
  const hits: Hit[] = [];
  for (const f of files) {
    hits.push(...scanFile(f, opts.repoRoot));
  }
  return { files, hits };
}

function writeAllowlistFile(opts: CliOptions, hits: Hit[], existing: AllowEntry[]): void {
  const prior = new Map(existing.map((e) => [`${e.path}::${e.tag}`, e]));
  const key = new Map<string, AllowEntry>();
  for (const h of hits) {
    const k = `${h.path}::${h.tag}`;
    if (key.has(k)) continue;
    const kept = prior.get(k);
    key.set(
      k,
      kept ?? {
        path: h.path,
        tag: h.tag,
        reason: 'GAP-479 grandfather: migrate this host to @revealui/presentation',
      },
    );
  }
  const payload = {
    description:
      'Allowlisted Tier-1 JSX intrinsics until burned to @revealui/presentation (GAP-398 residual floor + GAP-479 extra roots). Each entry needs a non-empty reason. Hard-fail: pnpm validate:tier1-presentation -- --hard-fail.',
    entries: [...key.values()].sort((a, b) =>
      a.path === b.path ? a.tag.localeCompare(b.tag) : a.path.localeCompare(b.path),
    ),
  };
  writeFileSync(opts.allowlistPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  out(
    `Wrote ${payload.entries.length} allowlist entries → ${relative(opts.repoRoot, opts.allowlistPath)}`,
  );
}

export function runGate(argv: string[] = process.argv.slice(2)): number {
  const opts = parseCliArgs(argv);
  const existing = loadAllowlist(opts.allowlistPath);
  const { files, hits } = collectHits(opts);

  if (opts.writeAllowlist) {
    writeAllowlistFile(opts, hits, existing);
    return 0;
  }

  const { violations, allowlisted } = partitionHits(hits, existing);

  out('================================================================');
  out('Tier-1 presentation intrinsic gate (GAP-398 / GAP-479)');
  out('================================================================');
  out(`Repo: ${opts.repoRoot}`);
  out(`Scanned ${files.length} files under ${opts.scanRoots.join(', ')}`);
  out(`Hits: ${hits.length}  allowlisted: ${allowlisted.length}  violations: ${violations.length}`);
  out(`Mode: ${opts.hardFail ? 'HARD FAIL' : 'WARN (exit 0)'}`);
  out('');

  if (violations.length > 0) {
    out('Non-allowlisted Tier-1 intrinsics (must use @revealui/presentation):');
    for (const h of violations) {
      out(`  ${h.path}:${h.line}:${h.col}  <${h.tag}>`);
    }
    out('');
    out(
      'Fix: replace with Button / Input / Slider / Switch / Tabs / Icon* from @revealui/presentation,',
    );
    out(`or add a reasoned entry to ${opts.allowlistPath}.`);
  } else {
    out('✓ No non-allowlisted Tier-1 intrinsics.');
  }

  if (opts.hardFail && violations.length > 0) return 1;
  return 0;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectRun()) {
  process.exit(runGate());
}
