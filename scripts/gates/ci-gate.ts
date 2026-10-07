#!/usr/bin/env tsx
// console-allowed

/**
 * CI Gate  -  Local CI/CD Quality Gate for RevealUI
 *
 * Replaces GitHub Actions CI pipeline with local phased checks.
 * Uses turbo caching for fast warm runs (~1-2 min).
 *
 * Usage:
 *   pnpm gate                   -  run all phases
 *   pnpm gate --phase=1         -  quick quality checks only
 *   pnpm gate --skip=security   -  skip security audit
 *   pnpm gate --no-build        -  skip build in phase 3
 *   pnpm gate --no-test         -  skip tests in phase 3 (pre-push: CI runs tests)
 *   pnpm gate --changed         -  scope to packages changed vs origin/<branch> (pre-push fast path)
 *   pnpm gate --types           -  include full type-system validation (gate:types) in phase 2
 *
 * Phases:
 *   1. Quality (parallel): lint, audits, structure validation, boundary enforcement
 *   2. Types (serial): full typecheck across all packages
 *   3. Test + Build (parallel): unit tests and production build
 *
 * @dependencies
 * - scripts/lib/exec.ts - execCommand for running checks
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/utils/base.ts - Base utilities (createLogger, getProjectRoot)
 *
 * @requires
 * - External: pnpm, turbo, biome
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { type SpawnOptions, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { createLogger, getProjectRoot } from '../utils/base.js';
import { phaseConcurrency } from '../utils/resource-admission.js';

export { phaseConcurrency } from '../utils/resource-admission.js';

const logger = createLogger();

/** Phase-1 checks without an explicit timeout inherit this (not execCommand's 120s). */
const PHASE_CHECK_TIMEOUT_MS = 300_000;
const admissionDescriptor = new AsyncLocalStorage<number>();

/** Actual validator processes retain admission if their gate parent exits. */
function admittedStdio(capture = false): SpawnOptions['stdio'] | undefined {
  const descriptor = admissionDescriptor.getStore();
  const channel = capture ? 'pipe' : 'inherit';
  if (descriptor === undefined) return channel;
  return [channel, channel, channel, descriptor];
}

// =============================================================================
// Types
// =============================================================================

interface CheckDef {
  name: string;
  command: string;
  args: string[];
  warnOnly?: boolean;
  skip?: boolean;
  timeout?: number;
}

/**
 * Resolve the git comparison base for --changed mode.
 * Prefers origin/<branch> (compares unpushed work only), falls back to HEAD~1.
 */
async function resolveChangeBase(): Promise<string> {
  const branch = await execCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    capture: true,
    stdio: admittedStdio(true),
  });
  if (branch.success && branch.stdout?.trim()) {
    const upstream = `origin/${branch.stdout.trim()}`;
    const check = await execCommand('git', ['rev-parse', '--verify', upstream], {
      capture: true,
      stdio: admittedStdio(true),
    });
    if (check.success) return upstream;
  }
  return 'HEAD~1';
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  durationMs: number;
  failure?: {
    exitCode: number;
    processExitCode?: number | null;
    signal?: NodeJS.Signals;
    timedOut: boolean;
    timeoutMs?: number;
  };
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs(): {
  phase: number | null;
  skip: Set<string>;
  noBuild: boolean;
  noTest: boolean;
  changed: boolean;
  types: boolean;
} {
  const argv = process.argv.slice(2);
  let phase: number | null = null;
  const skip = new Set<string>();
  let noBuild = false;
  let noTest = false;
  let changed = false;
  let types = false;

  for (const arg of argv) {
    if (arg.startsWith('--phase=')) {
      phase = Number.parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--skip=')) {
      skip.add(arg.split('=')[1]);
    } else if (arg === '--no-build') {
      noBuild = true;
    } else if (arg === '--no-test') {
      noTest = true;
    } else if (arg === '--changed') {
      changed = true;
    } else if (arg === '--types') {
      types = true;
    }
  }

  return { phase, skip, noBuild, noTest, changed, types };
}

