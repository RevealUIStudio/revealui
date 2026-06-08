import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  countDirs,
  countEnforcementTests,
  extractRevealuiPackages,
  findIncompleteProList,
} from '../claim-drift.ts';

describe('countDirs', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts only directories that contain package.json', () => {
    fs.mkdirSync(path.join(tmp, 'real-pkg'));
    fs.writeFileSync(path.join(tmp, 'real-pkg', 'package.json'), '{}');

    fs.mkdirSync(path.join(tmp, 'no-pkg'));

    expect(countDirs(tmp)).toBe(1);
  });

  it('returns 0 for a non-existent base directory', () => {
    expect(countDirs(path.join(tmp, 'does-not-exist'))).toBe(0);
  });

  it('returns 0 when base contains only files', () => {
    fs.writeFileSync(path.join(tmp, 'file.txt'), '');
    expect(countDirs(tmp)).toBe(0);
  });
});

describe('countEnforcementTests', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-drift-enf-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('counts it()/test() cases across a directory of suites and a single file', () => {
    const dir = path.join(tmp, 'auth');
    fs.mkdirSync(dir);
    // Only *.test.ts files in a directory count; a stray .ts is ignored.
    fs.writeFileSync(
      path.join(dir, 'access.test.ts'),
      "describe('x', () => {\n  it('a', () => {});\n  test('b', () => {});\n});\n",
    );
    fs.writeFileSync(path.join(dir, 'helpers.ts'), "export const it = 'not a test';\n");
    const file = path.join(tmp, 'access-enforcement.test.ts');
    fs.writeFileSync(file, "it('one', () => {});\n  it('two', () => {});\n");
    expect(countEnforcementTests([dir, file])).toBe(4);
  });

  it('does not count it.skip()/it.each() as plain cases', () => {
    const file = path.join(tmp, 'x.test.ts');
    fs.writeFileSync(
      file,
      "it('a', () => {});\nit.skip('b', () => {});\nit.each([1])('c', () => {});\n",
    );
    expect(countEnforcementTests([file])).toBe(1);
  });

  it('returns 0 for missing roots', () => {
    expect(countEnforcementTests([path.join(tmp, 'nope')])).toBe(0);
  });
});

describe('extractRevealuiPackages', () => {
  it('extracts scoped package tokens, stopping at non-package chars', () => {
    expect(
      extractRevealuiPackages('Pro packages (`@revealui/ai`, `@revealui/harnesses`) ship FSL'),
    ).toEqual(['@revealui/ai', '@revealui/harnesses']);
  });

  it('returns an empty array when none are present', () => {
    expect(extractRevealuiPackages('no scoped packages on this line')).toEqual([]);
  });
});

describe('findIncompleteProList', () => {
  const fsl = new Set([
    '@revealui/ai',
    '@revealui/engines',
    '@revealui/harnesses',
    '@revealui/mcp',
    '@revealui/services',
  ]);
  const mit = new Set(['@revealui/core', '@revealui/auth']);

  it('flags a 2-of-5 Pro list', () => {
    expect(
      findIncompleteProList(
        'Pro packages (`@revealui/ai`, `@revealui/harnesses`) are Fair Source',
        fsl,
        mit,
      ),
    ).toEqual(['@revealui/ai', '@revealui/harnesses']);
  });

  it('flags a 3-of-5 Pro list', () => {
    expect(
      findIncompleteProList(
        'Pro packages: @revealui/ai, @revealui/harnesses, @revealui/engines (FSL-1.1-MIT)',
        fsl,
        mit,
      ),
    ).not.toBeNull();
  });

  it('passes the complete 5-package list', () => {
    expect(
      findIncompleteProList(
        'Pro packages: @revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services',
        fsl,
        mit,
      ),
    ).toBeNull();
  });

  it('ignores a single-package mention', () => {
    expect(
      findIncompleteProList('the `@revealui/harnesses` Pro package coordinates agents', fsl, mit),
    ).toBeNull();
  });

  it('ignores mixed MIT + FSL prose (not an enumeration)', () => {
    expect(
      findIncompleteProList(
        'The Pro packages extend `@revealui/core` (MIT) — e.g. `@revealui/ai` and `@revealui/harnesses`',
        fsl,
        mit,
      ),
    ).toBeNull();
  });

  it('ignores lines with no Pro/FSL context', () => {
    expect(
      findIncompleteProList('@revealui/ai and @revealui/harnesses are used here', fsl, mit),
    ).toBeNull();
  });
});
