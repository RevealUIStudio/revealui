import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateMasterSpecCoupling,
  isCanonDirty,
  isMasterSpecTriggerPath,
  type ProductContext,
} from '../hooks/master-spec-coupling.js';

describe('isMasterSpecTriggerPath', () => {
  it('matches contracts and db schema', () => {
    expect(isMasterSpecTriggerPath('/home/u/revfleet/revealui/packages/contracts/src/foo.ts')).toBe(
      true,
    );
    expect(
      isMasterSpecTriggerPath('/home/u/revfleet/revealui/packages/db/src/schema/users.ts'),
    ).toBe(true);
  });

  it('matches apps/*/app and apps/*/src sources', () => {
    expect(isMasterSpecTriggerPath('/home/u/revfleet/revealui/apps/admin/src/app/page.tsx')).toBe(
      true,
    );
    expect(isMasterSpecTriggerPath('/home/u/revfleet/revealui/apps/server/src/index.ts')).toBe(
      true,
    );
  });

  it('skips tests, core package, and docs', () => {
    expect(
      isMasterSpecTriggerPath('/home/u/revfleet/revealui/apps/admin/src/__tests__/x.test.ts'),
    ).toBe(false);
    expect(isMasterSpecTriggerPath('/home/u/revfleet/revealui/packages/core/src/x.ts')).toBe(false);
    expect(isMasterSpecTriggerPath('/home/u/revfleet/revealui/docs/README.md')).toBe(false);
  });
});

describe('isCanonDirty', () => {
  it('matches exact and suffix paths', () => {
    expect(isCanonDirty(['docs/ARCHITECTURE.md'], 'docs/ARCHITECTURE.md')).toBe(true);
    expect(isCanonDirty(['packages/contracts/x.ts'], 'docs/ARCHITECTURE.md')).toBe(false);
  });
});

describe('evaluateMasterSpecCoupling', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'msc-'));
    await mkdir(join(dir, 'docs'), { recursive: true });
    await writeFile(join(dir, 'docs', 'ARCHITECTURE.md'), '# arch\n', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const fixedProduct = (root: string): ((abs: string) => ProductContext | null) => {
    return () => ({
      root,
      name: 'revealui',
      canonRel: 'docs/ARCHITECTURE.md',
    });
  };

  it('warns when trigger path is dirty without canon', () => {
    const file = join(dir, 'packages', 'contracts', 'src', 'x.ts');
    const warnings = evaluateMasterSpecCoupling([file], {
      dirtyPaths: ['packages/contracts/src/x.ts'],
      resolveProduct: fixedProduct(dir),
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.expectedCanon).toBe('docs/ARCHITECTURE.md');
    expect(warnings[0]?.message.includes('GAP-199')).toBe(true);
  });

  it('is silent when canon is also dirty', () => {
    const file = join(dir, 'packages', 'contracts', 'src', 'x.ts');
    const warnings = evaluateMasterSpecCoupling([file], {
      dirtyPaths: ['packages/contracts/src/x.ts', 'docs/ARCHITECTURE.md'],
      resolveProduct: fixedProduct(dir),
    });
    expect(warnings).toHaveLength(0);
  });

  it('dedupes multiple files in the same product', () => {
    const a = join(dir, 'packages', 'contracts', 'src', 'a.ts');
    const b = join(dir, 'packages', 'contracts', 'src', 'b.ts');
    const warnings = evaluateMasterSpecCoupling([a, b], {
      dirtyPaths: ['packages/contracts/src/a.ts', 'packages/contracts/src/b.ts'],
      resolveProduct: fixedProduct(dir),
    });
    expect(warnings).toHaveLength(1);
  });

  it('skips non-trigger paths', () => {
    const file = join(dir, 'docs', 'README.md');
    const warnings = evaluateMasterSpecCoupling([file], {
      dirtyPaths: ['docs/README.md'],
      resolveProduct: fixedProduct(dir),
    });
    expect(warnings).toHaveLength(0);
  });
});
