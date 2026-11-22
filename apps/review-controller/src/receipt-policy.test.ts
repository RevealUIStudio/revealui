import { generateKeyPairSync } from 'node:crypto';
import { REVIEW_RECEIPT_SECURITY_CHECKS } from '@revealui/security/review-receipt';
import { describe, expect, it } from 'vitest';
import { assertReceiptPublicationScope, readReceiptPolicy } from './receipt-policy.js';

const { privateKey } = generateKeyPairSync('ed25519');
const securityChecks = REVIEW_RECEIPT_SECURITY_CHECKS.map((check) =>
  check.appId === 15368
    ? {
        ...check,
        workflowId: 100,
        workflowPath: '.github/workflows/security.yml',
        event: 'pull_request',
      }
    : check,
);
const ciCheck = {
  name: 'CI Feedback',
  appId: 15368,
  workflowId: 220400161,
  workflowPath: '.github/workflows/ci.yml',
  event: 'pull_request',
};
const valid = {
  REVIEW_RECEIPT_MODE: 'shadow',
  GITHUB_REPOSITORY_FULL_NAME: 'RevealUIStudio/revealui',
  REVIEW_RECEIPT_KEY_ID: 'receipt-key-1',
  REVIEW_RECEIPT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim(),
  REVIEW_RECEIPT_POLICY_VERSION: 'policy-1',
  REVIEW_RECEIPT_MAX_LIFETIME_MS: '21600000',
  REVIEW_RECEIPT_REQUIRED_CHECKS: JSON.stringify([ciCheck, ...securityChecks]),
};

describe('readReceiptPolicy', () => {
  it('keeps receipt evaluation disabled unless shadow mode is selected', () => {
    expect(readReceiptPolicy({})).toBeUndefined();
  });

  it('parses stable check selectors and bounds receipt lifetime', () => {
    expect(readReceiptPolicy(valid)).toEqual({
      mode: 'shadow',
      repositoryFullName: 'RevealUIStudio/revealui',
      keyId: 'receipt-key-1',
      privateKey: valid.REVIEW_RECEIPT_PRIVATE_KEY,
      version: 'policy-1',
      maxLifetimeMs: 21_600_000,
      requiredChecks: [ciCheck, ...securityChecks],
    });
  });

  it('rejects partial, unknown, duplicate, or empty policy configuration', () => {
    expect(() => readReceiptPolicy({ REVIEW_RECEIPT_KEY_ID: 'receipt-key-1' })).toThrow(
      'REVIEW_RECEIPT_MODE is required',
    );
    expect(() => readReceiptPolicy({ REVIEW_RECEIPT_MODE: 'enabled' })).toThrow(
      'REVIEW_RECEIPT_MODE must be shadow or publish',
    );
    expect(() => readReceiptPolicy({ ...valid, REVIEW_RECEIPT_PRIVATE_KEY: '' })).toThrow(
      'REVIEW_RECEIPT_PRIVATE_KEY is required',
    );
    expect(() => readReceiptPolicy({ ...valid, REVIEW_RECEIPT_REQUIRED_CHECKS: '[]' })).toThrow(
      'must contain 1 to 64 entries',
    );
    expect(() =>
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REQUIRED_CHECKS: '[{"name":"CI","appId":77}]',
      }),
    ).toThrow('omits a mandatory security check');
    expect(() =>
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REQUIRED_CHECKS: '[{"name":"CI","appId":77},{"name":"CI","appId":77}]',
      }),
    ).toThrow('duplicate selectors');
    expect(() =>
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REQUIRED_CHECKS: JSON.stringify([
          { name: 'CI Feedback', appId: 15368 },
          ...securityChecks,
        ]),
      }),
    ).toThrow('invalid selector');
    expect(() =>
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REQUIRED_CHECKS: JSON.stringify([
          { name: 'Other CI', appId: 77 },
          ...securityChecks,
        ]),
      }),
    ).toThrow('omits the trusted CI check');
  });

  it('accepts publish mode while requiring the same complete signing policy', () => {
    expect(
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_MODE: 'publish',
        GITHUB_REPOSITORY_ID: '300',
        REVIEW_RECEIPT_PUBLICATION_SCOPE: JSON.stringify({
          repositoryId: 300,
          repositoryFullName: 'RevealUIStudio/revealui',
          pullRequests: [7],
        }),
      }),
    ).toMatchObject({
      mode: 'publish',
      repositoryFullName: 'RevealUIStudio/revealui',
    });
  });

  it('pins a separate reviewer App to both its bot login and numeric account ID', () => {
    expect(
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REVIEWER_LOGIN: 'revealui-reviewer[bot]',
        REVIEW_RECEIPT_REVIEWER_ID: '90211',
        REVIEW_RECEIPT_REVIEWER_POLICY_VERSION: 'review-policy-1',
        REVIEW_RECEIPT_REVIEWER_MODEL: 'gpt-6-astra',
      })?.trustedReviewer,
    ).toEqual({
      login: 'revealui-reviewer[bot]',
      id: 90211,
      policyVersion: 'review-policy-1',
      model: 'gpt-6-astra',
    });
    expect(() =>
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REVIEWER_LOGIN: 'revealui-reviewer[bot]',
      }),
    ).toThrow('must be set together');
    expect(() =>
      readReceiptPolicy({
        ...valid,
        REVIEW_RECEIPT_REVIEWER_LOGIN: 'revealui-reviewer[bot]',
        REVIEW_RECEIPT_REVIEWER_ID: '0',
        REVIEW_RECEIPT_REVIEWER_POLICY_VERSION: 'review-policy-1',
        REVIEW_RECEIPT_REVIEWER_MODEL: 'gpt-6-astra',
      }),
    ).toThrow('invalid trusted reviewer App identity');
  });
});

describe('bounded receipt publication policy', () => {
  const scope = {
    repositoryId: 300,
    repositoryFullName: 'RevealUIStudio/revealui',
    pullRequests: [7],
  };
  const publish = { ...valid, REVIEW_RECEIPT_MODE: 'publish', GITHUB_REPOSITORY_ID: '300' };
  it('requires an explicit bounded publication scope', () => {
    expect(() => readReceiptPolicy(publish)).toThrow('REVIEW_RECEIPT_PUBLICATION_SCOPE');
  });
  it.each([
    null,
    [],
    {},
    { ...scope, repositoryId: 301 },
    { ...scope, repositoryFullName: 'Other/repo' },
    { ...scope, pullRequests: [] },
    { ...scope, pullRequests: [7, 7] },
    { ...scope, pullRequests: ['7'] },
    { ...scope, pullRequests: [0] },
    { ...scope, pullRequests: Array.from({ length: 17 }, (_, i) => i + 1) },
    { ...scope, wildcard: true },
  ])('rejects malformed or overbroad scope %j', (value) => {
    expect(() =>
      readReceiptPolicy({ ...publish, REVIEW_RECEIPT_PUBLICATION_SCOPE: JSON.stringify(value) }),
    ).toThrow();
  });
  it('admits only the configured numeric repository and PR', () => {
    const policy = readReceiptPolicy({
      ...publish,
      REVIEW_RECEIPT_PUBLICATION_SCOPE: JSON.stringify(scope),
    });
    expect(() => assertReceiptPublicationScope(policy, 300, 7)).not.toThrow();
    expect(() => assertReceiptPublicationScope(policy, 301, 7)).toThrow(
      'receipt_publication_out_of_scope',
    );
    expect(() => assertReceiptPublicationScope(policy, 300, 8)).toThrow(
      'receipt_publication_out_of_scope',
    );
  });
});
