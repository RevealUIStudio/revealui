// console-allowed
/**
 * Claim Drift Detector
 *
 * Counts real codebase metrics (packages, apps, MCP servers, test files,
 * UI components, tables) and compares them against claims in docs and
 * marketing files. Fails on mismatch so CI catches inflated numbers.
 *
 * Usage:
 *   pnpm tsx scripts/validate/claim-drift.ts
 *   pnpm tsx scripts/validate/claim-drift.ts --fix   # show suggested fixes
 *
 * Exit codes:
 *   0 = all claims match reality
 *   1 = mismatches found
 *
 * This is a CLI script — console output is the program's purpose.
 * The `console-allowed` marker on line 1 exempts the file from the
 * no-console-log rule (per .revealui/code-standards.json).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const showFix = process.argv.includes('--fix');

// ---------------------------------------------------------------------------
// Metric collectors
// ---------------------------------------------------------------------------

interface Metric {
  name: string;
  actual: number;
  /** Regex patterns to find claims about this metric in docs */
  claimPatterns: RegExp[];
}

function countByGlob(base: string, extensions: string[]): number {
  let count = 0;
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (extensions.some((ext) => e.name.endsWith(ext))) {
        count++;
      }
    }
  }
  walk(base);
  return count;
}

function countDirs(base: string): number {
  try {
    return fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

function countPackages(): number {
  return countDirs(path.join(ROOT, 'packages'));
}

function countApps(): number {
  return countDirs(path.join(ROOT, 'apps'));
}

function countTestFiles(): number {
  return countByGlob(ROOT, ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.e2e.ts']);
}

function countUIComponents(): number {
  const compDir = path.join(ROOT, 'packages/presentation/src/components');
  if (!fs.existsSync(compDir)) return 0;
  // Each .tsx file in components/ is one component (excluding index.ts)
  try {
    return fs.readdirSync(compDir).filter((f) => f.endsWith('.tsx')).length;
  } catch {
    return 0;
  }
}

function countMCPServers(): number {
  const serversDir = path.join(ROOT, 'packages/mcp/src/servers');
  if (!fs.existsSync(serversDir)) return 0;
  try {
    return fs
      .readdirSync(serversDir)
      .filter((f) => f.endsWith('.ts') && !f.startsWith('index') && !f.startsWith('_')).length;
  } catch {
    return 0;
  }
}

function countWorkspaces(): number {
  return countPackages() + countApps();
}

/**
 * Count `pgTable(` declarations across `packages/db/src/schema/*.ts`.
 * The audit-first source of truth for "how many database tables ship".
 */
function countDbTables(): number {
  const schemaDir = path.join(ROOT, 'packages/db/src/schema');
  if (!fs.existsSync(schemaDir)) return 0;
  let total = 0;
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
        let content: string;
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        // Match standalone `pgTable(` calls (not inside a comment block start)
        const matches = content.match(/pgTable\s*\(/g);
        if (matches) total += matches.length;
      }
    }
  }
  walk(schemaDir);
  return total;
}

// ---------------------------------------------------------------------------
// Claim scanner
// ---------------------------------------------------------------------------

interface ClaimMatch {
  file: string;
  line: number;
  text: string;
  claimed: number;
  metricName: string;
}

const SCAN_DIRS = [
  'docs',
  'apps/marketing/src',
  'README.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'scripts/setup',
  'packages/mcp/README.md',
  'packages/mcp/docs',
];

/** Historical documents where counts were accurate at time of writing */
const EXCLUDE_FILES = ['docs/system-tune/CRASH-POSTMORTEMS.md'];

function scanForClaims(metrics: Metric[]): ClaimMatch[] {
  const matches: ClaimMatch[] = [];

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath);
    if (EXCLUDE_FILES.includes(rel)) return;

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const metric of metrics) {
        for (const pattern of metric.claimPatterns) {
          const match = pattern.exec(line);
          if (match) {
            const claimed = parseInt(match[1], 10);
            if (!Number.isNaN(claimed) && claimed > 0) {
              matches.push({
                file: path.relative(ROOT, filePath),
                line: i + 1,
                text: line.trim(),
                claimed,
                metricName: metric.name,
              });
            }
          }
        }
      }
    }
  }

  function scanPath(p: string): void {
    const full = path.join(ROOT, p);
    try {
      const stat = fs.statSync(full);
      if (
        stat.isFile() &&
        (full.endsWith('.md') || full.endsWith('.ts') || full.endsWith('.tsx'))
      ) {
        scanFile(full);
      } else if (stat.isDirectory()) {
        walkAndScan(full);
      }
    } catch {
      // path doesn't exist, skip
    }
  }

  function walkAndScan(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walkAndScan(full);
      } else if (e.name.endsWith('.md') || e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
        scanFile(full);
      }
    }
  }

  for (const p of SCAN_DIRS) {
    scanPath(p);
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Future-tense claim scanner (CR9-P2-02)
//
// Enforces the CONTRIBUTING.md convention: every parenthetical future-tense
// marker — "(coming soon)", "(planned)", "(roadmap)", "(TBD)", "(forthcoming)",
// "(will ship)", "(in progress)" — must cite a tracker on the same line:
// a GitHub issue/PR number (`#123`), issues/pulls URL, `milestone` reference,
// or workflow file (`*.yml` / `*.yaml`).
//
// Scope is narrow by design (high-visibility surfaces only). Expand as
// remaining CR9-P1-05 audit passes close.
// ---------------------------------------------------------------------------

interface FutureClaimMatch {
  file: string;
  line: number;
  marker: string;
  text: string;
}

/** Files scanned for unlinked future-tense markers. */
const FUTURE_TENSE_SCAN_FILES = ['README.md', 'CLAUDE.md', 'docs/ROADMAP.md', 'docs/PRO.md'];

const FUTURE_TENSE_PATTERN =
  /\((coming soon|planned|roadmap|TBD|forthcoming|will ship|in progress)\b[^)]*\)/i;

