// console-allowed
/**
 * citation-check.ts — Source-citation gate for code-asserting docs.
 *
 * Convention: CONTRIBUTING.md — "Source citations (Works Cited)".
 * Sibling gates: scripts/validate/claim-drift.ts (numeric claims),
 *   the coordination repo's doc-currency gate (stale facts),
 *   apps/docs/scripts/check-links.ts (broken .md links).
 *
 * This is the missing member of that family: it ties a doc's *code-behaviour*
 * claims to the source that validates them ("Works Cited"). Two checks:
 *
 *   1. VALIDITY (hard-fail; zero baseline) — every authored source citation in
 *      a scanned doc must resolve. A citation is an inline-code span or a
 *      markdown-link target shaped like a source path with a REQUIRED line
 *      anchor: `packages/core/src/license.ts:96-119`. The line anchor is what
 *      separates a deliberate citation from an incidental inline-code path
 *      (an HTTP route, a partial component path). The cited file must exist and
 *      its `:N` / `:A-B` anchor must fall inside the file. This is
 *      the durable, false-positive-free gate: it kills citation ROT (a doc
 *      pointing at a moved / renamed file or a deleted line range).
 *
 *   2. COVERAGE (experimental; warn + baseline-grandfathered) — a code-behaviour
 *      claim line in a GATED doc that carries no citation. Conservative token
 *      detection with generous exoneration (the doc-currency pattern). The
 *      current corpus is grandfathered in `citation-baseline.json`; only NEW
 *      uncited claims are reported. Coverage never fails the build unless
 *      `--coverage-strict` is passed (Phase 3) — shipping it warn-only records
 *      the debt and flags new drift without boiling the ocean on day one.
 *
 * ZERO authored regex (fleet M2 hardline) — `indexOf` / `split` + `Set` only.
 * Extraction is shared with check-links via scripts/lib/md-links.ts.
 *
 * Usage (from a repo root, or any dir via --paths):
 *   <tsx> scripts/validate/citation-check.ts                 # gated scope, fail on rot
 *   <tsx> scripts/validate/citation-check.ts --warn          # never exit nonzero
 *   <tsx> scripts/validate/citation-check.ts --scope=all     # validity on ALL docs
 *   <tsx> scripts/validate/citation-check.ts --paths=../sibling  # scan a sibling repo
 *   <tsx> scripts/validate/citation-check.ts --update-baseline
 *   <tsx> scripts/validate/citation-check.ts --coverage-strict  # fail on NEW gaps
 *   <tsx> scripts/validate/citation-check.ts --json
 *
 * Exit 0 = clean (or --warn). Exit 1 = unresolved citation (or new coverage gap
 * under --coverage-strict). Exit 2 = bad argument.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractInlineCodeSpans, extractLinkTargets, forEachProseLine } from '../lib/md-links.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASELINE_PATH = path.join(__dirname, 'citation-baseline.json');

// ---------------------------------------------------------------------------
// Citation parsing — zero regex.
// ---------------------------------------------------------------------------

/** Source-file extensions a citation may point at (code/config, never .md). */
const SOURCE_EXTS = new Set<string>([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.rs',
  '.go',
  '.py',
  '.sh',
  '.bash',
  '.sql',
  '.css',
  '.scss',
  '.toml',
  '.yml',
  '.yaml',
  '.json',
  '.rb',
]);

export interface ParsedCitation {
  /** Path portion, e.g. `packages/core/src/license.ts`. */
  file: string;
  /** Start line of a `:N` / `:A-B` anchor, if present. */
  start?: number;
  /** End line of a `:A-B` anchor, if present. */
  end?: number;
}

function isAllDigits(s: string): boolean {
  if (s.length === 0) {
    return false;
  }
  for (const ch of s) {
    if (ch < '0' || ch > '9') {
      return false;
    }
  }
  return true;
}

function isExternal(target: string): boolean {
  const lower = target.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('//')
  );
}

/** Parse a trailing `:N` or `:A-B` line anchor; null when the suffix is not numeric. */
export function parseLineSuffix(s: string): { start: number; end?: number } | null {
  if (s.length === 0) {
    return null;
  }
  const dash = s.indexOf('-');
  if (dash === -1) {
    return isAllDigits(s) ? { start: Number(s) } : null;
  }
  const a = s.slice(0, dash);
  const b = s.slice(dash + 1);
  if (isAllDigits(a) && isAllDigits(b)) {
    return { start: Number(a), end: Number(b) };
  }
  return null;
}

