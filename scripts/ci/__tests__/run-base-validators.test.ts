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

  it('refuses a missing base file and a shared root', () => {
    const judge = tempDir();
    const scan = tempDir();
    expect(() => copyJudgeTree(judge, scan)).toThrow('base judge missing');
    expect(() => copyJudgeTree(scan, scan)).toThrow('same directory');
  });
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
