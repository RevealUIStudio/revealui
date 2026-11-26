import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  copyJudgeTree,
  JUDGE_PATHS,
  managerCheckNeeded,
  removeNestedJudgeCheckout,
  touchesManagerSurface,
  VALIDATOR_COMMANDS,
} from '../run-base-validators.mjs';

/** Exact paths the head allowlist exempts. The base copy does not list them. */
const REVIEW_CONTROLLER_MIGRATIONS = [
  'apps/review-controller/migrations/0000_review_controller_store.sql',
  'apps/review-controller/migrations/0001_review_controller_receipt_immutable.sql',
  'apps/review-controller/migrations/0002_review_controller_runtime_grants.sql',
  'apps/review-controller/migrations/0003_review_observation_outcomes.sql',
  'apps/review-controller/migrations/0004_receipt_authorization_generations.sql',
  'apps/review-controller/migrations/0005_merge_intent_quarantine.sql',
];

const UNLISTED_SQL = 'apps/review-controller/migrations/0099_not_allowlisted.sql';

function allowlistJson(paths: string[]): string {
  return `${JSON.stringify(
    {
      version: 1,
      entries: paths.map((entryPath) => ({
        path: entryPath,
        rules: ['sql-file-outside-migrations'],
        reason: 'exact path exemption',
      })),
    },
    null,
    2,
  )}\n`;
}

/**
 * Base code exempts only packages/db/migrations plus exact allowlist paths.
 * Head code also exempts the whole review-controller migrations directory.
 */
function rawSqlValidatorSource(kind: 'base' | 'head'): string {
  const headExemption =
    kind === 'head'
      ? "  if (rel.startsWith('apps/review-controller/migrations/')) continue;\n"
      : '';
  return `import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ALLOWLIST_PATH = join(REPO_ROOT, 'scripts/validate/raw-sql-allowlist.json');
const MARKER = '${kind}-validator';

function loadAllowlist() {
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  const allowed = new Set();
  for (const entry of raw.entries ?? []) {
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error('allowlist entry missing reason');
    }
    const rules = Array.isArray(entry.rules) ? entry.rules : [];
    if (rules.includes('sql-file-outside-migrations')) allowed.add(entry.path);
  }
  return allowed;
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    out.push(abs);
  }
}

const allowed = loadAllowlist();
const files = [];
for (const root of ['apps', 'packages', 'scripts']) {
  const abs = join(REPO_ROOT, root);
  if (existsSync(abs)) walk(abs, files);
}
const violations = [];
for (const abs of files) {
  if (extname(abs) !== '.sql') continue;
  const rel = relative(REPO_ROOT, abs);
  if (rel.startsWith('packages/db/migrations/')) continue;
${headExemption}  if (allowed.has(rel)) continue;
  violations.push(rel);
}
console.log(MARKER);
if (violations.length === 0) {
  console.log('Result: PASS (0 violations)');
  process.exit(0);
}
console.log('Result: FAIL (' + violations.length + ' violations)');
for (const rel of violations) console.log(rel);
process.exit(1);
`;
}

function writeSql(root: string, rel: string): void {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, 'select 1;\n');
}

function runRawSqlValidator(scan: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, ['scripts/validate/raw-sql.ts'], {
    cwd: scan,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

const temps: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'base-validators-'));
  temps.push(dir);
  return dir;
}

function seedJudge(root: string): void {
  for (const rel of JUDGE_PATHS) {
    const full = path.join(root, rel);
    if (rel.endsWith('.ts') || rel.endsWith('.mjs')) {
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, 'base\n');
      continue;
    }
    mkdirSync(full, { recursive: true });
    writeFileSync(path.join(full, 'marker.txt'), 'base\n');
  }
  mkdirSync(path.join(root, 'packages/harnesses/node_modules'), { recursive: true });
  writeFileSync(path.join(root, 'packages/harnesses/node_modules/secret.txt'), 'nope\n');
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('copyJudgeTree', () => {
  it('copies base judge files onto the scan tree and skips node_modules', () => {
    const judge = tempDir();
    const scan = tempDir();
    seedJudge(judge);
    mkdirSync(path.join(scan, 'packages/harnesses/node_modules'), { recursive: true });
    writeFileSync(path.join(scan, 'packages/harnesses/node_modules/keep.txt'), 'keep\n');
    writeFileSync(path.join(scan, 'packages/harnesses/head-only.txt'), 'head\n');
    mkdirSync(path.join(scan, 'apps/docs/scripts'), { recursive: true });

    copyJudgeTree(judge, scan);

    expect(readFileSync(path.join(scan, 'scripts/validate/marker.txt'), 'utf8')).toBe('base\n');
    expect(readFileSync(path.join(scan, 'apps/docs/scripts/check-links.ts'), 'utf8')).toBe(
      'base\n',
    );
    expect(readFileSync(path.join(scan, 'packages/harnesses/node_modules/keep.txt'), 'utf8')).toBe(
      'keep\n',
    );
    expect(readFileSync(path.join(scan, 'packages/harnesses/head-only.txt'), 'utf8')).toBe(
      'head\n',
    );
  });

  it('keeps the scan tree secrets spec when the base sync tree is copied', () => {
    const judge = tempDir();
    const scan = tempDir();
    seedJudge(judge);
    const spec = path.join(scan, 'scripts/sync/secret-paths.ts');
    mkdirSync(path.dirname(spec), { recursive: true });
    writeFileSync(spec, 'head-spec\n');
    writeFileSync(path.join(judge, 'scripts/sync/secret-paths.ts'), 'base-spec\n');

    copyJudgeTree(judge, scan);

    expect(readFileSync(spec, 'utf8')).toBe('head-spec\n');
    expect(readFileSync(path.join(scan, 'scripts/sync/marker.txt'), 'utf8')).toBe('base\n');
  });

  it('refuses a missing base file and a shared root', () => {
    const judge = tempDir();
    const scan = tempDir();
    expect(() => copyJudgeTree(judge, scan)).toThrow('base judge missing');
    expect(() => copyJudgeTree(scan, scan)).toThrow('same directory');
  });
});

