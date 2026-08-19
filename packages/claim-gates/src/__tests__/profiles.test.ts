import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existingRoots, getProfile, resolveProfile } from '../profiles.ts';
import { runClaimGates } from '../run.ts';

describe('resolveProfile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-gates-profile-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('honors an explicit profile name', () => {
    expect(resolveProfile(tmp, 'marketing-site')).toBe('marketing-site');
    expect(resolveProfile(tmp, 'product-readme')).toBe('product-readme');
  });

  it('detects product-runtime when apps + packages + claims-evidence exist', () => {
    fs.mkdirSync(path.join(tmp, 'apps/marketing/app/content'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'packages'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'apps/marketing/app/content/claims-evidence.ts'),
      'export {};\n',
    );
    expect(resolveProfile(tmp)).toBe('product-runtime');
  });

  it('detects marketing-site for agency-shaped roots (app/ without packages/)', () => {
    fs.mkdirSync(path.join(tmp, 'app'), { recursive: true });
    expect(resolveProfile(tmp)).toBe('marketing-site');
  });

  it('falls back to product-readme', () => {
    fs.writeFileSync(path.join(tmp, 'README.md'), '# hi\n');
    expect(resolveProfile(tmp)).toBe('product-readme');
  });
});

describe('getProfile / existingRoots', () => {
  it('exposes Phase 2 switches on each profile', () => {
    const product = getProfile('product-runtime');
    expect(product.collectMonorepoMetrics).toBe(true);
    expect(product.licenseScanners).toBe(true);
    expect(product.softScanDirs).toBe(false);
    expect(product.copyDependentPaths.length).toBeGreaterThan(0);
    expect(product.copyDependentPaths).toContain('apps/marketing/app/content');
    expect(product.copyDependentPaths).toContain('README.md');

    const marketing = getProfile('marketing-site');
    expect(marketing.collectMonorepoMetrics).toBe(false);
    expect(marketing.licenseScanners).toBe(false);
    expect(marketing.fleetAttributionFiles).toEqual([]);
    expect(marketing.softScanDirs).toBe(true);
    expect(marketing.copyDependentPaths).toEqual(['app']);

    const readme = getProfile('product-readme');
    expect(readme.collectMonorepoMetrics).toBe(false);
    expect(readme.softScanDirs).toBe(true);
    // Sibling product docs intentionally name fleet peers (see profiles.ts).
    expect(readme.fleetAttributionFiles).toEqual([]);
  });

  it('filters candidates to paths that exist under root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-gates-roots-'));
    try {
      fs.writeFileSync(path.join(tmp, 'README.md'), '# x\n');
      fs.mkdirSync(path.join(tmp, 'docs'));
      expect(existingRoots(tmp, ['README.md', 'docs', 'missing.md'])).toEqual([
        'README.md',
        'docs',
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('runClaimGates warn mode', () => {
  it('exits 0 with --warn even when unlinked future-tense would fail hard', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-gates-warn-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'README.md'),
        [
          '# Fixture',
          '',
          // Unlinked future-tense marker (no issue/PR/milestone/workflow cite).
          'The second surface (coming soon) will land later.',
          '',
        ].join('\n'),
      );
      const hard = runClaimGates({
        root: tmp,
        profile: 'product-readme',
        argv: [],
      });
      expect(hard.ok).toBe(false);
      expect(hard.exitCode).toBe(1);

      const warn = runClaimGates({
        root: tmp,
        profile: 'product-readme',
        warn: true,
        argv: ['--warn'],
      });
      expect(warn.ok).toBe(false);
      expect(warn.exitCode).toBe(0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
