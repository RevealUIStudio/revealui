// console-allowed
/**
 * Apply Frontmatter
 *
 * Idempotent migration that ensures every in-scope doc carries the required
 * frontmatter from docs/internal/documentation-system.md: title, description,
 * visibility, status, audience.
 *
 * Visibility is classified by path (conservative: defaults to `internal`, since
 * under-publishing is safe and the public-doc leak guard is the real backstop).
 * Existing frontmatter keys are never overwritten — only missing keys are
 * inserted — so this is safe to re-run and safe over hand-curated frontmatter.
 *
 * No authored regex (M2 hardline).
 *
 * Usage:
 *   pnpm tsx scripts/docs/apply-frontmatter.ts --dry-run   # report only
 *   pnpm tsx scripts/docs/apply-frontmatter.ts             # write
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

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
  // Not doc-system docs: changesets carry their own tooling format; .claude
  // holds ephemeral coordination state.
  '.changeset',
  '.claude',
]);
const EXCLUDE_PREFIXES = ['apps/docs/'];
const DOC_EXTENSIONS = ['.md', '.mdx'];

// Changesets-owned package changelogs are machine files, not doc-system docs:
// @changesets/apply-release-plan prepends each new version section by
// replacing the file's FIRST newline, so any leading frontmatter block gets
// new sections injected inside it (the 2026-06-12 version run, #1377,
// corrupted 18 of the 24 package changelogs stamped by the #1293 sweep). The
// inverse is CI-enforced by scripts/validate/changelog-format.ts: these files
// must start with their `# <package>` H1, never frontmatter.
function isChangesetsChangelog(rel: string): boolean {
  const parts = rel.split('/');
  return parts.length === 3 && parts[0] === 'packages' && parts[2] === 'CHANGELOG.md';
}

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
        const rel = toPosix(path.relative(ROOT, path.join(dir, e.name)));
        if (EXCLUDE_PREFIXES.some((pre) => rel.startsWith(pre))) continue;
        if (isChangesetsChangelog(rel)) continue;
        out.push(path.join(dir, e.name));
      }
    }
  }
  walk(ROOT);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Classification (path-based, derived from the 2026-06-08 doc audit)
// ---------------------------------------------------------------------------

/** docs/<NAME>.md files that are internal (ops, business, strategy, secrets). */
const INTERNAL_DOCS_ROOT = new Set([
  'MASTER_PLAN',
  'SECRETS',
  'STANDARDS',
  'AUDIT_STATUS',
  'COMMERCIAL_READINESS',
  'MARKETING_METRICS',
  'CI_CD_GUIDE',
  'PUBLISHING',
  'PERFORMANCE',
  'AUTOMATION',
  'AI-AGENT-RULES',
  'LAUNCH-CHECKLIST',
  'CREDENTIAL-ROTATION-RUNBOOK',
  'DEPLOYMENT-RUNBOOK',
  'runbook-agent-dispatch-flag',
  'glossary',
  'methodology',
  'TYPE-SYSTEM-RULES',
  'LINTING_RULES',
  'SCRIPT_MANAGEMENT',
]);

const ROOT_PUBLIC = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  'AGENTS.md',
]);

const PUBLIC_DOCS_SUBDIRS = [
  'docs/guides/',
  'docs/ai/',
  'docs/api/',
  'docs/decisions/',
  'docs/fleet/',
  'docs/blog/',
];

function isPublic(rel: string): boolean {
  if (ROOT_PUBLIC.has(rel)) return true;
  if (rel === 'packages/PACKAGE-CONVENTIONS.md') return true;
  if (rel.startsWith('examples/')) return true;
  if (rel.startsWith('packages/mcp/docs/') || rel.startsWith('packages/mcp/configs/')) return true;
  if (rel === 'docs/architecture/x402.md') return false; // internal: revvault paths
  if (rel.startsWith('docs/architecture/')) return true; // public ADRs
  if (PUBLIC_DOCS_SUBDIRS.some((p) => rel.startsWith(p))) return true;

  const parts = rel.split('/');
  // docs/<NAME>.md (no subdir): public unless on the internal list
  if (parts.length === 2 && parts[0] === 'docs') {
    const name = parts[1].endsWith('.md') ? parts[1].slice(0, -3) : parts[1];
    return !INTERNAL_DOCS_ROOT.has(name);
  }
  // packages/<pkg>/README.md: public (npm). Deeper package docs (src/**,
  // docs/**, systemd/**, design-context/**) are internal. Package
  // CHANGELOG.md files are changesets-owned and out of scope entirely
  // (see isChangesetsChangelog).
  if (parts.length === 3 && parts[0] === 'packages' && parts[2] === 'README.md') {
    return true;
  }
  return false;
}

function classifyStatus(rel: string): string {
  if (rel === 'docs/api/rest-api/README.md') return 'generated';
  if (rel.startsWith('packages/presentation/design-context/')) return 'generated';
  if (rel.startsWith('docs/blog/') || rel.startsWith('docs/archive/')) return 'narrative';
  // Only the root keep-a-changelog file: packages/*/CHANGELOG.md are
  // changesets-owned and excluded from scope (see isChangesetsChangelog).
  if (rel === 'CHANGELOG.md') return 'narrative';
  return 'verified';
}