describe('raw-sql allowlist during promotion', () => {
  it('runs the base validator with the head allowlist', () => {
    const judge = tempDir();
    const scan = tempDir();
    seedJudge(judge);
    const baseValidator = rawSqlValidatorSource('base');
    const headValidator = rawSqlValidatorSource('head');
    const baseAllowlist = allowlistJson(['scripts/sql/base-only.sql']);
    const headAllowlist = allowlistJson(REVIEW_CONTROLLER_MIGRATIONS);
    writeFileSync(path.join(judge, 'scripts/validate/raw-sql.ts'), baseValidator);
    writeFileSync(path.join(judge, 'scripts/validate/raw-sql-allowlist.json'), baseAllowlist);
    mkdirSync(path.join(scan, 'scripts/validate'), { recursive: true });
    writeFileSync(path.join(scan, 'scripts/validate/raw-sql.ts'), headValidator);
    writeFileSync(path.join(scan, 'scripts/validate/raw-sql-allowlist.json'), headAllowlist);
    for (const rel of REVIEW_CONTROLLER_MIGRATIONS) writeSql(scan, rel);

    copyJudgeTree(judge, scan);

    const copiedValidator = readFileSync(path.join(scan, 'scripts/validate/raw-sql.ts'), 'utf8');
    expect(copiedValidator).toBe(baseValidator);
    expect(copiedValidator).not.toBe(headValidator);
    expect(readFileSync(path.join(scan, 'scripts/validate/raw-sql-allowlist.json'), 'utf8')).toBe(
      headAllowlist,
    );

    const pass = runRawSqlValidator(scan);
    expect(pass.status, pass.output).toBe(0);
    expect(pass.output).toContain('base-validator');
    expect(pass.output).toContain('Result: PASS (0 violations)');

    writeSql(scan, UNLISTED_SQL);
    const fail = runRawSqlValidator(scan);
    expect(fail.status, fail.output).not.toBe(0);
    expect(fail.output).toContain('base-validator');
    expect(fail.output).toContain('Result: FAIL');
    expect(fail.output).toContain(UNLISTED_SQL);
    for (const rel of REVIEW_CONTROLLER_MIGRATIONS) {
      expect(fail.output).not.toContain(rel);
    }
  }, 20_000);
});

describe('removeNestedJudgeCheckout', () => {
  it('removes a judge checkout nested in the scan root and keeps an outside one', () => {
    const scan = tempDir();
    const nested = path.join(scan, 'trusted-judge');
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, 'marker.txt'), 'base\n');
    expect(removeNestedJudgeCheckout(nested, scan)).toBe(true);
    expect(existsSync(nested)).toBe(false);

    const outside = tempDir();
    writeFileSync(path.join(outside, 'marker.txt'), 'base\n');
    expect(removeNestedJudgeCheckout(outside, scan)).toBe(false);
    expect(existsSync(path.join(outside, 'marker.txt'))).toBe(true);
  });
});

describe('managerCheckNeeded', () => {
  it('matches the path-gated manager surfaces', () => {
    expect(touchesManagerSurface('.revealui/manager.json')).toBe(true);
    expect(touchesManagerSurface('packages/harnesses/src/index.ts')).toBe(true);
    expect(touchesManagerSurface('apps/admin/src/page.tsx')).toBe(false);
  });

  it('runs the manager check for harnesses edits and for a push with no parent', () => {
    expect(
      managerCheckNeeded('pull_request', ['packages/harnesses/src/index.ts'], {
        basePresent: true,
        beforeMissing: true,
      }),
    ).toBe(true);
    expect(
      managerCheckNeeded('pull_request', ['docs/ROADMAP.md'], {
        basePresent: true,
        beforeMissing: true,
      }),
    ).toBe(false);
    expect(
      managerCheckNeeded('push', [], {
        basePresent: false,
        beforeMissing: true,
      }),
    ).toBe(true);
    expect(managerCheckNeeded('schedule', [], { basePresent: false, beforeMissing: true })).toBe(
      true,
    );
  });
});

describe('VALIDATOR_COMMANDS', () => {
  it('invokes validator files directly', () => {
    const flat = VALIDATOR_COMMANDS.map((argv) => argv.join(' ')).join('\n');
    expect(flat).toContain('scripts/validate/boundary.ts');
    expect(flat).toContain('scripts/validate/doc-currency.ts');
    expect(flat.includes('scripts/gates/security-gate.ts')).toBe(false);
    expect(flat.includes('validate:')).toBe(false);
  });
});