// =============================================================================
// Check Runner
// =============================================================================

export async function runCheck(check: CheckDef): Promise<CheckResult> {
  if (check.skip) {
    return { name: check.name, status: 'skip', durationMs: 0 };
  }

  let args = check.args;
  if (check.command === 'pnpm' && args[0] === 'turbo') {
    const flags = args.filter((arg) => arg.startsWith('--concurrency='));
    if (flags.length !== 1) throw new Error('Turbo gate checks must declare one worker cap.');
    const maximum = Number(flags[0]?.slice('--concurrency='.length));
    if (!Number.isInteger(maximum) || maximum < 1) {
      throw new Error('Turbo gate worker cap must be a positive integer.');
    }
    const cap = phaseConcurrency(maximum);
    // Headroom may have changed while an earlier serial test/build ran.
    args = args.map((arg) => (arg.startsWith('--concurrency=') ? `--concurrency=${cap}` : arg));
  }
  const start = performance.now();
  const result = await execCommand(check.command, args, {
    timeout: check.timeout ?? PHASE_CHECK_TIMEOUT_MS,
    stdio: admittedStdio(),
  });
  const durationMs = performance.now() - start;

  if (result.success) {
    return { name: check.name, status: 'pass', durationMs };
  }

  const failure = {
    exitCode: result.exitCode,
    processExitCode: result.processExitCode,
    signal: result.signal,
    timedOut: result.timedOut === true,
    timeoutMs: result.timedOut ? (check.timeout ?? PHASE_CHECK_TIMEOUT_MS) : undefined,
  };
  // Capture buffers and command arguments can contain credentials. Only report
  // process outcome metadata, retaining warning-only policy unchanged.
  const report = `${check.name}: ${formatFailure(failure)}`;
  if (check.warnOnly) logger.warning(report);
  else logger.error(report);
  return { name: check.name, status: check.warnOnly ? 'warn' : 'fail', durationMs, failure };
}

/**
 * Kernel-owned admission spans worktrees. flock locks the inherited open file
 * description; closing our descriptor releases it without deleting the file
 * or expiring a live owner. There is no caller-supplied "already admitted" flag.
 */
export async function withGateAdmission<T>(operation: () => Promise<T>): Promise<T> {
  const descriptor = openSync(
    join(tmpdir(), `revealui-gate-${process.getuid?.() ?? 'user'}.lock`),
    'a',
    0o600,
  );
  try {
    await new Promise<void>((resolve, reject) => {
      // Reject contention immediately: a direct Git push may already have an
      // open transport, so resource admission must not wait inside its hook.
      const child = spawn('flock', ['--exclusive', '--nonblock', '3'], {
        stdio: ['ignore', 'inherit', 'inherit', descriptor],
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`CI gate admission lock failed (${signal ?? code}).`));
      });
    });
    phaseConcurrency(1);
    return await admissionDescriptor.run(descriptor, operation);
  } finally {
    closeSync(descriptor);
  }
}

