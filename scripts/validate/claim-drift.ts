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

const SCAN_DIRS = ['docs', 'apps/marketing/src', 'README.md', 'CLAUDE.md', 'scripts/setup'];

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

  console.log('====================');
  console.log(`Claims scanned: ${claims.length}`);
  console.log(`Mismatches:     ${mismatches}`);

  if (mismatches > 0) {
    console.log('\nFailed: claims do not match codebase reality.');
    if (!showFix) {
      console.log('Run with --fix to see suggested corrections.');
    }
    process.exit(1);
  } else {
    console.log('\nAll claims match codebase reality.');
  }
}

run();