/**
 * Interpret `text` (an inline-code span or a markdown-link target) as a source
 * citation. Returns null when it is not citation-shaped — i.e. not a relative
 * path with a directory separator and a known source extension. The "must
 * contain `/`" rule keeps bare prose tokens (`package.json`, `useState`) and
 * shell snippets out of the gate.
 */
export function parseCitation(text: string): ParsedCitation | null {
  let t = text.trim();
  if (t.length === 0 || isExternal(t)) {
    return null;
  }
  // Drop a markdown anchor / query before parsing the path.
  const hash = t.indexOf('#');
  if (hash !== -1) {
    t = t.slice(0, hash);
  }
  const query = t.indexOf('?');
  if (query !== -1) {
    t = t.slice(0, query);
  }
  if (t.length === 0) {
    return null;
  }
  // A citation MUST carry a `:N` / `:A-B` line anchor — that is what separates a
  // deliberate source citation from an incidental inline-code path (an HTTP
  // route like `/.well-known/agent.json`, a partial component path, a shell
  // snippet). Bare-path links are navigation, not citations, and stay out of
  // the validity gate's scope.
  const colon = t.lastIndexOf(':');
  if (colon <= 0) {
    return null;
  }
  const range = parseLineSuffix(t.slice(colon + 1));
  if (!range) {
    return null;
  }
  const file = t.slice(0, colon);
  if (!file.includes('/')) {
    return null; // require a directory — excludes bare filenames + prose
  }
  const dot = file.lastIndexOf('.');
  if (dot === -1) {
    return null;
  }
  if (!SOURCE_EXTS.has(file.slice(dot).toLowerCase())) {
    return null;
  }
  return { file, start: range.start, end: range.end };
}

// ---------------------------------------------------------------------------
// Doc gating — which docs are "code-asserting" and must carry citations.
// ---------------------------------------------------------------------------

/** Path segments that mark a whole subtree as out of scope. */
const EXCLUDE_SEGMENTS = new Set<string>([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.vercel',
  '.direnv',
  '.pnpm-store',
  'coverage',
  'playwright-report',
  'test-results',
  '.worktrees',
  '.changeset',
  '.claude',
  'opensrc',
  // non-code doc classes (own provenance; never source-cited)
  'archive',
  '_closed',
  'handoffs',
  'decisions',
  'business',
  'clients',
  'marketing',
  'legal',
  'llc-formation',
  'outreach',
  'pipeline',
  'sales-exploration',
  'security-posture-remediation',
]);

/** True when `rel` (POSIX, scan-root-relative) is excluded outright. */
export function isExcludedDoc(rel: string): boolean {
  if (rel.endsWith('CHANGELOG.md')) {
    return true;
  }
  for (const seg of rel.split('/')) {
    if (EXCLUDE_SEGMENTS.has(seg)) {
      return true;
    }
  }
  return false;
}

/**
 * True when `rel` is a code-asserting doc that must carry citations. The set is
 * deliberately small at launch (README at repo/package/app roots, the core
 * architecture/standards pages, technical guides + API + architecture trees,
 * and specs) and expands as backfill proceeds. Excluded classes are filtered
 * first by isExcludedDoc.
 */
export function isGatedDoc(rel: string): boolean {
  if (isExcludedDoc(rel)) {
    return false;
  }
  // Fully generated from examples/api/openapi.json via pnpm docs:generate:api
  // (GAP-395). Citation coverage would force hand-edits that the api-docs
  // drift gate immediately rejects; validity still applies to other docs/api.
  if (rel === 'docs/api/rest-api/README.md') {
    return false;
  }
  // Path-prefix includes first, so a README living under docs/api/ etc. is
  // gated by its tree rather than short-circuited by the README depth rule.
  if (
    rel === 'docs/ARCHITECTURE.md' ||
    rel === 'docs/STANDARDS.md' ||
    rel.startsWith('docs/guides/') ||
    rel.startsWith('docs/api/') ||
    rel.startsWith('docs/architecture/') ||
    rel.startsWith('docs/specs/')
  ) {
    return true;
  }
  const segs = rel.split('/');
  const base = segs[segs.length - 1];
  if (base === 'MASTER_SPEC.md') {
    return true;
  }
  if (base === 'README.md') {
    if (segs.length === 1) {
      return true; // repo-root README
    }
    return segs.length === 3 && (segs[0] === 'packages' || segs[0] === 'apps');
  }
  return false;
}