function classifyAudience(rel: string, visibility: string): string {
  if (
    rel.startsWith('docs/agent-rules/') ||
    rel.startsWith('.revealui/skills/') ||
    rel === 'AGENTS.md' ||
    rel === 'CLAUDE.md' ||
    rel === '.github/copilot-instructions.md'
  ) {
    return 'agent';
  }
  if (
    rel === 'CONTRIBUTING.md' ||
    rel.endsWith('/CONTRIBUTING.md') ||
    rel.startsWith('scripts/') ||
    rel === 'packages/PACKAGE-CONVENTIONS.md'
  ) {
    return 'contributor';
  }
  return visibility === 'internal' ? 'maintainer' : 'user';
}

// ---------------------------------------------------------------------------
// Frontmatter parse + insert (no regex)
// ---------------------------------------------------------------------------

function existingKeys(content: string): { keys: Set<string>; hasBlock: boolean; openLen: number } {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return { keys: new Set(), hasBlock: false, openLen: 0 };
  const keys = new Set<string>();
  let i = 1;
  for (; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === '---') break;
    const line = lines[i] ?? '';
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    const colon = line.indexOf(':');
    if (colon > 0) keys.add(line.slice(0, colon).trim());
  }
  const hasBlock = i < lines.length;
  return { keys, hasBlock, openLen: lines[0]?.length ?? 3 };
}

function firstHeading(content: string): string | null {
  for (const line of content.split('\n')) {
    if (line.startsWith('# ')) return line.slice(2).trim();
  }
  return null;
}

function firstParagraph(content: string): string | null {
  const lines = content.split('\n');
  let i = 0;
  // skip a frontmatter block
  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && (lines[i] ?? '').trim() !== '---') i++;
    i++;
  }
  let inFence = false;
  for (; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.length === 0) continue;
    if (
      line.startsWith('#') ||
      line.startsWith('>') ||
      line.startsWith('-') ||
      line.startsWith('|') ||
      line.startsWith('![') ||
      line.startsWith('<')
    )
      continue;
    return line;
  }
  return null;
}

function collapseWhitespace(value: string): string {
  let out = '';
  let prevSpace = false;
  for (const ch of value) {
    const isSpace = ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    if (isSpace) {
      if (!prevSpace) out += ' ';
      prevSpace = true;
    } else {
      out += ch;
      prevSpace = false;
    }
  }
  return out.trim();
}

function stripDocExt(name: string): string {
  if (name.endsWith('.mdx')) return name.slice(0, -4);
  if (name.endsWith('.md')) return name.slice(0, -3);
  return name;
}

function yamlScalar(value: string): string {
  const trimmed = collapseWhitespace(value);
  const safe = trimmed.split('"').join("'");
  return `"${safe.length > 180 ? `${safe.slice(0, 177)}...` : safe}"`;
}

interface Plan {
  rel: string;
  visibility: string;
  add: string[]; // frontmatter lines to insert
}

function planFile(file: string): Plan | null {
  const rel = toPosix(path.relative(ROOT, file));
  const content = fs.readFileSync(file, 'utf8');
  const { keys } = existingKeys(content);

  const visibility = isPublic(rel) ? 'public' : 'internal';
  const status = classifyStatus(rel);
  const audience = classifyAudience(rel, visibility);

  const desired: Array<[string, string]> = [];
  if (!keys.has('title')) {
    const h = firstHeading(content);
    desired.push(['title', yamlScalar(h ?? stripDocExt(rel.split('/').pop() ?? rel))]);
  }
  if (!keys.has('description')) {
    const p = firstParagraph(content) ?? firstHeading(content) ?? rel;
    desired.push(['description', yamlScalar(p)]);
  }
  if (!keys.has('visibility')) desired.push(['visibility', visibility]);
  if (!keys.has('status')) desired.push(['status', status]);
  if (!keys.has('audience')) desired.push(['audience', audience]);

  if (desired.length === 0) return null;
  const add = desired.map(([k, v]) => `${k}: ${v}`);
  return { rel, visibility, add };
}

function applyPlan(file: string, plan: Plan): void {
  const content = fs.readFileSync(file, 'utf8');
  const { hasBlock } = existingKeys(content);
  if (hasBlock) {
    const nl = content.indexOf('\n');
    const head = content.slice(0, nl + 1); // "---\n"
    const rest = content.slice(nl + 1);
    fs.writeFileSync(file, `${head}${plan.add.join('\n')}\n${rest}`);
  } else {
    fs.writeFileSync(file, `---\n${plan.add.join('\n')}\n---\n\n${content}`);
  }
}

function run(): void {
  const dryRun = process.argv.includes('--dry-run');
  const docs = collectDocs();
  const plans: Plan[] = [];
  for (const file of docs) {
    const p = planFile(file);
    if (p) plans.push(p);
  }

  const pub = plans.filter((p) => p.visibility === 'public').length;
  const internal = plans.filter((p) => p.visibility === 'internal').length;
  console.log(`Apply Frontmatter ${dryRun ? '(dry run)' : ''}`);
  console.log('='.repeat(40));
  console.log(`Docs scanned:   ${docs.length}`);
  console.log(`Need changes:   ${plans.length}`);
  console.log(`  -> public:    ${pub}`);
  console.log(`  -> internal:  ${internal}`);
  console.log('');

  if (dryRun) {
    for (const p of plans)
      console.log(`  ${p.visibility.padEnd(8)} ${p.rel}  (+${p.add.length} keys)`);
    return;
  }
  for (const file of docs) {
    const p = planFile(file);
    if (p) applyPlan(file, p);
  }
  console.log(`✓ Updated ${plans.length} files`);
}

run();
