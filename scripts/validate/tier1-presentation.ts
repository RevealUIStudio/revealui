// console-allowed
/**
 * Tier-1 presentation intrinsic gate (GAP-398).
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
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/tier1-presentation-allowlist.json');

const SCAN_ROOTS = ['apps/marketing', 'apps/docs', 'apps/admin'];
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

const TIER1_TAGS = new Set(['button', 'input', 'select', 'textarea', 'svg']);

interface AllowEntry {
  path: string;
  tag: string;
  reason: string;
}

interface Hit {
  path: string;
  tag: string;
  line: number;
  col: number;
}

function walk(dir: string, outFiles: string[] = []): string[] {
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

function loadAllowlist(): AllowEntry[] {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as { entries?: AllowEntry[] };
  return raw.entries ?? [];
}

function isAllowlisted(pathRel: string, tag: string, entries: AllowEntry[]): boolean {
  return entries.some((e) => e.path === pathRel && e.tag === tag && e.reason.trim().length > 0);
}

function scanFile(absPath: string): Hit[] {
  const text = readFileSync(absPath, 'utf8');
  const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];
  const pathRel = relative(REPO_ROOT, absPath).replaceAll('\\', '/');

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

function main(): void {
  const hardFail = process.argv.includes('--hard-fail');
  const writeAllowlist = process.argv.includes('--write-allowlist');
  const entries = loadAllowlist();
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(resolve(REPO_ROOT, root), files);
  }

  const allHits: Hit[] = [];
  for (const f of files) {
    allHits.push(...scanFile(f));
  }

  if (writeAllowlist) {
    // Group by path+tag for compact allowlist entries (one reason per pair).
    const key = new Map<string, AllowEntry>();
    for (const h of allHits) {
      const k = `${h.path}::${h.tag}`;
      if (!key.has(k)) {
        key.set(k, {
          path: h.path,
          tag: h.tag,
          reason: 'GAP-398 residual burn-down (pre-existing Tier-1 handroll)',
        });
      }
    }
    const payload = {
      description:
        'Allowlisted Tier-1 JSX intrinsics in apps/* until burned to presentation components (GAP-398). Each entry needs a non-empty reason.',
      entries: [...key.values()].sort((a, b) =>
        a.path === b.path ? a.tag.localeCompare(b.tag) : a.path.localeCompare(b.path),
      ),
    };
    writeFileSync(ALLOWLIST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    out(
      `Wrote ${payload.entries.length} allowlist entries → ${relative(REPO_ROOT, ALLOWLIST_PATH)}`,
    );
    process.exit(0);
  }

  const violations: Hit[] = [];
  const allowlisted: Hit[] = [];
  for (const h of allHits) {
    if (isAllowlisted(h.path, h.tag, entries)) allowlisted.push(h);
    else violations.push(h);
  }

  out('================================================================');
  out('Tier-1 presentation intrinsic gate (GAP-398)');
  out('================================================================');
  out(`Scanned ${files.length} files under ${SCAN_ROOTS.join(', ')}`);
  out(
    `Hits: ${allHits.length}  allowlisted: ${allowlisted.length}  violations: ${violations.length}`,
  );
  out(`Mode: ${hardFail ? 'HARD FAIL' : 'WARN (exit 0)'}`);
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
    out('or add a reasoned entry to scripts/validate/tier1-presentation-allowlist.json.');
  } else {
    out('✓ No non-allowlisted Tier-1 intrinsics.');
  }

  if (hardFail && violations.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
