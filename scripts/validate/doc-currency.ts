#!/usr/bin/env tsx
// console-allowed

/**
 * Doc-Currency Validator — stale-fact drift guard for prose and marketing copy.
 *
 * Scans two surfaces for terms that present a retired, renamed, or reversed
 * fact as if it were still current:
 *
 *   1. Markdown prose across the repo's reader-facing surfaces (line-based
 *      substring scan, mirroring the fenced-import scanner style already used
 *      by `docs-import-drift.ts`): the whole `docs/**` tree (including the
 *      public `docs/blog` posts) plus `apps/**` markdown,
 *      every package `README.md`, and the root-level docs
 *      (README/CLAUDE/AGENTS/SECURITY/…). CHANGELOGs and archived/handoff
 *      records are skipped as inherently historical.
 *   2. Marketing copy string literals under
 *      `apps/marketing/app/content/**\/*.ts`, extracted via the TypeScript
 *      compiler API. Only literal string content is scanned — string
 *      literals, no-substitution template literals, and the literal text
 *      spans of template expressions (head/middle/tail). Identifiers,
 *      import/export module specifiers, and comments are never scanned.
 *
 * Zero authored regex — substring (`.includes`) + `Set<string>` only, per
 * the repo's no-regex convention. The one exception is the TypeScript
 * compiler API itself, used structurally (AST node kinds), never as a
 * pattern-matching engine.
 *
 * Design (why it won't flag legitimate historical references):
 *   1. SKIP whole files that are inherently historical: anything under an
 *      archive/ or _closed/ path segment, any HANDOFF-*.md session
 *      snapshot, or any file whose first ~20 lines carry a
 *      SUPERSEDED/CANCELLED/HISTORICAL/ARCHIVED/RETIRED banner.
 *   2. Per-occurrence EXONERATION: a banned term appearing alongside a
 *      past-tense / correction marker (cancelled, dropped, retired, →, "no
 *      longer", exempt, instead, legacy, …) is not a hit. This lets prose
 *      say "Railway was dropped for Fly" without tripping.
 *   3. BASELINE allow-list (doc-currency-baseline.json): the corpus's known
 *      occurrences at seed time are grandfathered. CI hard-fails only on
 *      NEW, non-exonerated hits (the gitleaks-baseline pattern) — shrinking
 *      the baseline is progress, growing it needs justification.
 *
 * Usage:
 *   tsx scripts/validate/doc-currency.ts                 # report (exit 0)
 *   tsx scripts/validate/doc-currency.ts --mode=ci        # exit 1 on new drift
 *   tsx scripts/validate/doc-currency.ts --update-baseline   # regenerate baseline
 *
 * Exit 0 = clean (or report mode). Exit 1 = new drift (ci mode). Exit 2 = bad arg.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import ts from '@revealui/ts-strada';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BASELINE_PATH = path.join(ROOT, 'scripts/validate/doc-currency-baseline.json');

// Detection data for the SHARED_FLEET_RULES below lives in @revealui/harnesses
// (packages/harnesses/src/gates/doc-currency-shared-rules.ts) — single
// editable source, GAP-408 control-layer redesign. Resolved via the same
// gates-resolver.cjs guardrail2-verdict.cjs uses (local dist, or a
// REVEALUI_HARNESSES_DIR npm install), through `createRequire` — a static
// `import ... from '@revealui/harnesses'` would need a package.json
// dependency edge, which scripts/validate/boundary.ts Check 4 forbids for an
// optional Fair Source package.
//
// ABSENCE BEHAVIOR (decision, see doc-currency.md cross-scanner lockstep
// section): WARN and continue with the shared rule set empty, rather than
// hard-fail the whole scanner. doc-currency is a best-effort stale-fact
// scanner, not a merge-authorization gate (contrast guardrail2-verdict, which
// fails closed because a silently-skipped hold is a security miss) — and the
// scanner's own design philosophy is "a noisy/broken gate gets disabled"
// (see the file's top-level doc comment). This mirrors the existing
// unreadable-baseline handling below (warn, degrade gracefully, never crash).
interface GatesModuleShape {
  COMMON_EXON: readonly string[];
  STRIPE_LIVE_EXON: readonly string[];
  SHARED_DETECTION_RULES: readonly {
    id: string;
    anyOf: readonly string[];
    unlessLineHas: readonly string[];
  }[];
}

function loadGatesModule(): GatesModuleShape | null {
  const require = createRequire(import.meta.url);
  const { resolveGatesModule } = require('./gates-resolver.cjs') as {
    resolveGatesModule: () => GatesModuleShape | null;
  };
  const mod = resolveGatesModule();
  if (!mod) {
    process.stderr.write(
      '[doc-currency] WARNING: could not resolve the @revealui/harnesses gates module ' +
        '(packages/harnesses not built, and REVEALUI_HARNESSES_DIR is unset/unresolvable). ' +
        'Scanning with the SHARED fleet-fact rules SKIPPED — this run only enforces no ' +
        'repo-specific rules the public scanner has (none today). ' +
        'Fix: pnpm --filter @revealui/harnesses build.\n',
    );
    return null;
  }
  return mod;
}

const gates = loadGatesModule();
const SHARED_COMMON_EXON = gates?.COMMON_EXON ?? [];
const SHARED_STRIPE_LIVE_EXON = gates?.STRIPE_LIVE_EXON ?? [];
const SHARED_DETECTION_RULES = gates?.SHARED_DETECTION_RULES ?? [];

export interface Rule {
  id: string;
  /** A occurrence is a candidate hit if it contains (case-insensitive) ANY of these. */
  anyOf: readonly string[];
  /** …UNLESS the same occurrence also contains ANY of these exoneration markers. */
  unlessLineHas: readonly string[];
  message: string;
}

