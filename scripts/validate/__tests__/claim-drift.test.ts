import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countDirs, extractRevealuiPackages, findIncompleteProList } from '../claim-drift.ts';

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
