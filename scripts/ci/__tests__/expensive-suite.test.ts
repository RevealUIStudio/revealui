import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  classifyDsPaths,
  formatCiOutputs,
  isCheapCopyPath,
  shouldRunFullSuite,
} from '../expensive-suite.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('isCheapCopyPath', () => {
  it('treats markdown, docs SoT, docs-pro, and marketing copy as cheap', () => {
    expect(isCheapCopyPath('docs/CI_CD_GUIDE.md')).toBe(true);
    expect(isCheapCopyPath('README.md')).toBe(true);
    expect(isCheapCopyPath('apps/docs/public/docs-pro/guide.mdx')).toBe(true);
    expect(isCheapCopyPath('apps/marketing/app/content/home.ts')).toBe(true);
    expect(isCheapCopyPath('docs/images/arch.png')).toBe(true);
  });

  it('does not treat marketing content tests or product code as cheap', () => {
    expect(isCheapCopyPath('apps/marketing/app/content/__tests__/nav.test.ts')).toBe(false);
    expect(isCheapCopyPath('apps/admin/src/app/page.tsx')).toBe(false);
    expect(isCheapCopyPath('apps/server/src/index.ts')).toBe(false);
    expect(isCheapCopyPath('packages/core/src/index.ts')).toBe(false);
    expect(isCheapCopyPath('pnpm-lock.yaml')).toBe(false);
    expect(isCheapCopyPath('.github/workflows/ci.yml')).toBe(false);
    expect(isCheapCopyPath('apps/admin/Dockerfile.forge')).toBe(false);
    expect(isCheapCopyPath('e2e/smoke.e2e.ts')).toBe(false);
  });
});

describe('shouldRunFullSuite', () => {
  it('skips the expensive suite for docs-only and marketing-copy-only diffs', () => {
    expect(shouldRunFullSuite(['docs/ROADMAP.md', 'README.md'])).toBe(false);
    expect(shouldRunFullSuite(['apps/marketing/app/content/pricing.ts'])).toBe(false);
  });

  it('keeps the full suite for admin, server, packages, lockfile, workflows, Dockerfiles, e2e', () => {
    expect(shouldRunFullSuite(['apps/admin/src/app/page.tsx'])).toBe(true);
    expect(shouldRunFullSuite(['apps/server/src/index.ts'])).toBe(true);
    expect(shouldRunFullSuite(['packages/db/src/schema/users.ts'])).toBe(true);
    expect(shouldRunFullSuite(['pnpm-lock.yaml'])).toBe(true);
    expect(shouldRunFullSuite(['.github/workflows/ci.yml'])).toBe(true);
    expect(shouldRunFullSuite(['apps/server/Dockerfile.forge'])).toBe(true);
    expect(shouldRunFullSuite(['e2e/smoke.e2e.ts'])).toBe(true);
  });

  it('keeps the full suite when copy is mixed with product code', () => {
    expect(shouldRunFullSuite(['docs/ROADMAP.md', 'apps/admin/src/app/page.tsx'])).toBe(true);
  });

  it('fails open to the full suite on an empty diff', () => {
    expect(shouldRunFullSuite([])).toBe(true);
    expect(formatCiOutputs([])).toBe('full_suite=true\n');
  });
});

describe('classifyDsPaths', () => {
  it('does not start showcase visual for admin-only or marketing-only copy', () => {
    expect(classifyDsPaths(['apps/admin/src/app/page.tsx']).showcase).toBe(false);
    expect(classifyDsPaths(['apps/marketing/app/content/home.ts']).showcase).toBe(false);
    expect(classifyDsPaths(['apps/marketing/app/content/home.ts']).marketing).toBe(true);
  });

  it('starts showcase visual for tokens, presentation, docs showcase, and visual e2e', () => {
    expect(classifyDsPaths(['packages/tokens/src/tokens.css']).showcase).toBe(true);
    expect(classifyDsPaths(['packages/presentation/src/components/button.tsx']).showcase).toBe(
      true,
    );
    expect(classifyDsPaths(['apps/docs/app/showcase/button.showcase.tsx']).showcase).toBe(true);
    expect(classifyDsPaths(['e2e/showcase-visual.e2e.ts']).showcase).toBe(true);
  });
});

describe('workflow wiring', () => {
  const ci = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const docker = readFileSync(path.join(repoRoot, '.github/workflows/docker.yml'), 'utf8');
  const ds = readFileSync(path.join(repoRoot, '.github/workflows/ds.yml'), 'utf8');

  it('keeps Quality + Typecheck unconditional and gates expensive CI jobs on full_suite', () => {
    expect(ci).toContain('name: Quality');
    expect(ci).toContain('name: Typecheck');
    expect(ci).toContain("needs.changes.outputs.full_suite == 'true'");
    expect(ci).toContain('pnpm validate:secret-paths');
    const qualityIdx = ci.indexOf('\n  quality:');
    const unitIdx = ci.indexOf('\n  test-unit:');
    const secretIdx = ci.indexOf('pnpm validate:secret-paths');
    expect(qualityIdx).toBeGreaterThan(0);
    expect(unitIdx).toBeGreaterThan(qualityIdx);
    expect(secretIdx).toBeGreaterThan(qualityIdx);
    expect(secretIdx).toBeLessThan(unitIdx);
  });

  it('reports required expensive checks as skip-green instead of leaving them pending', () => {
    for (const name of [
      'Unit Tests',
      'Build',
      'Integration Tests',
      'E2E Smoke',
      'Accessibility (E2E)',
      'Visual Regression (E2E)',
      'Drizzle Migrations',
    ]) {
      expect(ci).toContain(`name: ${name}`);
      expect(ci).toContain(`name: ${name} (suite)`);
    }
  });

  it('skips a second full suite on promote PRs and on push-to-test when a PR already covers the SHA', () => {
    expect(ci).toContain('reason=promote-pr');
    expect(ci).toContain('reason=sha-covered-by-pr');
    expect(ci).toContain(['commits/', '$', '{SHA}/pulls'].join(''));
  });

  it('keeps docker PR image builds behind the existing changes job + Docker images summary', () => {
    expect(docker).toContain('name: Docker images');
    expect(docker).toContain('Detect image-relevant changes');
    expect(docker).toContain("needs.changes.outputs.docker == 'true'");
  });

  it('narrows design-system paths off apps/** and cancels leftover Showcase visual', () => {
    expect(ds).not.toContain("      - 'apps/**'");
    expect(ds).toContain('packages/tokens/**');
    expect(ds).toContain('packages/presentation/**');
    expect(ds).toContain('e2e/showcase-visual.e2e.ts');
    expect(ds).toContain('cancel-in-progress: true');
    const pushIdx = ds.indexOf('push:');
    const pushBlock = ds.slice(pushIdx, pushIdx + 400);
    expect(pushBlock).toContain('branches: [main]');
    expect(pushBlock).toContain('paths:');
  });
});