export interface Hit {
  /** Relative to ROOT, forward-slash separated. */
  file: string;
  line: number;
  ruleId: string;
  excerpt: string;
}

// ---------------------------------------------------------------------------
// CLI parsing — no regex; explicit string ops.
// ---------------------------------------------------------------------------
export function parseArgs(argv: readonly string[]): {
  quiet: boolean;
  updateBaseline: boolean;
  mode: 'cli' | 'ci';
  error?: string;
} {
  let quiet = false;
  let updateBaseline = false;
  let mode: 'cli' | 'ci' = 'cli';

  for (const arg of argv) {
    if (arg === '--quiet') quiet = true;
    else if (arg === '--update-baseline') updateBaseline = true;
    else if (arg.startsWith('--mode=')) {
      const v = arg.slice('--mode='.length);
      if (v === 'ci' || v === 'cli') mode = v;
    } else {
      return { quiet, updateBaseline, mode, error: `unknown arg: ${arg}` };
    }
  }
  return { quiet, updateBaseline, mode };
}

// ---------------------------------------------------------------------------
// Rules — derived from an internal audit (2026-07-09) of shipped
// infrastructure and billing pivots that had not yet propagated to prose.
// Generous exoneration: better to miss a stale reference than flag a
// correct historical one — a noisy gate gets disabled, and the value here
// comes from the gate existing and catching new drift, not zero misses.
//
// These are the SHARED FLEET FACTS: retired/renamed facts that can surface in
// any repo's prose. Their DETECTION tuples (anyOf + unlessLineHas) are kept in
// lockstep with the private sibling scanner at
// .jv/scripts/doc-currency-check.ts §SHARED_FLEET_RULES. Messages may carry
// repo-appropriate citations; only the detection must match — with one
// carve-out: `retired-suite-path` carries only the username-free `~/suite/`
// form here (see its comment), because gate:security forbids hardcoded local
// paths in public code. This public
// scanner has no repo-specific rules — the .jv scanner adds `boi-mandatory`,
// which is internal legal posture with no public surface. See the .jv
// doc-currency rule §lockstep.
// ---------------------------------------------------------------------------

/** Re-exported for any external consumer that imported these from this
 *  module before the GAP-408 control-layer move. The editable source is now
 *  `@revealui/harnesses/gates` — see `packages/harnesses/src/gates/
 *  doc-currency-shared-rules.ts`. */
export const COMMON_EXON: readonly string[] = SHARED_COMMON_EXON;
export const STRIPE_LIVE_EXON: readonly string[] = SHARED_STRIPE_LIVE_EXON;

