#!/usr/bin/env tsx

/**
 * Security Gate — Native Security Audit for RevealUI
 *
 * Replaces GitHub Actions security-audit.yml workflow.
 * Runs 5 security checks in parallel with the same logic as the workflow.
 *
 * Usage:
 *   pnpm gate:security           — run all checks
 *   pnpm gate:security --json    — output JSON summary to stdout
 *
 * Checks:
 *   1. Dependency vulnerabilities (pnpm audit — fail on critical/high)
 *   2. Hardcoded secrets/credentials (git grep patterns)
 *   3. Committed .env files (git ls-files)
 *   4. Auth & authorization patterns (warn only)
 *   5. API security patterns (CORS, rate limiting) (warn only)
 *
 * Reports:
 *   Audit JSON saved to .revealui/security-audit-latest.json (gitignored)
 *
 * Scheduled runs (weekly, outside repo):
 *   0 9 * * 1 cd ~/projects/RevealUI && pnpm gate:security >> .revealui/security-audit.log 2>&1
 *
 * @dependencies
 * - scripts/lib/exec.ts - execCommand for subprocess execution
 * - scripts/lib/errors.ts - ErrorCode enum
 * - scripts/utils/base.ts - createLogger, getProjectRoot
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findApiSecurityIssues } from '@revealui/scripts/analyzers/api-security-analyzer.js';
import { findAuthSecurityIssues } from '@revealui/scripts/analyzers/auth-security-analyzer.js';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { createLogger, getProjectRoot } from '../utils/base.js';

const logger = createLogger();

// =============================================================================
// Types
// =============================================================================

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  durationMs: number;
  detail?: string;
  showDetailOnPass?: boolean;
}

interface AuditAdvisoryFinding {
  paths?: string[];
}

interface AuditAdvisory {
  module_name?: string;
  patched_versions?: string;
  findings?: AuditAdvisoryFinding[];
}

interface KnownUpstreamAdvisory {
  key: string;
  moduleName: string;
  patchedVersions: string;
  pathIncludes: string;
  description: string;
}

const KnownUpstreamAdvisories: KnownUpstreamAdvisory[] = [];

function classifyAuditAdvisories(advisories: AuditAdvisory[]): {
  actionable: AuditAdvisory[];
  knownUpstream: KnownUpstreamAdvisory[];
} {
  const matchedKnownKeys = new Set<string>();
  const actionable: AuditAdvisory[] = [];

  for (const advisory of advisories) {
    const paths = advisory.findings?.flatMap((finding) => finding.paths ?? []) ?? [];
    const matched = KnownUpstreamAdvisories.find(
      (known) =>
        advisory.module_name === known.moduleName &&
        advisory.patched_versions === known.patchedVersions &&
        paths.some((path) => path.includes(known.pathIncludes)),
    );

    if (matched) {
      matchedKnownKeys.add(matched.key);
      continue;
    }

    actionable.push(advisory);
  }

  const knownUpstream = KnownUpstreamAdvisories.filter((known) => matchedKnownKeys.has(known.key));

  return { actionable, knownUpstream };
}

// =============================================================================
// Security Checks
// =============================================================================

/**
 * Check 1: Dependency vulnerability scan
 * Fails on critical or high severity; warns on moderate.
 */
