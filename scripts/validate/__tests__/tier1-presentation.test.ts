import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCAN_ROOTS,
  isAllowlisted,
  parseCliArgs,
  partitionHits,
  scanFile,
} from '../tier1-presentation';

describe('parseCliArgs', () => {
  it('defaults to the monorepo GAP-479 scan window', () => {
    const opts = parseCliArgs([], '/repo');
    expect(opts.hardFail).toBe(true);
    expect(opts.scanRoots).toEqual([...DEFAULT_SCAN_ROOTS]);
    expect(opts.scanRoots).toContain('packages/core');
    expect(opts.scanRoots).toContain('packages/cli/templates');
    expect(opts.scanRoots).toContain('apps/rsc-poc');
  });

  it('accepts --warn to keep a warn-only run', () => {
    expect(parseCliArgs(['--warn'], '/repo').hardFail).toBe(false);
  });

  it('accepts --repo-root, --root, --hard-fail, and --allowlist', () => {
    const opts = parseCliArgs(
      [
        '--repo-root',
        '/demo',
        '--root',
        'app',
        '--root',
        'src',
        '--hard-fail',
        '--allowlist',
        '/demo/allow.json',
      ],
      '/repo',
    );
    expect(opts.repoRoot).toBe('/demo');
    expect(opts.scanRoots).toEqual(['app', 'src']);
    expect(opts.hardFail).toBe(true);
    expect(opts.allowlistPath).toBe('/demo/allow.json');
  });
});

describe('scanFile + allowlist', () => {
  it('flags Tier-1 host tags and ignores composed components', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tier1-'));
    const file = join(dir, 'Page.tsx');
    writeFileSync(
      file,
      `export function Page() {
  return (
    <section>
      <Button>ok</Button>
      <input type="text" />
      <button type="button">raw</button>
    </section>
  );
}
`,
      'utf8',
    );
    const hits = scanFile(file, dir);
    expect(hits.map((h) => h.tag).sort()).toEqual(['button', 'input']);
  });

  it('requires a non-empty reason to allowlist', () => {
    expect(isAllowlisted('a.tsx', 'button', [{ path: 'a.tsx', tag: 'button', reason: '' }])).toBe(
      false,
    );
    expect(
      isAllowlisted('a.tsx', 'button', [
        { path: 'a.tsx', tag: 'button', reason: 'chart primitive' },
      ]),
    ).toBe(true);
  });

  it('partitions allowlisted hits from violations', () => {
    const { violations, allowlisted } = partitionHits(
      [
        { path: 'a.tsx', tag: 'button', line: 1, col: 1 },
        { path: 'b.tsx', tag: 'svg', line: 2, col: 1 },
      ],
      [{ path: 'b.tsx', tag: 'svg', reason: 'data-driven chart' }],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe('a.tsx');
    expect(allowlisted).toHaveLength(1);
  });
});