// Repo-appropriate messages, keyed by the shared rule id. Detection
// (anyOf / unlessLineHas) is NOT edited here — that lives in
// @revealui/harnesses/gates (packages/harnesses/src/gates/
// doc-currency-shared-rules.ts). Only the wording is repo-specific.
const SHARED_RULE_MESSAGES: Readonly<Record<string, string>> = {
  'revealcoin-as-current':
    'RevealCoin/RVC/$RVUI was cancelled. Present it as past only, not a current or planned payment rail.',
  'railway-as-current':
    'Studio production is Vercel + Neon + Fly (not Railway). Customer Railway marketplace self-host (deployment/railway) is a sales channel only; do not present Railway as Studio production hosting.',
  'vercel-blob-as-current':
    'Vercel Blob was retired; Cloudflare R2 is the canonical object store. Do not instruct provisioning a Blob token or presenting Blob as current storage.',
  'supabase-as-current':
    'Supabase was removed; Neon + ElectricSQL is the current stack. Present Supabase as past/legacy only, never as current infrastructure.',
  'stripe-not-live-claim':
    'Stripe is live (production mode on). Do not present Stripe as not-yet-flipped or test-mode as the current billing state.',
  'forge-tier-name':
    'The billing tier "Forge" was renamed to "Enterprise". Use "Enterprise" going forward.',
  'max-price-stale':
    'RevealUI Max is $299/mo (cents-of-record: scripts/setup/stripe-catalog.ts). Do not present $149 as the current Max price.',
  'retired-suite-path':
    'The ~/suite/ path was retired 2026-05-08 (now ~/revfleet/). Update the path.',
};

const SHARED_FLEET_RULES: readonly Rule[] = SHARED_DETECTION_RULES.map((rule) => ({
  id: rule.id,
  anyOf: rule.anyOf,
  unlessLineHas: rule.unlessLineHas,
  message: SHARED_RULE_MESSAGES[rule.id] ?? `stale-fact drift: ${rule.id}`,
}));

/** The public revealui scanner enforces the SHARED fleet-fact set only; it has
 *  no repo-specific rules (the private .jv scanner adds `boi-mandatory`, which
 *  has no public surface). Detection tuples come from
 *  `@revealui/harnesses/gates` (single editable source, GAP-408); the private
 *  `.jv/scripts/doc-currency-check.ts` loads the same package via its resolver
 *  adapter and layers a private overlay (retired-suite-path's username-bearing
 *  terms + the wholly-private boi-mandatory rule) on top. */
export const RULES: readonly Rule[] = SHARED_FLEET_RULES;

// ---------------------------------------------------------------------------
// Shared matching helpers
// ---------------------------------------------------------------------------

export function ruleMatches(lowerText: string, rule: Rule): boolean {
  let matched = false;
  for (const term of rule.anyOf) {
    if (lowerText.includes(term)) {
      matched = true;
      break;
    }
  }
  if (!matched) return false;
  for (const ex of rule.unlessLineHas) {
    if (lowerText.includes(ex)) return false;
  }
  return true;
}

export function hitKey(h: Pick<Hit, 'file' | 'ruleId'>): string {
  return `${h.file}::${h.ruleId}`;
}

// ---------------------------------------------------------------------------
// Historical-file skip — shared by markdown and TS content scanning.
// ---------------------------------------------------------------------------

const HISTORICAL_PATH_MARKERS: readonly string[] = ['/archive/', '/_closed/', '/handoffs/archive/'];

const BANNER_MARKERS: readonly string[] = [
  'superseded',
  'cancelled',
  'canceled',
  'historical record',
  'do not action',
  'archived',
  'retired',
  'point-in-time snapshot',
  'preserved for history',
  'status: superseded',
  'status: cancelled',
  'status: historical',
  'status: archived',
  'status: closed',
];

export function isHistoricalPath(relSlash: string): boolean {
  for (const m of HISTORICAL_PATH_MARKERS) if (relSlash.includes(m)) return true;
  return false;
}

/** True when the file's first ~20 lines carry a superseded/historical banner,
 *  or (markdown only) the basename is a HANDOFF-* session snapshot. */