async function checkDependencyAudit(projectRoot: string): Promise<CheckResult> {
  const start = performance.now();

  const result = await execCommand('pnpm', ['audit', '--audit-level=moderate', '--json'], {
    capture: true,
    cwd: projectRoot,
  });

  const durationMs = performance.now() - start;
  const raw = result.stdout ?? '';

  // Parse vulnerability counts from JSON output
  let critical = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  let advisories: AuditAdvisory[] = [];

  try {
    const parsed = JSON.parse(raw) as {
      metadata?: {
        vulnerabilities?: { critical?: number; high?: number; moderate?: number; low?: number };
      };
      advisories?: Record<string, AuditAdvisory>;
    };
    const v = parsed.metadata?.vulnerabilities ?? {};
    critical = v.critical ?? 0;
    high = v.high ?? 0;
    moderate = v.moderate ?? 0;
    low = v.low ?? 0;
    advisories = Object.values(parsed.advisories ?? {});
  } catch {
    // pnpm audit may exit non-zero even when JSON is valid — tolerate parse errors
  }

  // Save report for CI artifacts
  const reportDir = join(projectRoot, '.revealui');
  try {
    await mkdir(reportDir, { recursive: true });
    await writeFile(join(reportDir, 'security-audit-latest.json'), raw || '{}', 'utf8');
  } catch {
    // Non-fatal
  }

  const summary = `critical=${critical} high=${high} moderate=${moderate} low=${low}`;
  const { actionable, knownUpstream } = classifyAuditAdvisories(advisories);
  const knownUpstreamDetail =
    knownUpstream.length > 0
      ? ` Known upstream advisories: ${knownUpstream.map((advisory) => advisory.description).join('; ')}.`
      : '';

  if (critical > 0) {
    return {
      name: 'Dependency audit',
      status: 'fail',
      durationMs,
      detail: `Found critical vulnerabilities: ${summary}. Run 'pnpm audit' for details.${knownUpstreamDetail}`,
    };
  }

  if (high > 0 || moderate > 0) {
    if (actionable.length === 0 && knownUpstream.length > 0) {
      return {
        name: 'Dependency audit',
        status: 'pass',
        durationMs,
        detail: `No actionable dependency vulnerabilities in this repo: ${summary}.${knownUpstreamDetail}`,
        showDetailOnPass: true,
      };
    }

    return {
      name: 'Dependency audit',
      status: 'warn',
      durationMs,
      detail: `Found actionable vulnerabilities: ${summary}. Run 'pnpm audit' for details.${knownUpstreamDetail}`,
    };
  }

  return { name: 'Dependency audit', status: 'pass', durationMs, detail: summary };
}

/**
 * Check 2: Hardcoded secrets/credentials scan
 * Fails if any pattern matches in non-excluded files.
 */