const TRACKER_PATTERN = /(#\d+|\/(issues|pull|pulls)\/\d+|\bmilestones?\b|\.ya?ml\b)/i;

function scanForFutureTenseClaims(): FutureClaimMatch[] {
  const matches: FutureClaimMatch[] = [];

  for (const rel of FUTURE_TENSE_SCAN_FILES) {
    const full = path.join(ROOT, rel);
    let content: string;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track fenced code blocks and skip their contents
      if (line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Skip markdown headings (section labels, not feature claims)
      if (/^#{1,6}\s/.test(line)) continue;

      const match = FUTURE_TENSE_PATTERN.exec(line);
      if (!match) continue;

      // Pass if the line cites a tracker (issue, PR, milestone, workflow)
      if (TRACKER_PATTERN.test(line)) continue;

      matches.push({
        file: rel,
        line: i + 1,
        marker: match[0],
        text: line.trim(),
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Aspirational-feature blocklist (PR D)
//
// High-visibility marketing-copy files (the landing page + GetStarted CTA)
// must NOT name features that don't ship today unless paired with a qualifier
// on the same line. The list is hand-maintained from the
// marketing-claims-2026-04-25 internal honesty audit.
//
// Each blocklist token is checked case-insensitively. A token is allowed if
// the line also contains any QUALIFIER pattern (e.g. "(coming soon)",
// "(roadmap)", "Roadmap:", or a github issue/PR link).
//
// Add/remove tokens here when feature reality changes — when "managed
// hosting" actually ships, for example, drop it from BLOCKLIST.
// ---------------------------------------------------------------------------

interface AspirationalMatch {
  file: string;
  line: number;
  token: string;
  why: string;
  text: string;
}

/** Files scanned for aspirational features without qualifiers. */
const ASPIRATIONAL_SCAN_FILES = [
  // Marketing surfaces (existing — marketing-claims-2026-04-25)
  'apps/marketing/src/components/landing',
  'apps/marketing/src/components/GetStarted.tsx',
  // Docs surfaces (PR-D continuation, docs-claims-2026-04-26)
  // High-visibility orientation + tutorial pages where the same blocklist applies.
  // Deeper technical docs (AI.md, DATABASE.md, etc.) are tuned in a follow-up.
  'docs/INDEX.md',
  'docs/BUILD_YOUR_BUSINESS.md',
  'docs/EXAMPLES.md',
  'docs/QUICK_START.md',
  'docs/SUITE.md',
  // Pro tier surface (paying-customer eyes)
  'apps/docs/public/docs-pro/index.md',
  'apps/docs/public/docs-pro/ai/index.md',
  'apps/docs/public/docs-pro/inference/index.md',
  'apps/docs/public/docs-pro/mcp/index.md',
  'apps/docs/public/docs-pro/editors/index.md',
];

interface BlocklistEntry {
  /** Word/phrase that misleads when shipped without a qualifier. */
  token: RegExp;
  /** Human-readable label printed when matched. */
  label: string;
  /** Why this is blocklisted — printed alongside the failure. */
  why: string;
}

const BLOCKLIST: BlocklistEntry[] = [
  {
    token: /\bmanaged hosting\b/i,
    label: 'managed hosting',
    why: 'no managed-hosting service ships today',
  },
  {
    token: /\bauto-scal(e|ing)\b/i,
    label: 'auto-scaling',
    why: 'no managed platform offers auto-scaling',
  },
  {
    token: /\bdunning\b/i,
    label: 'dunning',
    why: 'not implemented; only in stripe-best-practices guidance',
  },
  {
    token: /\b(SSO|single sign-on)\b/i,
    label: 'SSO',
    why: 'sso marked planned in packages/core/src/features.ts',
  },
  {
    token: /\bSCIM\b/i,
    label: 'SCIM',
    why: 'SCIM provisioning not in code',
  },
  {
    token: /\bon-prem\b/i,
    label: 'on-prem',
    why: 'forge docker images not yet published to GHCR',
  },
  {
    token: /\bair-gapped\b/i,
    label: 'air-gapped',
    why: 'no documented air-gap deploy path',
  },
  {
    token: /\bRAG\b/,
    label: 'RAG',
    why: 'gated on Ollama+pgvector setup, not reachable in default flow',
  },
  {
    token: /\bSLA\b/,
    label: 'SLA',
    why: 'no SLA documented in docs/',
  },
];

/**
 * A line is allowed if it contains any qualifier signal:
 *   - parenthetical markers: "(coming soon)", "(planned)", "(roadmap)",
 *     "(in active development)", "(forthcoming)", "(will ship)",
 *     "(in progress)", "(TBD)"
 *   - the bare word "roadmap" anywhere (case-insensitive) — covers both
 *     "Roadmap: X" prefixes and "X is on the roadmap" framing
 *   - a tracker citation (#NNN / issues|pull|pulls URL / .yml workflow /
 *     `milestone`)
 */
const QUALIFIER_PATTERN =
  /\((coming soon|planned|roadmap|in active development|forthcoming|will ship|in progress|TBD)\b[^)]*\)|\broadmap\b|(#\d+|\/(issues|pull|pulls)\/\d+|\bmilestones?\b|\.ya?ml\b)/i;

function scanForAspirationalFeatures(): AspirationalMatch[] {
  const matches: AspirationalMatch[] = [];

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const isMarkdown = filePath.endsWith('.md');
    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Markdown fenced code blocks: skip — examples, env-var snippets, JSON, etc.
      if (isMarkdown && line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Markdown blockquote prefixes are user-visible — DON'T skip them
      // (banner notes like "> SSO is on the roadmap" must still qualify)

      // TS/TSX-only skips: JSX comments and import lines are not user-visible copy
      if (!isMarkdown) {
        if (line.trim().startsWith('//') || line.trim().startsWith('import ')) continue;
        if (line.trim().startsWith('{/*') && line.trim().endsWith('*/}')) continue;
      }

      for (const entry of BLOCKLIST) {
        if (!entry.token.test(line)) continue;
        if (QUALIFIER_PATTERN.test(line)) continue;
        matches.push({
          file: rel,
          line: i + 1,
          token: entry.label,
          why: entry.why,
          text: line.trim(),
        });
      }
    }
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts') || e.name.endsWith('.md')) {
        scanFile(full);
      }
    }
  }

  for (const rel of ASPIRATIONAL_SCAN_FILES) {
    const full = path.join(ROOT, rel);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) {
        scanFile(full);
      } else if (stat.isDirectory()) {
        walk(full);
      }
    } catch {
      // path missing, skip
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Suite-product attribution gate (PR-D, docs-claims-2026-04-26)
//
// The RevealUI Studio Suite is eight separate products (RevealUI, RevDev,
// RevVault, RevCon, RevealCoin, Forge, RevSkills, RevKit). When a docs
// page that belongs to RevealUI itself names another suite product, it
// must either:
//   - link to /docs/SUITE or /docs/suite/<name>
//   - include explicit "(separate product …)" / "RevealUIStudio/<repo>"
//     attribution on the same line
//   - live in an allowlisted file (the suite map itself, the per-product
//     pages, FORGE.md which is the canonical Forge page).
//
// Without this, mentions of "Studio" / "RevVault" / "RevCon" / etc. across
// docs/PRO.md and similar pages routinely drift into "Pro tier features
// of RevealUI" framing, when in reality they're shipped from sibling repos.
// ---------------------------------------------------------------------------

interface SuiteProductMatch {
  file: string;
  line: number;
  product: string;
  text: string;
}

/**
 * Files in scope for the suite-attribution gate. Initial coverage is
 * deliberately narrow — tutorial pages + the rewritten Pro MCP page
 * where existing attribution is clean enough that the gate doesn't
 * trip on legacy text.
 *
 * Wider coverage (INDEX.md, PRO.md, MARKETPLACE.md, docs-pro/index,
 * docs-pro/{ai,inference,editors}/index.md, ROADMAP.md, blog posts,
 * VAUGHN.md, SECRETS.md, REST API reference) is queued for follow-up
 * PRs after the remaining attribution in those files is tightened.
 * The honesty audit at `~/suite/.jv/docs/audits/docs-claims-2026-04-26.md`
 * tracks the coverage queue.
 */
const SUITE_ATTRIBUTION_SCAN_FILES = [
  'docs/BUILD_YOUR_BUSINESS.md',
  'docs/EXAMPLES.md',
  'docs/QUICK_START.md',
  'apps/docs/public/docs-pro/mcp/index.md',
];

/**
 * Files that ARE the canonical home for naming suite products. They can
 * mention products without per-line attribution because the whole file is
 * the attribution.
 */
const SUITE_ATTRIBUTION_ALLOWLIST = new Set<string>([
  'docs/SUITE.md',
  'docs/FORGE.md', // canonical Forge product page
]);

/** Per-product pages all live under `docs/suite/`. Allowlist by prefix. */
const SUITE_ATTRIBUTION_ALLOWLIST_PREFIXES = ['docs/suite/'];

/**
 * Product tokens. The pattern matches each as a standalone word (case-
 * sensitive — these are proper nouns) so it doesn't fire on "studio"
 * mid-sentence. `@revealui/editors` is special-cased because the package
 * doesn't actually exist (lives in revcon).
 *
 * `Studio` uses a negative lookbehind to avoid firing on "RevealUI
 * Studio" — that's the company name, not the desktop app. The Studio
 * desktop-app references typically appear as "Studio desktop app",
 * "Studio dashboard", "Studio (Tauri)", etc.
 */
const SUITE_PRODUCTS: { token: RegExp; label: string }[] = [
  { token: /(?<!RevealUI\s)\bStudio\b/, label: 'Studio (lives in RevDev, not the company name)' },
  { token: /\bRevVault\b/, label: 'RevVault (separate suite product)' },
  { token: /\bRevCon\b/, label: 'RevCon (separate suite product)' },
  { token: /\bRevealCoin\b/, label: 'RevealCoin (separate suite product)' },
  { token: /\bRevDev\b/, label: 'RevDev (separate suite product)' },
  { token: /\bRevSkills\b/, label: 'RevSkills (separate suite product)' },
  { token: /\bRevKit\b/, label: 'RevKit (separate suite product)' },
  { token: /@revealui\/editors\b/, label: '@revealui/editors (does not exist; ships in RevCon)' },
];

/**
 * A line is allowed if it cites the suite map, links to a per-product
 * page, names the source repo, or includes an explicit attribution
 * phrase. Multiple acceptance patterns — order doesn't matter.
 */
const SUITE_ATTRIBUTION_QUALIFIER = new RegExp(
  [
    // Direct links to suite map or per-product pages (absolute or relative)
    String.raw`\/docs\/SUITE`,
    String.raw`\/docs\/suite\/`,
    String.raw`\.\/SUITE\.md\b`,
    String.raw`\.\/suite\/`,
    String.raw`\.\.\/SUITE\.md\b`,
    String.raw`\.\.\/suite\/`,
    // Source-repo mentions (canonical attribution)
    String.raw`RevealUIStudio\/(revvault|revcon|revealcoin|revdev|revskills|revkit|forge|editor-configs)`,
    // Explicit attribution phrases (non-greedy spans permit markdown bold etc.)
    String.raw`\bseparate.{0,30}(?:product|repo|suite|kit|app)\b`,
    String.raw`\bships in.{0,40}(?:product|repo|suite|kit|app|RevDev|RevVault|RevCon|RevealCoin|RevSkills|RevKit|Forge)\b`,
    String.raw`\bcompanion product`,
    String.raw`\bRevealUI Studio Suite`,
    String.raw`\blives in.{0,30}(?:RevDev|RevVault|RevCon|RevealCoin|RevSkills|RevKit|Forge|monorepo|repo)\b`,
    String.raw`\bsee (?:\[|\*\*)?(?:RevDev|RevVault|RevCon|RevealCoin|RevSkills|RevKit|Forge|Suite)`,
    String.raw`\bintentionally decoupled\b`,
    String.raw`\bnot yet shipped\b`,
    // Forge tier / kit phrasings (Forge is both a product and a tier)
    String.raw`Forge \(Enterprise\)`,
    'Forge tier',
    'Forge Edition',
    'Forge kit',
    'Forge guide',
  ].join('|'),
  'i',
);

function scanForSuiteProductLeaks(): SuiteProductMatch[] {
  const matches: SuiteProductMatch[] = [];

  function isAllowlisted(rel: string): boolean {
    if (SUITE_ATTRIBUTION_ALLOWLIST.has(rel)) return true;
    return SUITE_ATTRIBUTION_ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix));
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    if (isAllowlisted(rel)) return;
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip fenced code (env templates, command blocks, etc.)
      if (line.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      // Skip frontmatter delimiters and YAML-shaped lines (title:, etc.)
      // — frontmatter is not customer-visible prose
      if (i < 20 && (line === '---' || /^[a-zA-Z_][a-zA-Z0-9_-]*:\s/.test(line))) continue;

      for (const product of SUITE_PRODUCTS) {
        if (!product.token.test(line)) continue;
        if (SUITE_ATTRIBUTION_QUALIFIER.test(line)) continue;
        matches.push({
          file: rel,
          line: i + 1,
          product: product.label,
          text: line.trim(),
        });
      }
    }
  }

  for (const rel of SUITE_ATTRIBUTION_SCAN_FILES) {
    const full = path.join(ROOT, rel);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) scanFile(full);
    } catch {
      // path missing, skip
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// $RVUI internal-ticker leak guard (PR-D, docs-claims-2026-04-26)
//
// `$RVUI` is the INTERNAL codename for the RevealCoin token. The customer-
// facing on-chain ticker is `RVC`. Public docs (docs.revealui.com) must
// use `RVC`; the dollar-sign-prefixed internal form must never leak.
//
// Lowercase route slugs like `/api/billing/rvui-payment` are fine — those
// are code constants on the API, not customer-visible labels. This guard
// catches the explicit `$RVUI` form only.
// ---------------------------------------------------------------------------

interface RvuiLeakMatch {
  file: string;
  line: number;
  text: string;
}

const RVUI_LEAK_PATTERN = /\$RVUI\b/;

/**
 * Files allowed to mention `$RVUI` because they explicitly explain the
 * boundary between the internal codename and the customer-facing `RVC`
 * ticker.
 */
const RVUI_LEAK_ALLOWLIST = new Set<string>([
  'docs/SUITE.md',
  'docs/suite/revealcoin.md',
  // The REST API reference cites the internal route slug (`rvui-payment`)
  // and provides the explicit RVUI-vs-RVC boundary note customers need.
  'docs/api/rest-api/README.md',
]);

function scanForRvuiTickerLeaks(): RvuiLeakMatch[] {
  const matches: RvuiLeakMatch[] = [];

  function isAllowlisted(rel: string): boolean {
    return RVUI_LEAK_ALLOWLIST.has(rel) || rel.startsWith('docs/suite/revealcoin');
  }

  function scanFile(filePath: string): void {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    if (isAllowlisted(rel)) return;
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (RVUI_LEAK_PATTERN.test(line)) {
        matches.push({
          file: rel,
          line: i + 1,
          text: line.trim(),
        });
      }
    }
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith('.md')) {
        scanFile(full);
      }
    }
  }

  walk(path.join(ROOT, 'docs'));
  walk(path.join(ROOT, 'apps/docs/public/docs-pro'));

  return matches;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  console.log('Claim Drift Detector');
  console.log('====================\n');

  // Collect actual metrics
  const packages = countPackages();
  const apps = countApps();
  const workspaces = countWorkspaces();
  const testFiles = countTestFiles();
  const uiComponents = countUIComponents();
  const mcpServers = countMCPServers();
  const dbTables = countDbTables();

  console.log('Actual metrics:');
  console.log(`  Packages:      ${packages}`);
  console.log(`  Apps:          ${apps}`);
  console.log(`  Workspaces:    ${workspaces} (${packages} + ${apps})`);
  console.log(`  Test files:    ${testFiles}`);
  console.log(`  UI components: ${uiComponents}`);
  console.log(`  MCP servers:   ${mcpServers}`);
  console.log(`  DB tables:     ${dbTables}`);
  console.log();

  const metrics: Metric[] = [
    {
      name: 'packages',
      actual: packages,
      claimPatterns: [
        // "21 packages" or "21 npm packages" but not "14 packages patched" or "3 packages"
        /\b(1\d|2\d|3\d)\s*(?:npm\s+)?packages?\b(?!\s+patched)/i,
        /\b(\d+)\s*packages?\s+(?:published|on npm)/i,
      ],
    },
    {
      name: 'workspaces',
      actual: workspaces,
      claimPatterns: [/\b(\d+)\s*workspaces?\b/i],
    },
    {
      name: 'test files',
      actual: testFiles,
      claimPatterns: [
        // "1,676 test files" or "938 test files" — must be > 100 to avoid small mentions
        /\b(\d[\d,]+)\s*test\s*files?\b/i,
      ],
    },
    {
      name: 'UI components',
      actual: uiComponents,
      claimPatterns: [
        // Only match claims about total component count (50+), not per-category
        /\b(5[0-9]|6[0-9])\s*(?:native\s+)?(?:React\s+)?(?:UI\s+)?components?\b/i,
        /\b(5[0-9]|6[0-9])\s*components?\s+(?:with|built|in the)/i,
      ],
    },
    {
      name: 'MCP servers',
      actual: mcpServers,
      claimPatterns: [/\b(\d+)\s*MCP\s*[Ss]ervers?\b/i],
    },
    {
      name: 'DB tables',
      actual: dbTables,
      claimPatterns: [
        // "85 tables", "85 PostgreSQL tables", "85 database tables", "85 Drizzle tables"
        // Constrain to plausible totals (10..199) to avoid mid-doc small-number noise
        /\b([1-9]\d{1,2})\s+(?:PostgreSQL\s+|database\s+|Drizzle\s+|primary\s+)?tables?\b/i,
        // "Schema (85 tables)" parenthetical
        /\(\s*([1-9]\d{1,2})\s+tables?\s*\)/i,
      ],
    },
  ];

  // Scan for claims
  const claims = scanForClaims(metrics);

  // Compare
  let mismatches = 0;
  const seen = new Set<string>();

  for (const claim of claims) {
    const metric = metrics.find((m) => m.name === claim.metricName);
    if (!metric) continue;

    const claimed = claim.claimed;

    // Skip small numbers that are likely not total-count claims
    if (claim.metricName === 'test files' && claimed < 100) continue;
    if (claim.metricName === 'packages' && claimed < 10) continue;

    // For test files, allow ±100 drift (files get added/removed frequently)
    const tolerance = claim.metricName === 'test files' ? 100 : 0;
    const drift = Math.abs(claimed - metric.actual);

    if (drift > tolerance && claimed !== metric.actual) {
      const key = `${claim.file}:${claim.line}:${claim.metricName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      mismatches++;
      const direction = claimed > metric.actual ? 'INFLATED' : 'UNDERSTATED';
      console.log(`  DRIFT  ${claim.file}:${claim.line}`);
      console.log(
        `         ${claim.metricName}: claims ${claimed}, actual ${metric.actual} (${direction})`,
      );
      console.log(`         ${claim.text.substring(0, 120)}`);
      if (showFix) {
        console.log(`         Fix: replace ${claimed} with ${metric.actual}`);
      }
      console.log();
    }
  }

  // Future-tense claim check (CR9-P2-02)
  const futureClaims = scanForFutureTenseClaims();

  // Aspirational-feature blocklist for high-visibility landing + docs copy
  const aspirationalClaims = scanForAspirationalFeatures();

  // Suite-product attribution gate (PR-D)
  const suiteLeaks = scanForSuiteProductLeaks();

  // $RVUI internal-ticker leak guard (PR-D)
  const rvuiLeaks = scanForRvuiTickerLeaks();

  console.log('====================');
  console.log(`Claims scanned: ${claims.length}`);
  console.log(`Mismatches:     ${mismatches}`);
  console.log(`Future-tense files scanned: ${FUTURE_TENSE_SCAN_FILES.length}`);
  console.log(`Unlinked future-tense markers: ${futureClaims.length}`);
  console.log(`Aspirational-feature scan files: ${ASPIRATIONAL_SCAN_FILES.length}`);
  console.log(`Unqualified aspirational features: ${aspirationalClaims.length}`);
  console.log(`Unattributed suite-product mentions: ${suiteLeaks.length}`);
  console.log(`Internal $RVUI ticker leaks: ${rvuiLeaks.length}`);

  if (futureClaims.length > 0) {
    console.log('\nUnlinked future-tense claims (convention: CONTRIBUTING.md):');
    for (const c of futureClaims) {
      console.log(`  ${c.file}:${c.line}  ${c.marker}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEvery future-tense marker must cite a tracker: issue/PR number, milestone, or workflow file.',
    );
  }

  if (aspirationalClaims.length > 0) {
    console.log('\nUnqualified aspirational features:');
    for (const c of aspirationalClaims) {
      console.log(`  ${c.file}:${c.line}  "${c.token}" (${c.why})`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach blocklist token must be paired with a qualifier on the same line: "(coming soon)", "(roadmap)", "(in active development)", "(planned)", or a "Roadmap:" prefix. Or remove the claim.',
    );
  }

  if (suiteLeaks.length > 0) {
    console.log('\nSuite-product mentions without attribution:');
    for (const c of suiteLeaks) {
      console.log(`  ${c.file}:${c.line}  ${c.product}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach suite-product mention must either link to /docs/SUITE or /docs/suite/<name>, name the source repo (RevealUIStudio/<repo>), or include a "(separate product)" attribution. The Suite Map and per-product pages under /docs/suite/ are allowlisted.',
    );
  }

  if (rvuiLeaks.length > 0) {
    console.log('\n$RVUI internal-codename leaks (must use customer-facing RVC):');
    for (const c of rvuiLeaks) {
      console.log(`  ${c.file}:${c.line}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nThe internal codename `$RVUI` must not appear in public docs. Use `RVC` (the customer-facing on-chain ticker). Lowercase route slugs like `/api/billing/rvui-payment` are fine.',
    );
  }

  const anyFailures =
    mismatches > 0 ||
    futureClaims.length > 0 ||
    aspirationalClaims.length > 0 ||
    suiteLeaks.length > 0 ||
    rvuiLeaks.length > 0;

  if (anyFailures) {
    if (mismatches > 0) {
      console.log('\nFailed: claims do not match codebase reality.');
      if (!showFix) {
        console.log('Run with --fix to see suggested corrections.');
      }
    }
    if (futureClaims.length > 0) {
      console.log('\nFailed: unlinked future-tense claims.');
    }
    if (aspirationalClaims.length > 0) {
      console.log('\nFailed: unqualified aspirational features.');
    }
    if (suiteLeaks.length > 0) {
      console.log('\nFailed: suite-product mentions without attribution.');
    }
    if (rvuiLeaks.length > 0) {
      console.log('\nFailed: $RVUI internal-codename leaks in public docs.');
    }
    process.exit(1);
  } else {
    console.log(
      '\nAll claims match codebase reality, future-tense markers are tracked, aspirational features are qualified, suite products are attributed, and no $RVUI ticker leaks were found.',
    );
  }
}

run();
