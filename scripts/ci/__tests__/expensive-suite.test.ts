import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  classifyDsPaths,
  formatCiOutputs,
  isCheapCopyPath,
  isSameRepoTestToMainPromotion,
  shouldRunFullSuite,
} from '../expensive-suite.mjs';

interface PromotionEvent {
  eventName: string;
  baseRef: string;
  headRef: string;
  headRepo: string;
  repo: string;
}

const sameRepo = 'RevealUIStudio/revealui';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('integration package selection', () => {
  it('selects the maintained integration package and refuses an unmatched filter', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, 'packages/test/package.json'), 'utf8'),
    ) as { name: string };
    const workflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const start = workflow.indexOf('  test-integration-extended:');
    const end = workflow.indexOf(
      '\n  # ---------------------------------------------------------------------------',
      start,
    );
    const job = workflow.slice(start, end);
    const command = job
      .split('\n')
      .map((line) => line.trim())
      .find(
        (line) => line.startsWith('run: pnpm --filter ') && line.includes('run test:integration'),
      );
    expect(command).toBeDefined();
    expect(command?.split(' ')[3]).toBe(manifest.name);
    expect(command).toContain('--fail-if-no-match');
    expect(job).toContain('TEST_DATABASE_URL:');
  });
});

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

describe('isSameRepoTestToMainPromotion', () => {
  const promotion: PromotionEvent = {
    eventName: 'pull_request',
    baseRef: 'main',
    headRef: 'test',
    headRepo: sameRepo,
    repo: sameRepo,
  };

  function promotionSkipToken(event: PromotionEvent): string {
    const result = spawnSync(
      process.execPath,
      [path.join(repoRoot, 'scripts/ci/expensive-suite.mjs'), '--promotion-skip'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          EVENT_NAME: event.eventName,
          BASE_REF: event.baseRef,
          HEAD_REF: event.headRef,
          HEAD_REPO: event.headRepo,
          REPO: event.repo,
        },
      },
    );
    expect(result.status).toBe(0);
    return result.stdout;
  }

  it('skips the expensive suite for a same-repo test to main promotion', () => {
    expect(isSameRepoTestToMainPromotion(promotion)).toBe(true);
    expect(promotionSkipToken(promotion)).toBe('promote-pr\n');
  });

  it('runs the full suite when a non-test head targets main', () => {
    const featureHead: PromotionEvent = { ...promotion, headRef: 'feature/coverage' };
    const prefixedHead: PromotionEvent = { ...promotion, headRef: 'refs/heads/test' };
    expect(isSameRepoTestToMainPromotion(featureHead)).toBe(false);
    expect(isSameRepoTestToMainPromotion(prefixedHead)).toBe(false);
    expect(promotionSkipToken(featureHead)).toBe('continue\n');
  });

  it('runs the full suite when a fork head named test targets main', () => {
    const forkHead: PromotionEvent = { ...promotion, headRepo: 'contributor/revealui' };
    const missingHeadRepo: PromotionEvent = { ...promotion, headRepo: '' };
    expect(isSameRepoTestToMainPromotion(forkHead)).toBe(false);
    expect(isSameRepoTestToMainPromotion(missingHeadRepo)).toBe(false);
    expect(promotionSkipToken(forkHead)).toBe('continue\n');
  });

  it('leaves a pull request into test on the existing path classifier', () => {
    const intoTest: PromotionEvent = { ...promotion, baseRef: 'test', headRef: 'feature/coverage' };
    const headNamedTest: PromotionEvent = { ...promotion, baseRef: 'test', headRef: 'test' };
    expect(isSameRepoTestToMainPromotion(intoTest)).toBe(false);
    expect(isSameRepoTestToMainPromotion(headNamedTest)).toBe(false);
    expect(promotionSkipToken(intoTest)).toBe('continue\n');
    expect(shouldRunFullSuite(['docs/ROADMAP.md', 'README.md'])).toBe(false);
    expect(shouldRunFullSuite(['apps/admin/src/app/page.tsx'])).toBe(true);
    expect(shouldRunFullSuite([])).toBe(true);
  });

  it('does not skip a push to main', () => {
    expect(
      isSameRepoTestToMainPromotion({
        eventName: 'push',
        baseRef: '',
        headRef: '',
        headRepo: '',
        repo: sameRepo,
      }),
    ).toBe(false);
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
    expect(
      classifyDsPaths(['e2e/__snapshots__/showcase-visual.e2e.ts/receipt-card-light-chromium.png'])
        .showcase,
    ).toBe(true);
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
    const qualityIdx = ci.indexOf('\n  quality:');
    const unitIdx = ci.indexOf('\n  test-unit:');
    const secretIdx = ci.indexOf('node "$script"');
    const runner = readFileSync(path.join(repoRoot, 'scripts/ci/run-base-validators.mjs'), 'utf8');
    expect(runner).toContain('scripts/sync/__tests__/secret-paths-lockstep.test.ts');
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

  it('installs Playwright chromium and builds E2E apps once, then reuses artifacts', () => {
    const installScript = 'scripts/ci/playwright-install-chromium.sh';
    const prepareIdx = ci.indexOf('\n  e2e-prepare:');
    const smokeIdx = ci.indexOf('\n  e2e-smoke:');
    const a11yIdx = ci.indexOf('\n  e2e-accessibility:');
    const visualIdx = ci.indexOf('\n  e2e-visual:');
    const extendedIdx = ci.indexOf('\n  test-integration-extended:');
    expect(prepareIdx).toBeGreaterThan(0);
    expect(smokeIdx).toBeGreaterThan(prepareIdx);
    expect(a11yIdx).toBeGreaterThan(smokeIdx);
    expect(visualIdx).toBeGreaterThan(a11yIdx);
    expect(extendedIdx).toBeGreaterThan(visualIdx);

    const prepareBlock = ci.slice(prepareIdx, smokeIdx);
    const smokeBlock = ci.slice(smokeIdx, a11yIdx);
    const a11yBlock = ci.slice(a11yIdx, visualIdx);
    const visualBlock = ci.slice(visualIdx, extendedIdx);

    expect(prepareBlock).toContain('name: E2E Prepare (suite)');
    expect(prepareBlock).toContain(installScript);
    expect(prepareBlock).toContain('name: e2e-workspace-build');
    expect(prepareBlock).toContain('name: e2e-playwright-browsers');
    // upload-artifact skips leading-dot paths unless include-hidden-files is set.
    expect(prepareBlock).toContain('path: playwright-browsers');
    expect(prepareBlock).not.toContain('path: .playwright-browsers');
    expect(prepareBlock).toContain('--filter admin...');
    expect(prepareBlock).toContain('--filter server...');
    expect(prepareBlock).toContain('--filter marketing...');

    expect(smokeBlock).not.toContain(installScript);
    expect(a11yBlock).not.toContain(installScript);
    expect(visualBlock).not.toContain(installScript);
    expect(smokeBlock).toContain('e2e-restore-shared');
    expect(a11yBlock).toContain('e2e-restore-shared');
    expect(visualBlock).toContain('e2e-restore-shared');
    expect(ci).toContain('name: e2e-results');

    const restore = readFileSync(
      path.join(repoRoot, '.github/actions/e2e-restore-shared/action.yml'),
      'utf8',
    );
    expect(restore).toContain('chmod -R a+x playwright-browsers');
  });

  it('skips a second full suite on promote PRs and on push-to-test when a PR already covers the SHA', () => {
    const changesStart = ci.indexOf('\n  changes:');
    const changesEnd = ci.indexOf('\n  ensure-ci-images:');
    const changes = ci.slice(changesStart, changesEnd);
    const blanketMainPullRequest = [
      '[ "$EVENT_NAME" = "pull_request" ] && [ "',
      '$',
      '{BASE_REF:-}" = "main" ]',
    ].join('');

    expect(changesStart).toBeGreaterThan(0);
    expect(changesEnd).toBeGreaterThan(changesStart);
    expect(changes).toContain('reason=promote-pr');
    expect(changes).toContain(
      'node trusted-classifier/scripts/ci/expensive-suite.mjs --promotion-skip',
    );
    expect(changes.includes('node scripts/ci/expensive-suite.mjs')).toBe(false);
    expect(changes).toContain(['HEAD_REF: ', '$', '{{ github.head_ref }}'].join(''));
    expect(changes).toContain(
      ['HEAD_REPO: ', '$', '{{ github.event.pull_request.head.repo.full_name }}'].join(''),
    );
    expect(changes).toContain('[ "$promotion" = "promote-pr" ]');
    expect(changes).not.toContain(blanketMainPullRequest);
    expect(ci).toContain('reason=sha-covered-by-pr');
    expect(ci).toContain(['commits/', '$', '{SHA}/pulls'].join(''));
  });

  it('schedules Coverage for a full suite on push to main or a pull request into main', () => {
    const coverageStart = ci.indexOf('\n  coverage:');
    const coverageEnd = ci.indexOf('\n  build:');
    const coverage = ci.slice(coverageStart, coverageEnd);
    expect(coverageStart).toBeGreaterThan(0);
    expect(coverageEnd).toBeGreaterThan(coverageStart);
    expect(coverage).toContain('name: Coverage (suite)');
    expect(coverage).toContain(
      "if: needs.changes.outputs.full_suite == 'true' && (github.ref == 'refs/heads/main' || github.base_ref == 'main')",
    );
  });

  it('keeps the Quality job off the expensive-suite gate', () => {
    const qualityStart = ci.indexOf('\n  quality:');
    const qualityEnd = ci.indexOf('\n  db-migrations:');
    const quality = ci.slice(qualityStart, qualityEnd);
    expect(quality).toContain('name: Quality');
    expect(quality).not.toContain('needs.changes.outputs.full_suite');
  });

  it('keeps docker PR image builds behind the existing changes job + Docker images summary', () => {
    expect(docker).toContain('name: Docker images');
    expect(docker).toContain('Detect image-relevant changes');
    expect(docker).toContain("needs.changes.outputs.docker == 'true'");
  });

  it('keeps workspace manifest changes in the Docker image build selector', () => {
    const controllerOnlySelector = docker.match(
      /apps\/review-controller\/\*\|packages\/harnesses\/\*\)([\s\S]*?);;/,
    )?.[0];
    const dockerSelector = docker.match(
      /apps\/admin\/\*\|apps\/server\/\*[\s\S]*?\.github\/actions\/setup-pnpm-node\/\*\)([\s\S]*?);;/,
    )?.[0];

    expect(controllerOnlySelector).toContain('review_controller=true');
    expect(controllerOnlySelector).not.toContain('pnpm-lock.yaml');
    expect(controllerOnlySelector).not.toContain('package.json');
    expect(dockerSelector).toContain('pnpm-lock.yaml');
    expect(dockerSelector).toContain('package.json');
    expect(dockerSelector).toContain('docker=true');
  });

  it('narrows design-system paths off apps/** and cancels leftover Showcase visual', () => {
    expect(ds).not.toContain("      - 'apps/**'");
    expect(ds).toContain('packages/tokens/**');
    expect(ds).toContain('packages/presentation/**');
    expect(ds).toContain('e2e/showcase-visual.e2e.ts');
    expect(ds).toContain('e2e/__snapshots__/showcase-visual.e2e.ts/**');
    expect(ds).toContain('cancel-in-progress: true');
    const pushIdx = ds.indexOf('push:');
    const pushBlock = ds.slice(pushIdx, pushIdx + 400);
    expect(pushBlock).toContain('branches: [main]');
    expect(pushBlock).toContain('paths:');
  });
});
