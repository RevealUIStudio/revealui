import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DECLARATION_REL,
  digestText,
  evaluateMarketingDeployLockstep,
  findVisibilityClaims,
  hashSurfaces,
  isBotPromoteAttempt,
  isGreenMainDeploy,
  type MainDeployReceipt,
  PRODUCTION_DEPLOY_WORKFLOW,
  parseDeclaration,
  parseLatestDeployRun,
  type SurfaceDigest,
  scanMarketingHonestyClaims,
  surfacesMatch,
} from '../marketing-deploy-lockstep.js';

const ROOT = join(import.meta.dirname, '..', '..', '..');

const HEAD: SurfaceDigest[] = [
  { path: 'apps/marketing/app/content/pricing.ts', sha256: digestText('proof sprint') },
];

function greenDeploy(overrides: Partial<MainDeployReceipt> = {}): MainDeployReceipt {
  return {
    sha: 'abc123',
    conclusion: 'success',
    branch: 'main',
    workflowPath: PRODUCTION_DEPLOY_WORKFLOW,
    ...overrides,
  };
}

describe('evaluateMarketingDeployLockstep', () => {
  it('accepts test honesty that is not claimed customer-visible', () => {
    const verdict = evaluateMarketingDeployLockstep({
      customerVisible: false,
      botPromoteForbidden: true,
      botPromoteAttempt: false,
      headSurfaces: HEAD,
      greenSurfaces: null,
      deploy: null,
      visibilityClaims: [],
      missingSurfaces: [],
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.actuallyCustomerVisible).toBe(false);
  });

  it('rejects a customer-visible claim before main Deploy is green', () => {
    const verdict = evaluateMarketingDeployLockstep({
      customerVisible: true,
      botPromoteForbidden: true,
      botPromoteAttempt: false,
      headSurfaces: HEAD,
      greenSurfaces: null,
      deploy: null,
      visibilityClaims: [],
      missingSurfaces: [],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes('not green'))).toBe(true);
  });

  it('rejects a failed or non-main deploy even when surfaces match', () => {
    const failed = evaluateMarketingDeployLockstep({
      customerVisible: true,
      botPromoteForbidden: true,
      botPromoteAttempt: false,
      headSurfaces: HEAD,
      greenSurfaces: HEAD,
      deploy: greenDeploy({ conclusion: 'failure' }),
      visibilityClaims: [],
      missingSurfaces: [],
    });
    const preview = evaluateMarketingDeployLockstep({
      customerVisible: true,
      botPromoteForbidden: true,
      botPromoteAttempt: false,
      headSurfaces: HEAD,
      greenSurfaces: HEAD,
      deploy: greenDeploy({ branch: 'test' }),
      visibilityClaims: [],
      missingSurfaces: [],
    });
    expect(failed.ok).toBe(false);
    expect(preview.actuallyCustomerVisible).toBe(false);
  });

  it('accepts customer-visible only when surfaces match a green main Deploy', () => {
    const verdict = evaluateMarketingDeployLockstep({
      customerVisible: true,
      botPromoteForbidden: true,
      botPromoteAttempt: false,
      headSurfaces: HEAD,
      greenSurfaces: [...HEAD],
      deploy: greenDeploy(),
      visibilityClaims: [],
      missingSurfaces: [],
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.actuallyCustomerVisible).toBe(true);
  });

  it('rejects prose that calls test honesty customer-visible early', () => {
    const claims = findVisibilityClaims(
      'docs/WHAT_WORKS_TODAY.md',
      'The test honesty is live for customers.\n',
    );
    const verdict = evaluateMarketingDeployLockstep({
      customerVisible: false,
      botPromoteForbidden: true,
      botPromoteAttempt: false,
      headSurfaces: HEAD,
      greenSurfaces: null,
      deploy: null,
      visibilityClaims: claims,
      missingSurfaces: [],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons[0]).toContain('docs/WHAT_WORKS_TODAY.md:1');
  });

  it('exonerates lines that state the ban', () => {
    const claims = findVisibilityClaims(
      'docs/runbooks/marketing-deploy-lockstep.md',
      'Do not describe marketing honesty as customer-visible until main deploy is green.\n',
    );
    expect(claims).toEqual([]);
  });

  it('rejects a bot promote of test to main', () => {
    expect(
      isBotPromoteAttempt({
        actor: 'github-actions[bot]',
        baseRef: 'main',
        headRef: 'test',
      }),
    ).toBe(true);
    expect(isBotPromoteAttempt({ actor: 'dependabot', baseRef: 'main', headRef: 'test' })).toBe(
      true,
    );
    expect(isBotPromoteAttempt({ actor: 'joshua', baseRef: 'main', headRef: 'test' })).toBe(false);
    expect(
      isBotPromoteAttempt({ actor: 'github-actions[bot]', baseRef: 'test', headRef: 'feature/x' }),
    ).toBe(false);

    const verdict = evaluateMarketingDeployLockstep({
      customerVisible: false,
      botPromoteForbidden: true,
      botPromoteAttempt: true,
      headSurfaces: HEAD,
      greenSurfaces: null,
      deploy: null,
      visibilityClaims: [],
      missingSurfaces: [],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons[0]).toContain('Bot must not promote');
  });
});

describe('deploy receipt parsing', () => {
  it('reads the latest successful production run', () => {
    const receipt = parseLatestDeployRun({
      workflow_runs: [
        {
          head_sha: 'deadbeef',
          conclusion: 'success',
          head_branch: 'main',
          path: PRODUCTION_DEPLOY_WORKFLOW,
        },
      ],
    });
    expect(isGreenMainDeploy(receipt)).toBe(true);
    expect(receipt?.sha).toBe('deadbeef');
  });

  it('ignores an empty or malformed payload', () => {
    expect(parseLatestDeployRun({ workflow_runs: [] })).toBeNull();
    expect(parseLatestDeployRun(null)).toBeNull();
    expect(surfacesMatch(HEAD, [{ ...HEAD[0], sha256: 'other' }])).toBe(false);
  });
});

describe('parseDeclaration', () => {
  it('rejects a customer-visible claim while the offer lock is still off main', () => {
    const raw = readFileSync(join(ROOT, DECLARATION_REL), 'utf8');
    const flipped = raw.replace('"customerVisible": false', '"customerVisible": true');
    const parsed = parseDeclaration(flipped);
    expect(parsed.declaration).toBeNull();
    expect(parsed.errors.some((error) => error.includes('not on main'))).toBe(true);
  });
});

describe('committed declaration', () => {
  it('keeps the offer lock off the customer-visible claim', { timeout: 20_000 }, () => {
    const raw = readFileSync(join(ROOT, DECLARATION_REL), 'utf8');
    const parsed = parseDeclaration(raw);
    expect(parsed.errors).toEqual([]);
    expect(parsed.declaration?.customerVisible).toBe(false);
    expect(parsed.declaration?.botPromote).toBe('forbidden');
    expect(parsed.declaration?.offerLock.revealuiPr).toBe(2925);
    expect(parsed.declaration?.offerLock.agencyPr).toBe(211);
    expect(parsed.declaration?.offerLock.onTest).toBe(true);
    expect(parsed.declaration?.offerLock.onMain).toBe(false);
    const hashed = hashSurfaces(ROOT, parsed.declaration?.honestySurfaces ?? []);
    expect(hashed.missing).toEqual([]);
    expect(scanMarketingHonestyClaims(ROOT)).toEqual([]);
  });
});
