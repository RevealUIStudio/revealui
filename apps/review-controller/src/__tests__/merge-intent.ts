import type { MergeIntent } from '../merge-admission.js';
export const mergeIntentNow = new Date('2026-10-22T22:00:00.000Z');
export function makeMergeIntent(overrides: Partial<MergeIntent> = {}): MergeIntent {
  return {
    schema: 'revealfleet-merge-intent/v1',
    purpose: 'validation-only',
    jobId: '1'.repeat(64),
    repositoryId: 300,
    repository: 'RevealUIStudio/revealui',
    pullRequest: 7,
    baseRef: 'refs/heads/test',
    headRef: 'refs/heads/feature',
    baseOid: 'a'.repeat(40),
    headOid: 'b'.repeat(40),
    mergeOid: 'c'.repeat(40),
    treeOid: 'd'.repeat(40),
    parents: ['a'.repeat(40), 'b'.repeat(40)],
    receiptSha256: 'e'.repeat(64),
    ownerGrantSha256: 'f'.repeat(64),
    receiptExpiresAt: '2026-10-22T22:01:00.000Z',
    grantExpiresAt: '2026-10-22T22:01:00.000Z',
    authorizationGeneration: 3,
    signerKeyId: 'fixture',
    ...overrides,
  };
}