async function runPhaseParallel(checks: CheckDef[]): Promise<CheckResult[]> {
  const limit = phaseConcurrency(checks.length);
  logger.info(`Parallel worker cap: ${limit} of ${checks.length}`);
  const results = new Array<CheckResult>(checks.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      if (index >= checks.length) return;
      next += 1;
      const check = checks[index];
      if (check) results[index] = await runCheck(check);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function runPhaseSerial(checks: CheckDef[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
    if (result.status === 'fail') break;
  }
  return results;
}

// =============================================================================
// Summary Table
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

function formatFailure(failure: NonNullable<CheckResult['failure']>): string {
  const actual =
    failure.processExitCode === null ? 'none' : (failure.processExitCode ?? failure.exitCode);
  return [
    `exit=${actual}`,
    `status=${failure.exitCode}`,
    ...(failure.signal ? [`signal=${failure.signal}`] : []),
    ...(failure.timedOut ? [`timeout=${failure.timeoutMs}ms`] : []),
  ].join(', ');
}

export function printSummary(results: CheckResult[], totalMs: number): void {
  const failed = results.some((r) => r.status === 'fail');

  logger.header('CI Gate Summary');

  for (const r of results) {
    const icon = STATUS_ICON[r.status];
    const duration = r.status === 'skip' ? '' : formatDuration(r.durationMs);
    const suffix = r.status === 'warn' ? '  (warning)' : '';
    const pad = ' '.repeat(Math.max(1, 28 - r.name.length));
    console.log(`  ${icon} ${r.name}${pad}${duration}${suffix}`);
    if (r.failure) console.log(`      ${formatFailure(r.failure)}`);
  }

  console.log('='.repeat(60));
  console.log(`  Total: ${formatDuration(totalMs)}`);
  console.log(`  Result: ${failed ? 'FAIL' : 'PASS'}`);
  console.log('='.repeat(60));
}

// =============================================================================
// Gate Logic
// =============================================================================

export async function gate(): Promise<void> {
  await getProjectRoot(import.meta.url);

  // Skip env validation during gate builds  -  same as CI.
  // Build sets NODE_ENV=production but real env vars aren't available locally.
  process.env.SKIP_ENV_VALIDATION = 'true';

  const { phase, skip, noBuild, noTest, changed, types } = parseArgs();

  logger.header('RevealUI CI Gate');

  if (phase !== null) {
    logger.info(`Running phase ${phase} only`);
  }
  if (skip.size > 0) {
    logger.info(`Skipping: ${[...skip].join(', ')}`);
  }
  if (noBuild) {
    logger.info('Build step disabled');
  }
  if (noTest) {
    logger.info('Test step disabled (CI will run tests)');
  }
  // Resolve the comparison base once for all phases
  const changeBase = changed ? await resolveChangeBase() : 'HEAD~1';
  if (changed) {
    logger.info(`Changed-only mode: scoping to packages changed since ${changeBase}`);
  }
  if (types) {
    logger.info('Types mode: full type-system validation included in phase 2');
  }
  console.log('');

  const allResults: CheckResult[] = [];
  const totalStart = performance.now();

  // --- Phase 1: Quality (parallel) ---
  if (phase === null || phase === 1) {
    // Quality checks consume supported package exports. Build their declared
    // dependency graphs before starting any parallel consumers, as CI does.
    // This prerequisite applies even when phase 3 builds are disabled.
    logger.info('Phase 1 prerequisite — quality package dependency graphs');
    const prerequisiteConcurrency = phaseConcurrency(2);
    const prerequisite = await runCheck({
      name: 'Quality package prerequisites',
      command: 'pnpm',
      args: [
        'turbo',
        'run',
        'build',
        '--filter=@revealui/harnesses...',
        '--filter=@revealui/claim-gates...',
        `--concurrency=${prerequisiteConcurrency}`,
      ],
      timeout: 600_000,
    });
    allResults.push(prerequisite);
    if (prerequisite.status === 'fail') {
      logger.error('Quality prerequisites failed; export-consuming checks cannot run.');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.EXECUTION_ERROR);
    }

    logger.info('Phase 1 \u2014 Quality checks (parallel)');

    // In changed-only mode: lint only files changed since the comparison base
    const biomeCheck: CheckDef = changed
      ? {
          name: 'Biome lint (changed)',
          command: 'bash',
          args: [
            '-c',
            `FILES=$(git diff --name-only --diff-filter=ACMR ${changeBase} -- "*.ts" "*.tsx" "*.js" "*.jsx" 2>/dev/null); [ -z "$FILES" ] && exit 0; echo "$FILES" | xargs node_modules/.bin/biome check`,
          ],
          timeout: 600000,
        }
      : {
          name: 'Biome lint',
          command: 'bash',
          args: [
            '-c',
            'git ls-files --cached -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.json" | xargs node_modules/.bin/biome check',
          ],
          timeout: 600000,
        };

    const phase1Checks: CheckDef[] = [
      biomeCheck,
      { name: 'Push and gate admission contracts', command: 'pnpm', args: ['validate:push'] },
      {
        name: 'Security review gate unit tests',
        command: 'pnpm',
        args: ['validate:security-review-gate'],
      },
      { name: 'Any type audit', command: 'pnpm', args: ['audit:any'], warnOnly: true },
      { name: 'Console audit', command: 'pnpm', args: ['audit:console'], warnOnly: true },
      {
        name: 'Structure validation',
        command: 'pnpm',
        args: ['validate:structure'],
        warnOnly: true,
      },
      {
        // GAP-406: hard-fail local gate when manager.json is missing/invalid.
        // Same checkManager as `revealui-harnesses manager check` via
        // validate:structure --manager-only (no parallel validator).
        // CI mirrors this as a path-gated Quality step.
        name: 'Project manager check (hard fail)',
        command: 'pnpm',
        args: ['validate:structure', '--', '--manager-only'],
      },
      {
        // GAP-406 residual: definition ↔ committed generator snapshot lock.
        // Fails when package definitions change without refreshing
        // packages/harnesses/content-snapshots/*.json (unit tests also cover this).
        // Locks generator determinism only — not on-disk `.revealui/content` freshness.
        name: 'Harnesses content snapshot (hard fail)',
        command: 'pnpm',
        args: ['--filter', '@revealui/harnesses', 'content:snapshot:check'],
      },
      {
        // GAP-421 content materialization ADR phase 1: definitions must match
        // the committed `.revealui/content/` tree (byte compare via diffContent).
        // The sequential quality prerequisite above builds harnesses and its
        // declared dependencies before manager/content export consumers.
        name: 'Harnesses content tree freshness (hard fail)',
        command: 'pnpm',
        args: ['validate:content-freshness'],
      },
      {
        name: 'Boundary validation',
        command: 'pnpm',
        args: ['validate:boundary'],
      },
      {
        name: 'Vercel project settings lockstep (files)',
        command: 'pnpm',
        args: ['validate:vercel-settings'],
      },
      {
        name: 'Version policy',
        command: 'pnpm',
        args: ['validate:versions'],
      },
      {
        // Dec-2025 React RSC CVE series (CVE-2025-55182 "React2Shell" +
        // follow-ups; final fix 19.2.4): react / react-dom /
        // react-server-dom-webpack must RESOLVE >=19.2.4 and in lockstep.
        // Absent packages pass. Mirrored in CI by the Quality job step in
        // .github/workflows/ci.yml.
        name: 'React RSC CVE floor (hard fail)',
        command: 'pnpm',
        args: ['validate:react-floor'],
      },
      {
        name: 'Catalog changeset check',
        command: 'pnpm',
        args: ['validate:catalog'],
        warnOnly: true,
      },
      {
        name: 'Docs import drift',
        command: 'pnpm',
        args: ['validate:docs-imports', '--warn'],
        warnOnly: true,
      },
      {
        // Source-citation gate (CONTRIBUTING.md — Source citations). VALIDITY
        // (every path:line citation must resolve and sit in-range) HARD-FAILS;
        // COVERAGE is now hard-fail too via --coverage-strict (Phase 3): NEW
        // uncited code-behaviour claims beyond the grandfathered baseline fail.
        // Mirrored in CI by the Quality job step in .github/workflows/ci.yml.
        name: 'Citation gate (hard fail)',
        command: 'pnpm',
        args: ['validate:citations', '--coverage-strict'],
      },
      {
        name: 'Pro license validation',
        command: 'pnpm',
        args: ['validate:gitignore'],
      },
      {
        // ADR-007: C11 incubators stay unmounted from apps until WIRE (GAP-406)
        name: 'Incubate posture (hard fail)',
        command: 'pnpm',
        args: ['validate:incubate-posture'],
      },
      {
        // ADR-006: engines incubate posture (no app entry claim / no app importers)
        name: 'Engines posture (hard fail)',
        command: 'pnpm',
        args: ['validate:engines-posture'],
      },
      {
        name: 'Claim drift (hard fail)',
        command: 'pnpm',
        args: ['validate:claims'],
      },
      {
        // GAP-395: REST API markdown must match `pnpm docs:generate:api`.
        name: 'API docs drift (hard fail)',
        command: 'pnpm',
        args: ['validate:api-docs'],
        // The authoritative generator builds the server dependency closure
        // before comparing the maintained document; cold CI routinely needs
        // more than the generic five-minute phase-check budget.
        timeout: 600_000,
      },
      {
        // ADR 2026-07-29 virtual serve: monorepo docs/ is SoT. Fail if leftover
        // generated apps/docs/public/**/*.md reappear (not docs-pro). Script
        // shipped in #2347; wired into phase-1 + CI for fleet-redundancy C12.
        name: 'Docs public mirror (hard fail)',
        command: 'pnpm',
        args: ['validate:docs-public-mirror'],
      },
      {
        // The .claude config surface (rules/agents/skills) is materialized
        // from revcon profiles with a sha256 manifest; tracked copies must
        // match it exactly (no local edits, no hand-added strays). Mirrored
        // in CI by the Quality job step in .github/workflows/ci.yml.
        name: 'Rules lockstep (hard fail)',
        command: 'pnpm',
        args: ['validate:rules-lockstep'],
      },
      {
        // GAP-379: deps-stage COPY package.json lists in server/admin
        // Dockerfiles must cover the pnpm --filter <app>... workspace
        // closure. Whole-tree-copy Dockerfiles (worker) are out of scope.
        // Mirrored in CI by the Quality job step in .github/workflows/ci.yml.
        name: 'Dockerfile deps COPY lockstep (hard fail)',
        command: 'pnpm',
        args: ['validate:dockerfile-deps'],
      },
      {
        // GAP-430: marketplace Deploy Now must not Railpack-fail api/admin.
        // Mirrored in CI by the Quality job step in .github/workflows/ci.yml.
        name: 'Railway marketplace Dockerfile wiring (hard fail)',
        command: 'pnpm',
        args: ['validate:railway-marketplace'],
      },
      {
        // Every prose sentence in covered marketing content files must carry
        // a claims-evidence entry citing the code that proves it; cited paths
        // must exist. Sibling of claim-drift: that gate pins the numbers,
        // this one pins the sentences.
        name: 'Claims evidence (hard fail)',
        command: 'pnpm',
        args: ['validate:claims-evidence'],
      },
      {
        name: 'Marketing voice (hard fail)',
        command: 'pnpm',
        args: ['validate:marketing-voice'],
      },
      {
        // Admitted 2026-09-26: docs stay product reference. Product blog hops
        // point at the Studio site. Warn-only so the corpus can stay served
        // while the public nav and redirects move.
        name: 'Refuse blog in docs (warn)',
        command: 'pnpm',
        args: ['validate:refuse-blog-in-docs'],
        warnOnly: true,
      },
      {
        // VES fleet-marketing voice gate needs dist prose slots (section/ctaSection).
        name: 'Marketing voice prose-slot dist (hard fail)',
        command: 'pnpm',
        args: ['validate:marketing-voice-prose-slots'],
      },
      {
        // Conflict-proof VES page-blocks layout: mono shell + pages/* modules
        // with *PageSeed auto-discovery (no shared mega-file merge cascade).
        name: 'Page-blocks modules (hard fail)',
        command: 'pnpm',
        args: ['validate:page-blocks-modules'],
      },
      {
        // Stale-fact drift guard: docs/**/*.md + apps/marketing/**/*.md prose,
        // plus apps/marketing/app/content/**/*.ts marketing-copy string
        // literals (TypeScript AST, no identifiers/imports/comments). A
        // baseline grandfathers the corpus at seed time; CI hard-fails only
        // on NEW (file::ruleId) occurrences. Mirrored in CI by the Quality
        // job step in .github/workflows/ci.yml.
        name: 'Doc-currency (hard fail)',
        command: 'pnpm',
        args: ['validate:doc-currency', '--mode=ci'],
      },
      {
        // GAP-451: docs archived out of this repo must leave no live inbound
        // links behind. Local parity with .github/workflows/archive-check.yml.
        name: 'Archive links (hard fail)',
        command: 'node',
        args: ['scripts/validate/archive-check.cjs', '--ci'],
      },
      {
        name: 'Design-context drift (hard fail)',
        command: 'pnpm',
        args: ['validate:design-context'],
      },
      {
        name: 'Brand bridge (hard fail)',
        command: 'pnpm',
        args: ['validate:brand-bridge'],
      },
      {
        name: 'Migration journal',
        command: 'pnpm',
        args: ['validate:migrations'],
      },
      {
        name: 'Raw-SQL (hard fail)',
        command: 'pnpm',
        args: ['validate:raw-sql'],
      },
      {
        name: 'Empty-catch (hard fail)',
        command: 'pnpm',
        args: ['validate:empty-catch'],
      },
      {
        name: 'as-never on drizzle .values() (hard fail)',
        command: 'pnpm',
        args: ['validate:as-never-values'],
      },
      {
        name: 'audit_log ONE DOOR (hard fail)',
        command: 'pnpm',
        args: ['validate:audit-one-door'],
      },
      {
        // GAP-355 S5-4: named agent emit chokepoints must still wire integrity audit.
        name: 'agent audit chokepoints (hard fail)',
        command: 'pnpm',
        args: ['validate:agent-audit-chokepoints'],
      },
      {
        // GAP-355 S6-5: named agent chokepoints must still pre-authorize tools.
        name: 'agent authorize chokepoints (hard fail)',
        command: 'pnpm',
        args: ['validate:agent-authorize-chokepoints'],
      },
      {
        name: 'Stripe-client consolidation (hard fail)',
        command: 'pnpm',
        args: ['validate:stripe-client'],
      },
      {
        name: 'Pricing lockstep (hard fail)',
        command: 'pnpm',
        args: ['validate:pricing-lockstep'],
      },
      {
        // GAP-466: test-branch marketing honesty is not customer-visible
        // until production Deploy on main is green. Does not promote.
        name: 'Marketing deploy lockstep (hard fail)',
        command: 'pnpm',
        args: ['validate:marketing-deploy-lockstep'],
      },
      {
        name: 'Stripe seeder catalog lockstep (hard fail)',
        command: 'pnpm',
        args: ['validate:stripe-catalog'],
      },
      {
        name: 'Client-bundle safety (hard fail)',
        command: 'pnpm',
        args: ['validate:client-safety'],
      },
      {
        // GAP-398: Tier-1 handroll JSX (button/input/select/textarea/svg) must
        // use @revealui/presentation. Hard-fail on non-allowlisted hits (burn
        // remaining allowlist entries separately; do not re-widen).
        name: 'Tier-1 presentation (hard fail)',
        command: 'pnpm',
        args: ['validate:tier1-presentation', '--', '--hard-fail'],
      },
      {
        // GAP-335: MCP admin routes import Node-only oauth/client. Pin
        // runtime=nodejs so local turbo build --filter=admin cannot Edge-trace
        // them. Always run (CI --affected can skip the admin next build).
        name: 'MCP admin Node runtime (hard fail)',
        command: 'pnpm',
        args: ['validate:mcp-admin-runtime'],
      },
      {
        name: 'Security audit',
        command: 'pnpm',
        args: ['gate:security'],
        warnOnly: true,
        skip: skip.has('security'),
      },
      {
        name: 'Coverage check',
        command: 'pnpm',
        args: changed ? ['coverage:check', '--changed'] : ['coverage:check'],
        warnOnly: true,
        // Skip if no coverage reports exist yet (gate:quick shouldn't require a test run)
        skip: skip.has('coverage'),
      },
    ];

    const results = await runPhaseParallel(phase1Checks);
    allResults.push(...results);

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 1 failed\n');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.VALIDATION_ERROR);
    }

    logger.success('Phase 1 passed\n');
  }

  // Pro packages (Fair Source) are now in the public repo  -  no exclusion needed
  const proFilter: string[] = [];

  // --- Phase 2: Types (serial) ---
  if (phase === null || phase === 2) {
    logger.info('Phase 2 \u2014 Type checking (serial)');

    const typecheckConcurrency = phaseConcurrency(2);

    // In changed-only mode: only typecheck packages changed since comparison base (and their dependents)
    const typecheckArgs = changed
      ? [
          'turbo',
          'run',
          'typecheck',
          `--filter=...[${changeBase}]`,
          ...proFilter,
          `--concurrency=${typecheckConcurrency}`,
        ]
      : ['turbo', 'run', 'typecheck', ...proFilter, `--concurrency=${typecheckConcurrency}`];

    const phase2Checks: CheckDef[] = [
      { name: 'Type checking', command: 'pnpm', args: typecheckArgs, timeout: 300000 },
      {
        name: 'Type system validation',
        command: 'pnpm',
        args: ['gate:types', '--check-only'],
        warnOnly: true,
        // Only run full type-system gate when --types flag is passed
        skip: !types,
        timeout: 300000,
      },
    ];

    const results = await runPhaseSerial(phase2Checks);
    allResults.push(...results);

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 2 failed\n');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.VALIDATION_ERROR);
    }

    logger.success('Phase 2 passed\n');
  }

  // --- Phase 3: Test + Build (serial: tests first) ---
  if (phase === null || phase === 3) {
    logger.info('Phase 3 \u2014 Test + Build (serial: tests first)');

    // Bound package fan-out using the same available-memory/CPU admission.
    // Workspace createVitestConfig separately caps its package pool at two.
    const taskConcurrency = phaseConcurrency(2);
    const testArgs = changed
      ? [
          'turbo',
          'run',
          'test',
          `--filter=...[${changeBase}]`,
          ...proFilter,
          `--concurrency=${taskConcurrency}`,
        ]
      : ['turbo', 'run', 'test', ...proFilter, `--concurrency=${taskConcurrency}`];

    const buildCheck: CheckDef[] = noBuild
      ? []
      : changed
        ? [
            {
              name: 'Build (changed)',
              command: 'pnpm',
              args: [
                'turbo',
                'run',
                'build',
                `--filter=...[${changeBase}]`,
                ...proFilter,
                `--concurrency=${taskConcurrency}`,
              ],
              timeout: 600000,
            },
            {
              name: 'Build artifacts',
              command: 'pnpm',
              args: ['validate:artifacts'],
            },
          ]
        : [
            {
              name: 'Build',
              command: 'pnpm',
              args: ['turbo', 'run', 'build', ...proFilter, `--concurrency=${taskConcurrency}`],
              timeout: 900000,
            },
            {
              name: 'Build artifacts',
              command: 'pnpm',
              args: ['validate:artifacts'],
            },
          ];

    const testCheck: CheckDef[] = noTest
      ? []
      : [
          { name: 'Tests', command: 'pnpm', args: testArgs, timeout: 600000 },
          {
            name: 'Standalone production dependency audit gate test',
            command: 'node',
            args: ['--test', 'scripts/deploy/apify-standalone-dependency-audit.test.mjs'],
          },
        ];

    // OpenAPI mirror drift check runs after build because it inspects
    // @revealui/mcp/dist/, which Phase 3's build step populates. Phase 1
    // cold-workspace runs would hard-fail with ERR_MODULE_NOT_FOUND (#937).
    const mirrorCheck: CheckDef[] = noBuild
      ? []
      : [
          {
            name: 'Contracts OpenAPI mirror drift (hard fail)',
            command: 'pnpm',
            args: ['--filter', '@revealui/openapi', 'check:contracts'],
          },
        ];

    const phase3Checks: CheckDef[] = [...testCheck, ...buildCheck, ...mirrorCheck];

    const results = await runPhaseSerial(phase3Checks);
    allResults.push(...results);

    if (results.some((r) => r.status === 'fail')) {
      logger.error('Phase 3 failed\n');
      printSummary(allResults, performance.now() - totalStart);
      process.exit(ErrorCode.EXECUTION_ERROR);
    }

    logger.success('Phase 3 passed\n');
  }

  // --- Done ---
  printSummary(allResults, performance.now() - totalStart);
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  try {
    await withGateAdmission(gate);
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