export function shouldSkipFile(rel: string, abs: string): boolean {
  const relSlash = rel.split(path.sep).join('/');
  if (isHistoricalPath(relSlash)) return true;
  const base = path.basename(rel);
  if (base.startsWith('HANDOFF-')) return true;
  // CHANGELOGs are inherently historical change logs; they record past states.
  if (base.startsWith('CHANGELOG')) return true;
  let head: string;
  try {
    head = fs.readFileSync(abs, 'utf8').slice(0, 2000).toLowerCase();
  } catch {
    return true;
  }
  const headLines = head.split('\n').slice(0, 20).join('\n');
  for (const m of BANNER_MARKERS) if (headLines.includes(m)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Markdown scan — line-based, mirrors the original fleet scanner.
// ---------------------------------------------------------------------------

const SKIP_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  'build',
  '.turbo',
]);

/**
 * Build-time serve mirror of monorepo `docs/` (CHIP-3 D5a). Filled by
 * `apps/docs/scripts/copy-docs.sh` + the Vite docs-copy plugin. Not a second
 * source of truth — edit `docs/`, never these copies.
 *
 * Hand-authored exceptions under `public/` (not produced by copy-docs) stay
 * scannable: currently `docs-pro/` only.
 */
export const GENERATED_DOCS_PUBLIC_REL = 'apps/docs/public';
export const HAND_AUTHORED_DOCS_PUBLIC_SUBDIRS: ReadonlySet<string> = new Set(['docs-pro']);

/**
 * True for generated mirror paths under apps/docs/public (not docs-pro).
 * The public directory itself is not classified as generated so walkers can
 * enter and reach hand-authored subdirs (docs-pro); only *contents* that are
 * not hand-authored are skipped.
 */
export function isGeneratedDocsMirrorRel(relSlash: string): boolean {
  const rel = relSlash.split(path.sep).join('/');
  if (!rel.startsWith(`${GENERATED_DOCS_PUBLIC_REL}/`)) return false;
  const rest = rel.slice(GENERATED_DOCS_PUBLIC_REL.length + 1);
  const firstSeg = rest.split('/')[0] ?? '';
  if (HAND_AUTHORED_DOCS_PUBLIC_SUBDIRS.has(firstSeg)) return false;
  return true;
}

// Directories walked in full for `.md` prose. `apps` covers marketing markdown
// and hand-authored docs-pro; the generated public mirror of monorepo `docs/`
// is skipped (see isGeneratedDocsMirrorRel). `docs/` is the prose SoT.
const MARKDOWN_ROOTS: readonly string[] = ['docs', 'apps'];

const isMarkdown = (name: string): boolean => name.endsWith('.md');
const isReadme = (name: string): boolean => name === 'README.md';

function walkMarkdownFiles(
  root: string,
  dir: string,
  acc: string[],
  accept: (name: string) => boolean,
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const dirRel = path.relative(root, dir).split(path.sep).join('/');
  const atGeneratedPublicRoot = dirRel === GENERATED_DOCS_PUBLIC_REL;

  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIR_SEGMENTS.has(e.name)) continue;
      // At the generated public root, only enter hand-authored subdirs.
      if (atGeneratedPublicRoot && !HAND_AUTHORED_DOCS_PUBLIC_SUBDIRS.has(e.name)) continue;
      const next = path.join(dir, e.name);
      const nextRel = path.relative(root, next).split(path.sep).join('/');
      if (isGeneratedDocsMirrorRel(nextRel)) continue;
      walkMarkdownFiles(root, next, acc, accept);
    } else if (e.isFile() && accept(e.name)) {
      // Top-level public/*.md are copy-docs output — never SoT.
      if (atGeneratedPublicRoot) continue;
      const fileRel = path.relative(root, path.join(dir, e.name)).split(path.sep).join('/');
      if (isGeneratedDocsMirrorRel(fileRel)) continue;
      acc.push(path.join(dir, e.name));
    }
  }
}

/**
 * Drop gitignored files from a collected list. Belt-and-suspenders with
 * isGeneratedDocsMirrorRel: gitignored markdown is generated output (e.g. the
 * `apps/docs/public` mirror that `copy-docs.sh` regenerates from `docs/`).
 * Sources are already scanned; paths are absent from the baseline; CI checkouts
 * never contain the mirror — scanning it yields only machine-dependent
 * duplicate findings. Outside a git repo (unit-test temp dirs), the list
 * passes through as-is for non-mirror paths.
 */
