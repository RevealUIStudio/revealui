import { generateKeyPairSync } from 'node:crypto';
import { REVIEW_RECEIPT_SECURITY_CHECKS } from '@revealui/security/review-receipt';
import { describe, expect, it } from 'vitest';
import { readReceiptPolicy } from './receipt-policy.js';

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
    expect(readReceiptPolicy({ ...valid, REVIEW_RECEIPT_MODE: 'publish' })).toMatchObject({
      mode: 'publish',
      repositoryFullName: 'RevealUIStudio/revealui',
    });
  });
});
