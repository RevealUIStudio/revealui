// console-allowed
/**
 * Doc Integrity Gate
 *
 * One AST / typed-predicate checker that enforces the documentation
 * guarantee defined in docs/internal/documentation-system.md: every tracked
 * Markdown doc carries valid frontmatter (so its visibility + trust class are
 * known) and every internal link resolves to a real file.
 *
 * This is the consolidation target for the scattered doc validators. It grows
 * incrementally; this revision ships two checks:
 *   1. frontmatter — present + schema-valid (fail-closed on `visibility`)
 *   2. internal-link resolution — every local `](path)` exists on disk
 *
 * Later increments fold in: code-fence import drift (from docs-import-drift),
 * count claims (from claim-drift, re-impl AST/no-regex), the public-doc leak
 * guard (reusing scripts/leak-scan), and generated-file freshness.
 *
 * No authored regex (fleet M2 hardline): all scanning is indexOf / slice /
 * startsWith over lines. The `console-allowed` marker exempts this CLI from
 * the no-console rule.
 *
 * Usage:
 *   pnpm tsx scripts/validate/doc-integrity.ts            # measure (exit 0)
 *   pnpm tsx scripts/validate/doc-integrity.ts --strict   # hard-fail on errors
 *   pnpm tsx scripts/validate/doc-integrity.ts --json
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

// ---------------------------------------------------------------------------
// Scope: which docs the gate governs
// ---------------------------------------------------------------------------

/** Directories never walked (build output, caches, results, vendored code). */
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.direnv',
  '.turbo',
  '.pgdata',
  '.husky',
  '.playwright-mcp',
  'test-results',
  'coverage',
  'coverage-reports',
  'e2e-results',
  'visual-results',
  'accessibility-results',
  'playwright-report',
  'screenshots',
  '.worktrees',
  '.wt',
  'opensrc',
]);

/**
 * Path prefixes (relative, POSIX) excluded from the gate's scope.
 * apps/docs is the documentation *app* — owned by its own session per the
 * current overhaul scope, so its content is out of scope here.
 */
const EXCLUDE_PREFIXES = ['apps/docs/'];

const DOC_EXTENSIONS = ['.md', '.mdx'];

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function collectDocs(): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name));
      } else if (e.isFile() && DOC_EXTENSIONS.some((ext) => e.name.endsWith(ext))) {
        const full = path.join(dir, e.name);
        const rel = toPosix(path.relative(ROOT, full));
        if (EXCLUDE_PREFIXES.some((pre) => rel.startsWith(pre))) continue;
        out.push(full);
      }
    }
  }
  walk(ROOT);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (flat key:value, zero regex)
// ---------------------------------------------------------------------------

interface Frontmatter {
  present: boolean;
  data: Map<string, string>;
}

function parseFrontmatter(content: string): Frontmatter {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return { present: false, data: new Map() };
  const data = new Map<string, string>();
  let closed = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '---') {
      closed = true;
      break;
    }
    // Only capture top-level (non-indented) scalar keys; nested blocks are
    // ignored for schema purposes.
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) data.set(key, val);
  }
  return { present: closed, data };
}

const VISIBILITY_VALUES = new Set(['public', 'internal']);
const STATUS_VALUES = new Set(['generated', 'verified', 'narrative']);
const AUDIENCE_VALUES = new Set(['user', 'contributor', 'maintainer', 'agent']);

// ---------------------------------------------------------------------------
// Internal-link extraction (zero regex)
// ---------------------------------------------------------------------------

interface LinkRef {
  line: number;
  target: string;
}

function isExternal(target: string): boolean {
  if (target.length === 0) return true;
  if (target.startsWith('#')) return true; // same-page anchor
  if (target.startsWith('mailto:') || target.startsWith('tel:')) return true;
  // Any scheme (http://, https://, ftp://, etc.)
  const scheme = target.indexOf('://');
  const colon = target.indexOf(':');
  if (scheme !== -1) return true;
  // bare-protocol like "data:" or template/placeholder tokens
  if (colon !== -1 && colon < target.indexOf('/')) return true;
  if (target.includes('{') || target.includes('<')) return true; // template/placeholder
  return false;
}

function extractInlineLinks(content: string): LinkRef[] {
  const lines = content.split('\n');
  const out: LinkRef[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Walk the line tracking inline-code (backtick) spans so a documented
    // example like `](path)` inside backticks is never treated as a link.
    let inCode = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '`') {
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;
      if (ch !== ']' || line[c + 1] !== '(') continue;
      const start = c + 2;
      // Find the closing ')', ignoring any inside an inline-code span.
      let end = -1;
      let innerCode = false;
      for (let k = start; k < line.length; k++) {
        const kc = line[k];
        if (kc === '`') {
          innerCode = !innerCode;
          continue;
        }
        if (kc === ')' && !innerCode) {
          end = k;
          break;
        }
      }
      if (end === -1) break;
      let target = line.slice(start, end).trim();
      // Drop a link title: `path "Title"` or `path 'Title'`.
      const space = target.indexOf(' ');
      if (space !== -1) target = target.slice(0, space).trim();
      out.push({ line: i + 1, target });
      c = end;
    }
  }
  return out;
}