function filterGitignored(root: string, files: string[]): string[] {
  if (files.length === 0) return files;
  let out: string;
  try {
    out = execFileSync('git', ['-C', root, 'check-ignore', '--stdin'], {
      input: files.join('\n'),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as { status?: number | null; stdout?: unknown };
    // Exit code 1 means "no paths are ignored"; anything else (128 = not a
    // git repo, ENOENT = no git binary) falls back to scanning everything.
    if (e.status !== 1) return files;
    out = typeof e.stdout === 'string' ? e.stdout : '';
  }
  const ignored = new Set(out.split('\n').filter((line) => line.length > 0));
  return files.filter((f) => !ignored.has(f));
}

export function collectMarkdownFiles(root: string): string[] {
  const acc: string[] = [];
  for (const rel of MARKDOWN_ROOTS) walkMarkdownFiles(root, path.join(root, rel), acc, isMarkdown);
  // Under packages/, only READMEs are reader-facing prose; the rest of the tree
  // is test fixtures, generated files, and per-package CHANGELOGs.
  walkMarkdownFiles(root, path.join(root, 'packages'), acc, isReadme);
  // Root-level markdown (README, CLAUDE, AGENTS, SECURITY, CONTRIBUTING, …);
  // CHANGELOG.md is dropped by shouldSkipFile's historical-log rule.
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    entries = [];
  }
  for (const e of entries) {
    if (e.isFile() && isMarkdown(e.name)) acc.push(path.join(root, e.name));
  }
  return filterGitignored(root, acc);
}

export function scanMarkdownFile(root: string, abs: string): Hit[] {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (shouldSkipFile(rel, abs)) return [];
  let content: string;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  const hits: Hit[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const lower = raw.toLowerCase();
    for (const rule of RULES) {
      if (!ruleMatches(lower, rule)) continue;
      hits.push({ file: rel, line: i + 1, ruleId: rule.id, excerpt: raw.trim().slice(0, 160) });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Marketing-copy TS scan — TypeScript compiler API, string-literal text only.
// ---------------------------------------------------------------------------

const CONTENT_ROOT_REL = 'apps/marketing/app/content';

function isScannableContentFile(name: string): boolean {
  if (!name.endsWith('.ts')) return false;
  if (name.endsWith('.d.ts')) return false;
  if (name.endsWith('.test.ts')) return false;
  if (name === 'types.ts') return false;
  return true;
}

function walkContentFiles(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walkContentFiles(path.join(dir, e.name), acc);
    } else if (e.isFile() && isScannableContentFile(e.name)) {
      acc.push(path.join(dir, e.name));
    }
  }
}

export function collectContentFiles(root: string): string[] {
  const acc: string[] = [];
  walkContentFiles(path.join(root, CONTENT_ROOT_REL), acc);
  return filterGitignored(root, acc);
}

export interface StringLiteralSpan {
  text: string;
  /** 1-indexed line at the start of the literal. */
  line: number;
}

const LITERAL_TEXT_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
]);

/**
 * Extract literal string text from a TypeScript source file: string
 * literals, no-substitution template literals, and the literal text spans
 * of template expressions (head/middle/tail — NOT the `${...}`
 * expressions themselves). Import and export module specifiers are
 * skipped entirely (their string content is a module path, never copy).
 * Identifiers and comments are never visited by this walk in the first
 * place — only literal-like AST nodes are matched.
 */
export function extractStringLiterals(sourceText: string, fileName: string): StringLiteralSpan[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const spans: StringLiteralSpan[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isImportEqualsDeclaration(node)) return;
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) return;

    if (LITERAL_TEXT_KINDS.has(node.kind)) {
      const literal = node as ts.LiteralLikeNode;
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      spans.push({ text: literal.text, line: line + 1 });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return spans;
}

