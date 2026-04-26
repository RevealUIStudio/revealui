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
  'apps/marketing/src/components/landing',
  'apps/marketing/src/components/GetStarted.tsx',
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
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip JSX comments and import lines — they are not user-visible copy
      if (line.trim().startsWith('//') || line.trim().startsWith('import ')) continue;
      // Skip lines inside `{/* ... */}` JSX comments (single-line only; multi-line ignored)
      if (line.trim().startsWith('{/*') && line.trim().endsWith('*/}')) continue;

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
      } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
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

  console.log('Actual metrics:');
  console.log(`  Packages:      ${packages}`);
  console.log(`  Apps:          ${apps}`);
  console.log(`  Workspaces:    ${workspaces} (${packages} + ${apps})`);
  console.log(`  Test files:    ${testFiles}`);
  console.log(`  UI components: ${uiComponents}`);
  console.log(`  MCP servers:   ${mcpServers}`);
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

  // Aspirational-feature blocklist for high-visibility landing copy
  const aspirationalClaims = scanForAspirationalFeatures();

  console.log('====================');
  console.log(`Claims scanned: ${claims.length}`);
  console.log(`Mismatches:     ${mismatches}`);
  console.log(`Future-tense files scanned: ${FUTURE_TENSE_SCAN_FILES.length}`);
  console.log(`Unlinked future-tense markers: ${futureClaims.length}`);
  console.log(`Aspirational-feature scan files: ${ASPIRATIONAL_SCAN_FILES.length}`);
  console.log(`Unqualified aspirational features: ${aspirationalClaims.length}`);

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
    console.log('\nUnqualified aspirational features in landing copy:');
    for (const c of aspirationalClaims) {
      console.log(`  ${c.file}:${c.line}  "${c.token}" (${c.why})`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach blocklist token must be paired with a qualifier on the same line: "(coming soon)", "(roadmap)", "(in active development)", "(planned)", or a "Roadmap:" prefix. Or remove the claim.',
    );
  }

  if (mismatches > 0 || futureClaims.length > 0 || aspirationalClaims.length > 0) {
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
      console.log('\nFailed: unqualified aspirational features in landing copy.');
    }
    process.exit(1);
  } else {
    console.log(
      '\nAll claims match codebase reality, future-tense markers are tracked, and aspirational features are qualified.',
    );
  }
}

run();