// ---------------------------------------------------------------------------
// Citation resolution — repo-relative, doc-relative, or fleet/product-relative.
// ---------------------------------------------------------------------------

const fileLineCache = new Map<string, number | null>();

/** Line count of a file, or null when it does not exist. Cached. */
function fileLineCount(abs: string): number | null {
  const cached = fileLineCache.get(abs);
  if (cached !== undefined) {
    return cached;
  }
  let count: number | null;
  try {
    count = fs.readFileSync(abs, 'utf8').split('\n').length;
  } catch {
    count = null;
  }
  fileLineCache.set(abs, count);
  return count;
}

/**
 * Resolve a citation's file across the plausible roots, in order:
 *   1. relative to the citing doc's directory (handles `../../foo.ts`)
 *   2. relative to the scan root (repo-relative `packages/...`)
 *   3. relative to the fleet root (cross-repo `revealui/packages/...`)
 *   4. relative to fleetRoot/<product> (bare `packages/...` authored from a sibling repo)
 * Returns the first existing path's line count, or null when none resolve.
 */
function resolveCitation(
  docAbs: string,
  scanRoot: string,
  fleetRoot: string,
  product: string,
  file: string,
): { abs: string; lines: number } | null {
  const candidates = [
    path.resolve(path.dirname(docAbs), file),
    path.resolve(scanRoot, file),
    path.resolve(fleetRoot, file),
    path.resolve(fleetRoot, product, file),
  ];
  for (const abs of candidates) {
    const lines = fileLineCount(abs);
    if (lines !== null) {
      return { abs, lines };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Coverage — conservative uncited-claim detection (warn + baseline).
// ---------------------------------------------------------------------------

/** Tokens that strongly imply a code-behaviour assertion (lowercase). */
const CLAIM_TOKENS = [
  'enforces ',
  'enforced in',
  'validates ',
  'validated in',
  'implements ',
  'implemented in',
  'defined in ',
  'lives in ',
  'configured in ',
  'registered in',
  're-exported',
  'exported from',
  'wired in',
  'handled in ',
  'handled by ',
  'backed by ',
  'returns a ',
  'returns the ',
  'defaults to ',
];

/** Markers that exonerate a candidate line from needing a citation (lowercase). */
const COVERAGE_EXON = [
  'example',
  'e.g.',
  'for example',
  'roadmap',
  'planned',
  'coming soon',
  'tbd',
  'todo',
  'http',
  'see ',
  'note:',
  'warning:',
];

/** Collapse runs of ASCII whitespace to single spaces (no regex). */
function collapseWs(s: string): string {
  let out = '';
  let inWs = false;
  for (const ch of s) {
    const ws = ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
    if (ws) {
      inWs = true;
      continue;
    }
    if (inWs && out.length > 0) {
      out += ' ';
    }
    inWs = false;
    out += ch;
  }
  return out;
}

/** Stable, line-number-independent key for a coverage gap. */
export function normClaim(rel: string, line: string): string {
  return `${rel}::${collapseWs(line).toLowerCase().slice(0, 160)}`;
}

function isStructuralLine(trimmed: string): boolean {
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('|')) {
    return true; // heading, blockquote, table row/separator
  }
  return false;
}

/**
 * True when `tok` occurs in `lower` at a word boundary (start-of-string or a
 * non-letter before it). Prevents `validates ` from matching inside
 * `revalidates ` (an ISR-revalidation description, not a validation claim).
 */
function tokenAtWordBoundary(lower: string, tok: string): boolean {
  let idx = lower.indexOf(tok);
  while (idx !== -1) {
    const before = idx === 0 ? '' : lower[idx - 1];
    if (!(before >= 'a' && before <= 'z')) {
      return true;
    }
    idx = lower.indexOf(tok, idx + 1);
  }
  return false;
}

/** True when `lower` (a lowercased line) reads as an uncited code-behaviour claim. */
export function isUncitedClaim(rawLine: string, hasCitation: boolean): boolean {
  if (hasCitation) {
    return false;
  }
  const trimmed = rawLine.trimStart();
  if (isStructuralLine(trimmed)) {
    return false;
  }
  const lower = rawLine.toLowerCase();
  let claims = false;
  for (const tok of CLAIM_TOKENS) {
    if (tokenAtWordBoundary(lower, tok)) {
      claims = true;
      break;
    }
  }
  if (!claims) {
    return false;
  }
  for (const ex of COVERAGE_EXON) {
    if (lower.includes(ex)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// File walk.
// ---------------------------------------------------------------------------

function walkMarkdown(root: string): string[] {
  const acc: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (EXCLUDE_SEGMENTS.has(e.name)) {
          continue;
        }
        walk(path.join(dir, e.name));
      } else if (e.isFile() && e.name.endsWith('.md')) {
        acc.push(path.join(dir, e.name));
      }
    }
  };
  walk(root);
  return acc;
}

// ---------------------------------------------------------------------------
// Scan.
// ---------------------------------------------------------------------------

interface ValidityError {
  file: string;
  line: number;
  citation: string;
  kind: 'missing' | 'out-of-range';
  detail: string;
}

interface CoverageGap {
  file: string;
  line: number;
  excerpt: string;
  key: string;
}

interface ScanResult {
  scanned: number;
  gated: number;
  validity: ValidityError[];
  coverage: CoverageGap[];
}

export function scan(
  scanRoot: string,
  fleetRoot: string,
  product: string,
  scopeAll: boolean,
): ScanResult {
  const validity: ValidityError[] = [];
  const coverage: CoverageGap[] = [];
  let gated = 0;
  const files = walkMarkdown(scanRoot);
  for (const abs of files) {
    const rel = path.relative(scanRoot, abs).split(path.sep).join('/');
    if (isExcludedDoc(rel)) {
      continue;
    }
    const isGated = isGatedDoc(rel);
    if (isGated) {
      gated++;
    }
    // Validity applies to gated docs always, and to ALL docs under --scope=all.
    if (!(isGated || scopeAll)) {
      continue;
    }
    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    // --- Validity: every citation-shaped reference must resolve. ---
    const refs = [...extractInlineCodeSpans(content), ...extractLinkTargets(content)];
    const citedLines = new Set<number>();
    for (const ref of refs) {
      const parsed = parseCitation(ref.text);
      if (!parsed) {
        continue;
      }
      citedLines.add(ref.line);
      const resolved = resolveCitation(abs, scanRoot, fleetRoot, product, parsed.file);
      if (!resolved) {
        validity.push({
          file: rel,
          line: ref.line,
          citation: ref.text.trim(),
          kind: 'missing',
          detail: `cited file '${parsed.file}' does not exist`,
        });
        continue;
      }
      const lo = parsed.start;
      const hi = parsed.end ?? parsed.start;
      if (lo !== undefined && hi !== undefined) {
        if (lo < 1 || hi < lo || hi > resolved.lines) {
          validity.push({
            file: rel,
            line: ref.line,
            citation: ref.text.trim(),
            kind: 'out-of-range',
            detail: `line anchor ${lo}${parsed.end ? `-${hi}` : ''} outside '${parsed.file}' (${resolved.lines} lines)`,
          });
        }
      }
    }

    // --- Coverage: uncited claims in gated docs only. forEachProseLine skips
    // YAML frontmatter + fenced code, so neither is mistaken for a claim. ---
    if (isGated) {
      forEachProseLine(content, (rawLine, lineNo) => {
        const hasCitation = citedLines.has(lineNo);
        if (isUncitedClaim(rawLine, hasCitation)) {
          coverage.push({
            file: rel,
            line: lineNo,
            excerpt: collapseWs(rawLine).slice(0, 140),
            key: normClaim(rel, rawLine),
          });
        }
      });
    }
  }
  return { scanned: files.length, gated, validity, coverage };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

interface Options {
  scanRoot: string;
  scopeAll: boolean;
  warn: boolean;
  coverageStrict: boolean;
  updateBaseline: boolean;
  json: boolean;
  quiet: boolean;
  product: string;
  baseline: string;
}

function parseOptions(argv: string[]): Options {
  const opts: Options = {
    scanRoot: process.cwd(),
    scopeAll: false,
    warn: false,
    coverageStrict: false,
    updateBaseline: false,
    json: false,
    quiet: false,
    product: 'revealui',
    baseline: BASELINE_PATH,
  };
  for (const arg of argv) {
    if (arg === '--warn') {
      opts.warn = true;
    } else if (arg === '--coverage-strict') {
      opts.coverageStrict = true;
    } else if (arg === '--update-baseline') {
      opts.updateBaseline = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet') {
      opts.quiet = true;
    } else if (arg === '--scope=all') {
      opts.scopeAll = true;
    } else if (arg === '--scope=gated') {
      opts.scopeAll = false;
    } else if (arg.startsWith('--paths=')) {
      opts.scanRoot = path.resolve(arg.slice('--paths='.length));
    } else if (arg.startsWith('--product=')) {
      opts.product = arg.slice('--product='.length);
    } else if (arg.startsWith('--baseline=')) {
      opts.baseline = path.resolve(arg.slice('--baseline='.length));
    } else {
      process.stderr.write(`[citation-check] unknown arg: ${arg}\n`);
      process.exit(2);
    }
  }
  return opts;
}

function loadBaseline(baselinePath: string): Set<string> {
  if (!fs.existsSync(baselinePath)) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as { keys?: string[] };
    return new Set(parsed.keys ?? []);
  } catch {
    process.stderr.write(
      '[citation-check] WARNING: baseline unreadable; treating all coverage gaps as new.\n',
    );
    return new Set();
  }
}

function main(): void {
  const opts = parseOptions(process.argv.slice(2));
  const fleetRoot = path.dirname(opts.scanRoot);
  const result = scan(opts.scanRoot, fleetRoot, opts.product, opts.scopeAll);

  if (opts.updateBaseline) {
    const keys = Array.from(new Set(result.coverage.map((g) => g.key))).sort();
    const payload = {
      note: 'Grandfathered uncited code-behaviour claims in gated docs. Regenerate via `citation-check.ts --update-baseline`. CI reports only NEW (file::claim) keys; shrinking this list = backfill progress. Citation VALIDITY is never baselined.',
      count: keys.length,
      keys,
    };
    fs.writeFileSync(opts.baseline, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    process.stdout.write(
      `[citation-check] baseline written: ${keys.length} grandfathered coverage gap(s) → ${path.relative(opts.scanRoot, opts.baseline)}\n`,
    );
    process.exit(0);
  }

  const baseline = loadBaseline(opts.baseline);
  const newGaps = result.coverage.filter((g) => !baseline.has(g.key));

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({ ...result, newCoverageGaps: newGaps.length }, null, 2)}\n`,
    );
  } else if (!opts.quiet) {
    process.stdout.write(
      `[citation-check] ${result.scanned} docs scanned, ${result.gated} gated; ` +
        `${result.validity.length} citation validity error(s); ` +
        `${result.coverage.length} uncited claim(s) (${result.coverage.length - newGaps.length} baselined, ${newGaps.length} NEW).\n`,
    );
  }

  if (result.validity.length > 0 && !opts.json) {
    process.stderr.write(
      '\n[citation-check] Citation VALIDITY errors (rotted Works-Cited links):\n',
    );
    for (const e of result.validity) {
      process.stderr.write(`  ✗ ${e.file}:${e.line}  \`${e.citation}\`  — ${e.detail}\n`);
    }
    process.stderr.write(
      '\n  Fix: repoint each citation to the current path / line range, or remove it.\n',
    );
  }

  if (newGaps.length > 0 && !opts.json) {
    process.stderr.write(
      `\n[citation-check] ${newGaps.length} NEW uncited claim(s) in gated docs (warn):\n`,
    );
    for (const g of newGaps) {
      process.stderr.write(`  ⚠ ${g.file}:${g.line}  ${g.excerpt}\n`);
    }
    process.stderr.write(
      '\n  Add a source citation (`path/to/file.ts:line`) on the line or in a `## Sources` block,\n' +
        '  or — if this is not a code-behaviour claim — rephrase / regenerate the baseline\n' +
        '  (`citation-check.ts --update-baseline`). Convention: .claude/rules/doc-citations.md\n',
    );
  }

  const validityFails = result.validity.length > 0;
  const coverageFails = opts.coverageStrict && newGaps.length > 0;
  if ((validityFails || coverageFails) && !opts.warn) {
    process.exit(1);
  }
  process.exit(0);
}

// Only run when invoked directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === __filename) {
  main();
}