/** Resolve a doc-relative or repo-root-relative link target to an absolute path. */
function resolveTarget(fromFile: string, target: string): string {
  // Strip any anchor fragment.
  const hash = target.indexOf('#');
  const clean = hash === -1 ? target : target.slice(0, hash);
  if (clean.length === 0) return ''; // pure anchor handled by isExternal
  if (clean.startsWith('/')) return path.join(ROOT, clean.slice(1));
  return path.resolve(path.dirname(fromFile), clean);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

type Severity = 'error' | 'warn';
type Category =
  | 'frontmatter-missing'
  | 'frontmatter-incomplete'
  | 'visibility-invalid'
  | 'status-invalid'
  | 'audience-invalid'
  | 'broken-link'
  | 'site-absolute-link';

interface Finding {
  file: string; // repo-relative
  line: number;
  severity: Severity;
  category: Category;
  message: string;
}

const REQUIRED_KEYS = ['title', 'description', 'visibility', 'status'];

function checkFrontmatter(rel: string, fm: Frontmatter, findings: Finding[]): void {
  if (!fm.present) {
    findings.push({
      file: rel,
      line: 1,
      severity: 'error',
      category: 'frontmatter-missing',
      message: 'no frontmatter block (need at least title/description/visibility/status)',
    });
    return;
  }
  for (const key of REQUIRED_KEYS) {
    if (!fm.data.has(key) || (fm.data.get(key) ?? '').length === 0) {
      const sev: Severity = key === 'visibility' ? 'error' : 'warn';
      findings.push({
        file: rel,
        line: 1,
        severity: sev,
        category: key === 'visibility' ? 'visibility-invalid' : 'frontmatter-incomplete',
        message: `missing required frontmatter key: ${key}`,
      });
    }
  }
  const visibility = fm.data.get('visibility');
  if (visibility && !VISIBILITY_VALUES.has(visibility)) {
    findings.push({
      file: rel,
      line: 1,
      severity: 'error',
      category: 'visibility-invalid',
      message: `visibility must be public|internal, got "${visibility}"`,
    });
  }
  const status = fm.data.get('status');
  if (status && !STATUS_VALUES.has(status)) {
    findings.push({
      file: rel,
      line: 1,
      severity: 'warn',
      category: 'status-invalid',
      message: `status must be generated|verified|narrative, got "${status}"`,
    });
  }
  const audience = fm.data.get('audience');
  if (audience && !AUDIENCE_VALUES.has(audience)) {
    findings.push({
      file: rel,
      line: 1,
      severity: 'warn',
      category: 'audience-invalid',
      message: `audience must be user|contributor|maintainer|agent, got "${audience}"`,
    });
  }
}

function checkLinks(file: string, rel: string, content: string, findings: Finding[]): void {
  for (const { line, target } of extractInlineLinks(content)) {
    if (isExternal(target)) continue;
    // Site-absolute links (`/reference/core`, `/pro`) resolve only through the
    // docs-app router, not the filesystem. Track them separately (the docs app
    // owns route validation in its own session) rather than as filesystem breaks.
    if (target.startsWith('/')) {
      findings.push({
        file: rel,
        line,
        severity: 'warn',
        category: 'site-absolute-link',
        message: `site-absolute link resolves only in the docs app: ${target}`,
      });
      continue;
    }
    const abs = resolveTarget(file, target);
    if (abs.length === 0) continue;
    if (!fs.existsSync(abs)) {
      findings.push({
        file: rel,
        line,
        severity: 'error',
        category: 'broken-link',
        message: `link target does not exist: ${target}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');

  const docs = collectDocs();
  const findings: Finding[] = [];

  for (const file of docs) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = toPosix(path.relative(ROOT, file));
    const fm = parseFrontmatter(content);
    checkFrontmatter(rel, fm, findings);
    checkLinks(file, rel, content, findings);
  }

  const errors = findings.filter((f) => f.severity === 'error');
  const warns = findings.filter((f) => f.severity === 'warn');

  if (json) {
    console.log(JSON.stringify({ scanned: docs.length, findings }, null, 2));
  } else {
    console.log('Doc Integrity Gate');
    console.log('==================\n');
    console.log(`Docs scanned: ${docs.length}`);
    console.log(
      `Findings:     ${findings.length}  (${errors.length} error, ${warns.length} warn)\n`,
    );

    const byCategory = new Map<Category, number>();
    for (const f of findings) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
    console.log('By category:');
    for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat.padEnd(22)} ${n}`);
    }
    console.log('');

    // Broken links are the highest-signal check today — list them all.
    const brokenLinks = findings.filter((f) => f.category === 'broken-link');
    if (brokenLinks.length > 0) {
      console.log(`Broken internal links (${brokenLinks.length}):`);
      for (const f of brokenLinks) console.log(`  ${f.file}:${f.line} — ${f.message}`);
      console.log('');
    }
  }

  if (strict && errors.length > 0) process.exit(1);
}

run();
