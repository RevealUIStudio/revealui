/**
 * Third-party `uses:` in workflows and composite actions must be a
 * 40-character commit SHA. Local `./` actions are exempt.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isFullCommitSha, scanActionPinRoots, scanActionPinText } from '../action-pin.ts';

const FULL_SHA = '9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('isFullCommitSha', () => {
  it('accepts a 40-character lowercase hex sha', () => {
    expect(isFullCommitSha(FULL_SHA)).toBe(true);
  });

  it('rejects tags, short shas, and uppercase hex', () => {
    expect(isFullCommitSha('v7')).toBe(false);
    expect(isFullCommitSha('v7.0.0')).toBe(false);
    expect(isFullCommitSha(FULL_SHA.slice(0, 7))).toBe(false);
    expect(isFullCommitSha(FULL_SHA.toUpperCase())).toBe(false);
    expect(isFullCommitSha(`${FULL_SHA}aa`)).toBe(false);
  });
});

describe('scanActionPinText', () => {
  it('flags a floating third-party tag', () => {
    const text = ['jobs:', '  build:', '    steps:', '      - uses: actions/checkout@v7'].join(
      '\n',
    );
    expect(scanActionPinText(text, '.github/workflows/ci.yml')).toEqual([
      {
        file: '.github/workflows/ci.yml',
        line: 4,
        uses: 'actions/checkout@v7',
      },
    ]);
  });

  it('accepts a full sha and ignores the version comment', () => {
    const text = `      - uses: actions/checkout@${FULL_SHA} # v7.0.0\n`;
    expect(scanActionPinText(text, '.github/workflows/ci.yml')).toEqual([]);
  });

  it('accepts a local composite action without a pin', () => {
    const text = '        uses: ./.github/actions/e2e-restore-shared\n';
    expect(scanActionPinText(text, '.github/workflows/ci.yml')).toEqual([]);
  });

  it('accepts a local action even when the ref is a tag', () => {
    const text = '        uses: ./.github/actions/demo@v1\n';
    expect(scanActionPinText(text, '.github/actions/demo/action.yml')).toEqual([]);
  });

  it('flags a reusable workflow on a branch ref', () => {
    const text = '    uses: example/repo/.github/workflows/ci.yml@main\n';
    expect(scanActionPinText(text, '.github/workflows/caller.yml')).toEqual([
      {
        file: '.github/workflows/caller.yml',
        line: 1,
        uses: 'example/repo/.github/workflows/ci.yml@main',
      },
    ]);
  });

  it('flags quoted tags and short shas', () => {
    const text = ['- uses: "actions/setup-node@v6"', "- uses: 'actions/checkout@abc1234'"].join(
      '\n',
    );
    expect(scanActionPinText(text, '.github/workflows/ci.yml')).toEqual([
      { file: '.github/workflows/ci.yml', line: 1, uses: 'actions/setup-node@v6' },
      { file: '.github/workflows/ci.yml', line: 2, uses: 'actions/checkout@abc1234' },
    ]);
  });

  it('ignores uses lines inside comments and run scripts', () => {
    const text = [
      '# - uses: actions/checkout@v4',
      'steps:',
      '  - name: Example',
      '    run: |',
      '      echo "uses: actions/checkout@v4"',
      '      uses: actions/setup-node@v6',
      '  - name: Next',
      '    run: echo uses: actions/upload-artifact@v3',
    ].join('\n');
    expect(scanActionPinText(text, '.github/workflows/ci.yml')).toEqual([]);
  });

  it('flags a block-scalar uses value that is still a tag', () => {
    const text = ['- uses: |', '    actions/checkout@v7'].join('\n');
    expect(scanActionPinText(text, '.github/workflows/ci.yml')).toEqual([
      { file: '.github/workflows/ci.yml', line: 1, uses: 'actions/checkout@v7' },
    ]);
  });
});

describe('scanActionPinRoots', () => {
  it('reads workflows and composite actions and skips other files', () => {
    const root = mkdtempSync(join(tmpdir(), 'action-pin-'));
    tempRoots.push(root);
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    mkdirSync(join(root, '.github/actions/demo'), { recursive: true });
    writeFileSync(
      join(root, '.github/workflows/ci.yml'),
      `- uses: actions/checkout@${FULL_SHA} # v7.0.0\n- uses: actions/setup-node@v6\n`,
    );
    writeFileSync(
      join(root, '.github/actions/demo/action.yml'),
      'runs:\n  steps:\n    - uses: ./.github/actions/demo\n',
    );
    writeFileSync(join(root, 'README.md'), 'uses: actions/checkout@v4\n');

    expect(scanActionPinRoots(root)).toEqual([
      {
        file: '.github/workflows/ci.yml',
        line: 2,
        uses: 'actions/setup-node@v6',
      },
    ]);
  });

  it('finds no unpinned third-party uses in this repo', () => {
    expect(scanActionPinRoots(repoRoot)).toEqual([]);
  });
});

describe('quality wiring', () => {
  it('runs from the local quality gate and the Quality job', () => {
    const gate = readFileSync(join(repoRoot, 'scripts/gates/ci-gate.ts'), 'utf8');
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const pkg = readFileSync(join(repoRoot, 'package.json'), 'utf8');
    expect(gate.includes("args: ['validate:action-pins']")).toBe(true);
    expect(workflow.includes('pnpm exec tsx scripts/validate/action-pin.ts')).toBe(true);
    expect(workflow.includes('pnpm validate:action-pins')).toBe(false);
    expect(pkg.includes('"validate:action-pins"')).toBe(true);
  });
});