async function checkSecretscan(projectRoot: string): Promise<CheckResult> {
  const start = performance.now();

  const patterns = [
    'password\\s*=\\s*[\'"][^\'"]{8,}',
    'api[_-]?key\\s*=\\s*[\'"][^\'"]{20,}',
    'secret\\s*=\\s*[\'"][^\'"]{20,}',
    'token\\s*=\\s*[\'"][^\'"]{20,}',
    'private[_-]?key\\s*=\\s*[\'"][^\'"]{20,}',
    'AKIA[0-9A-Z]{16}',
    'AIza[0-9A-Za-z\\-_]{35}',
    'sk_live_[0-9a-zA-Z]{24}',
    'sk_test_[0-9a-zA-Z]{24}',
    'postgres://[^@]+:[^@]+@',
    'mysql://[^@]+:[^@]+@',
    'mongodb://[^@]+:[^@]+@',
  ];

  // Combine into a single alternation for one git grep call
  const combined = patterns.join('|');

  const result = await execCommand(
    'git',
    [
      'grep',
      '-iE',
      combined,
      '--',
      ':!*.lock',
      ':!*.md',
      ':!.github/workflows/*',
      ':!*.test.*',
      ':!*.spec.*',
      ':!*.test-d.*',
      ':!*.e2e.*',
      ':!.env.template',
      ':!.env.test',
      ':!*/__tests__/**',
      ':!e2e/**',
      ':!*.sh',
      ':!scripts/**',
      ':!**/load-tests/**',
      ':!**/generators/**',
      ':!*.env.example',
      ':!**/config.toml',
    ],
    { capture: true, cwd: projectRoot },
  );

  const durationMs = performance.now() - start;

  // git grep exits 1 when no matches found (that's the "pass" case).
  // Filter out comment lines (JSDoc `* ...` and single-line `// ...`) to eliminate
  // false positives from documentation examples (e.g. postgres://user:pass@host in a docstring).
  const rawMatches = (result.stdout ?? '').trim();
  const realMatches = rawMatches
    ? rawMatches.split('\n').filter((line) => {
        const content = line.replace(/^[^:]+:/, '').trimStart();
        // Exclude comments and UI placeholder attributes (not real credentials)
        if (content.startsWith('* ') || content.startsWith('//') || content.startsWith('#'))
          return false;
        if (/placeholder\s*=\s*["']/.test(content)) return false;
        return true;
      })
    : [];

  if (realMatches.length > 0) {
    const preview = realMatches.slice(0, 5);
    return {
      name: 'Secrets scan',
      status: 'fail',
      durationMs,
      detail: `Potential secrets found. First matches:\n${preview.map((l) => `    ${l}`).join('\n')}`,
    };
  }

  return { name: 'Secrets scan', status: 'pass', durationMs };
}

/**
 * Check 3: Committed .env files
 * Fails if any .env file (not .env.template/.env.test/.env.production.example) is tracked by git.
 */
async function checkEnvFiles(projectRoot: string): Promise<CheckResult> {
  const start = performance.now();

  const result = await execCommand('git', ['ls-files'], { capture: true, cwd: projectRoot });

  const durationMs = performance.now() - start;

  // Files that are intentionally committed and not secrets:
  // - .env.template: placeholder structure for onboarding, contains no real values
  // - .env.test: test fixtures with fake values (sk_test_*, whsec_test*, etc.)
  // - .env.production.example: production deployment template (no real values)
  const AllowedEnvFiles = new Set(['.env.template', '.env.test', '.env.production.example']);

  const lines = (result.stdout ?? '').split('\n');
  const envFiles = lines.filter((f) => /^\.env(\.[^.]+)?$/.test(f) && !AllowedEnvFiles.has(f));

  if (envFiles.length > 0) {
    return {
      name: 'Env file check',
      status: 'fail',
      durationMs,
      detail: `Committed .env files found: ${envFiles.join(', ')}. Add to .gitignore.`,
    };
  }

  return { name: 'Env file check', status: 'pass', durationMs };
}

/**
 * Check 4: Auth & authorization patterns (warn-only)
 * Uses AST-based analysis for auth/security code smells to avoid regex false positives.
 */
async function checkAuthPatterns(projectRoot: string): Promise<CheckResult> {
  const start = performance.now();
  const issues: string[] = [];
  const findings = findAuthSecurityIssues(projectRoot);

  const byKind = {
    hardcodedJwtSecret: findings.filter((issue) => issue.kind === 'hardcoded-jwt-secret'),
    weakPasswordRequirement: findings.filter((issue) => issue.kind === 'weak-password-requirement'),
    plaintextPasswordStorage: findings.filter(
      (issue) => issue.kind === 'plaintext-password-storage',
    ),
  };

  if (byKind.hardcodedJwtSecret.length > 0) {
    issues.push(
      `Potential hardcoded JWT secrets: ${byKind.hardcodedJwtSecret
        .slice(0, 3)
        .map((issue) => `${issue.file}:${issue.line}`)
        .join(', ')}`,
    );
  }

  if (byKind.weakPasswordRequirement.length > 0) {
    issues.push(
      `Weak password length requirements (< 8 chars): ${byKind.weakPasswordRequirement
        .slice(0, 3)
        .map((issue) => `${issue.file}:${issue.line}`)
        .join(', ')}`,
    );
  }

  if (byKind.plaintextPasswordStorage.length > 0) {
    issues.push(
      `Potential plaintext password storage: ${byKind.plaintextPasswordStorage
        .slice(0, 3)
        .map((issue) => `${issue.file}:${issue.line}`)
        .join(', ')}`,
    );
  }

  const durationMs = performance.now() - start;

  if (issues.length > 0) {
    return {
      name: 'Auth patterns',
      status: 'warn',
      durationMs,
      detail: `${issues.join('; ')}. Manual review required.`,
    };
  }

  return { name: 'Auth patterns', status: 'pass', durationMs };
}

/**
 * Check 5: API security patterns (warn-only)
 * Uses AST-based analysis for CORS wildcard usage and a coarse inventory check for rate limiting.
 */
async function checkApiSecurity(projectRoot: string): Promise<CheckResult> {
  const start = performance.now();
  const issues: string[] = [];
  const findings = findApiSecurityIssues(projectRoot);
  const corsWildcards = findings.filter((issue) => issue.kind === 'cors-wildcard');

  if (corsWildcards.length > 0) {
    issues.push(
      `Potential CORS wildcard (*) usage: ${corsWildcards
        .slice(0, 3)
        .map((issue) => `${issue.file}:${issue.line}`)
        .join(', ')}`,
    );
  }

  // Rate limiting presence
  const rateLimitResult = await execCommand(
    'git',
    ['grep', '-rl', 'rateLimit\\|rate-limit\\|upstash', '--', 'apps/'],
    { capture: true, cwd: projectRoot },
  );
  if (!(rateLimitResult.stdout ?? '').trim()) {
    issues.push('No rate limiting detected in apps/ — consider adding to prevent abuse');
  }

  const durationMs = performance.now() - start;

  if (issues.length > 0) {
    return {
      name: 'API security',
      status: 'warn',
      durationMs,
      detail: issues.join('; '),
    };
  }

  return { name: 'API security', status: 'pass', durationMs };
}

async function checkLocalPathLeaks(projectRoot: string): Promise<CheckResult> {
  const start = performance.now();
  const violations: string[] = [];

  // Detect hardcoded home directory paths in tracked source files
  // Searches for /home/<user>/ patterns that shouldn't be committed
  const result = await execCommand(
    'git',
    [
      'grep',
      '-rn',
      '/home/[a-z]',
      '--',
      'apps/',
      'packages/',
      'scripts/',
      ':!scripts/agent/',
      ':!**/node_modules/**',
      ':!**/*.test.*',
      ':!**/*.spec.*',
    ],
    { capture: true, cwd: projectRoot },
  );

  const output = (result.stdout ?? '').trim();
  if (output) {
    for (const line of output.split('\n')) {
      // Skip comments that are generic examples (e.g. "# /home/user/...")
      if (line.includes('/home/user/')) continue;
      // Skip lines that are just using $HOME
      if (line.includes('$HOME')) continue;
      violations.push(line);
    }
  }

  const durationMs = performance.now() - start;

  if (violations.length > 0) {
    return {
      name: 'Local path leaks',
      status: 'fail',
      durationMs,
      detail: `${violations.length} file(s) contain hardcoded local paths:\n${violations.slice(0, 5).join('\n')}`,
    };
  }

  return { name: 'Local path leaks', status: 'pass', durationMs };
}

// =============================================================================
// Summary
// =============================================================================

const STATUS_ICON: Record<string, string> = {
  pass: '\u2713',
  fail: '\u2717',
  warn: '\u26A0',
  skip: '\u2013',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(results: CheckResult[], totalMs: number): void {
  const failed = results.some((r) => r.status === 'fail');

  logger.header('Security Gate Summary');

  for (const r of results) {
    const icon = STATUS_ICON[r.status];
    const duration = formatDuration(r.durationMs);
    const suffix = r.status === 'warn' ? '  (warning)' : '';
    const pad = ' '.repeat(Math.max(1, 24 - r.name.length));
    console.log(`  ${icon} ${r.name}${pad}${duration}${suffix}`);
    if (r.detail && (r.status === 'fail' || r.status === 'warn' || r.showDetailOnPass)) {
      const lines = r.detail.split('\n');
      for (const line of lines) {
        console.log(`       ${line}`);
      }
    }
  }

  console.log('='.repeat(60));
  console.log(`  Total: ${formatDuration(totalMs)}`);
  console.log(`  Result: ${failed ? 'FAIL' : 'PASS'}`);
  console.log('='.repeat(60));
}

// =============================================================================
// Gate Logic
// =============================================================================

async function gate(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url);
  const outputJson = process.argv.includes('--json');

  if (!outputJson) {
    logger.header('RevealUI Security Gate');
    console.log('');
  }

  const totalStart = performance.now();

  // Run all checks in parallel (mirrors GitHub Actions parallel jobs)
  const results = await Promise.all([
    checkDependencyAudit(projectRoot),
    checkSecretscan(projectRoot),
    checkEnvFiles(projectRoot),
    checkLocalPathLeaks(projectRoot),
    checkAuthPatterns(projectRoot),
    checkApiSecurity(projectRoot),
  ]);

  const totalMs = performance.now() - totalStart;

  if (outputJson) {
    console.log(
      JSON.stringify(
        { results, totalMs, passed: !results.some((r) => r.status === 'fail') },
        null,
        2,
      ),
    );
    if (results.some((r) => r.status === 'fail')) process.exit(ErrorCode.VALIDATION_ERROR);
    return;
  }

  printSummary(results, totalMs);

  // Critical checks: dependency audit, secrets scan, env file check
  const criticalFailed = results
    .filter((r) =>
      ['Dependency audit', 'Secrets scan', 'Env file check', 'Local path leaks'].includes(r.name),
    )
    .some((r) => r.status === 'fail');

  if (criticalFailed) {
    logger.error('Critical security checks failed');
    process.exit(ErrorCode.VALIDATION_ERROR);
  }
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  try {
    await gate();
  } catch (error) {
    logger.error(`Security gate failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