export function scanContentFile(root: string, abs: string): Hit[] {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (shouldSkipFile(rel, abs)) return [];
  let content: string;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  const hits: Hit[] = [];
  for (const span of extractStringLiterals(content, abs)) {
    const lower = span.text.toLowerCase();
    for (const rule of RULES) {
      if (!ruleMatches(lower, rule)) continue;
      hits.push({
        file: rel,
        line: span.line,
        ruleId: rule.id,
        excerpt: span.text.trim().slice(0, 160),
      });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Combined scan
// ---------------------------------------------------------------------------

export function scanAll(root: string = ROOT): {
  hits: Hit[];
  markdownCount: number;
  tsCount: number;
} {
  const markdownFiles = collectMarkdownFiles(root);
  const contentFiles = collectContentFiles(root);

  const hits: Hit[] = [];
  for (const abs of markdownFiles) hits.push(...scanMarkdownFile(root, abs));
  for (const abs of contentFiles) hits.push(...scanContentFile(root, abs));

  return { hits, markdownCount: markdownFiles.length, tsCount: contentFiles.length };
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

interface BaselineFile {
  note: string;
  count: number;
  keys: string[];
}

export function loadBaseline(baselinePath: string = BASELINE_PATH): Set<string> {
  if (!fs.existsSync(baselinePath)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as { keys?: string[] };
    return new Set(parsed.keys ?? []);
  } catch {
    return new Set();
  }
}

export function writeBaseline(hits: readonly Hit[], baselinePath: string = BASELINE_PATH): number {
  const keys = Array.from(new Set(hits.map(hitKey))).sort();
  const payload: BaselineFile = {
    note:
      'Grandfathered doc-currency occurrences. Regenerate via `pnpm validate:doc-currency --update-baseline`. ' +
      'Each entry is a (file::ruleId) pair known to exist as of generation; CI fails only on NEW pairs. ' +
      'Shrinking this list is progress.',
    count: keys.length,
    keys,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return keys.length;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`[doc-currency] ${parsed.error}\n`);
    process.exit(2);
  }
  const { quiet, updateBaseline, mode } = parsed;

  const { hits, markdownCount, tsCount } = scanAll(ROOT);

  if (updateBaseline) {
    const count = writeBaseline(hits);
    process.stdout.write(
      `[doc-currency] baseline written: ${count} grandfathered (file::ruleId) pairs → ${path.relative(ROOT, BASELINE_PATH)}\n`,
    );
    process.exit(0);
  }

  const baseline = loadBaseline();
  const newHits = hits.filter((h) => !baseline.has(hitKey(h)));

  const ruleMsg = new Map(RULES.map((r) => [r.id, r.message]));

  if (!quiet) {
    const grandfathered = hits.length - newHits.length;
    process.stdout.write(
      `[doc-currency] scanned ${markdownCount} markdown file(s) + ${tsCount} marketing-copy file(s); ` +
        `${hits.length} non-exonerated occurrence(s) — ${grandfathered} baselined, ${newHits.length} NEW.\n`,
    );
  }

  if (newHits.length === 0) {
    if (!quiet) process.stdout.write('[doc-currency] OK — no new stale-fact drift.\n');
    process.exit(0);
  }

  process.stderr.write(
    `\n[doc-currency] ${newHits.length} NEW stale-fact occurrence(s) (not in baseline):\n\n`,
  );
  const byRule = new Map<string, Hit[]>();
  for (const h of newHits) {
    const arr = byRule.get(h.ruleId) ?? [];
    arr.push(h);
    byRule.set(h.ruleId, arr);
  }
  for (const [ruleId, arr] of byRule) {
    process.stderr.write(`  ● ${ruleId} — ${ruleMsg.get(ruleId) ?? ''}\n`);
    for (const h of arr) {
      process.stderr.write(`      ${h.file}:${h.line}  ${h.excerpt}\n`);
    }
    process.stderr.write('\n');
  }
  process.stderr.write(
    'Fix the copy (present the fact as past/exonerated), OR — if this is a legitimate new historical record —\n' +
      'add an exoneration marker, mark the file with a SUPERSEDED/HISTORICAL banner, or regenerate the baseline\n' +
      'with `pnpm validate:doc-currency --update-baseline` (shrinking the baseline is the goal; growing it needs justification).\n',
  );

  process.exit(mode === 'ci' ? 1 : 0);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) main();
