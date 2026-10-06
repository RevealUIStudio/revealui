import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readReceiptPolicy } from './receipt-policy.js';

const { privateKey } = generateKeyPairSync('ed25519');
const valid = {
  REVIEW_RECEIPT_MODE: 'shadow',
  GITHUB_REPOSITORY_FULL_NAME: 'RevealUIStudio/revealui',
  REVIEW_RECEIPT_KEY_ID: 'receipt-key-1',
  REVIEW_RECEIPT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim(),
  REVIEW_RECEIPT_POLICY_VERSION: 'policy-1',
  REVIEW_RECEIPT_MAX_LIFETIME_MS: '21600000',
  REVIEW_RECEIPT_REQUIRED_CHECKS: '[{"name":"CI","appId":77}]',
};

describe('readReceiptPolicy', () => {
  it('keeps receipt evaluation disabled unless shadow mode is selected', () => {
    expect(readReceiptPolicy({})).toBeUndefined();
  });

  it('parses stable check selectors and bounds receipt lifetime', () => {
    expect(readReceiptPolicy(valid)).toEqual({
      repositoryFullName: 'RevealUIStudio/revealui',
      keyId: 'receipt-key-1',
      privateKey: valid.REVIEW_RECEIPT_PRIVATE_KEY,
      version: 'policy-1',
      maxLifetimeMs: 21_600_000,
      requiredChecks: [{ name: 'CI', appId: 77 }],
    });
  });

  it('rejects partial, unknown, duplicate, or empty policy configuration', () => {
    expect(() => readReceiptPolicy({ REVIEW_RECEIPT_KEY_ID: 'receipt-key-1' })).toThrow(
      'REVIEW_RECEIPT_MODE is required',
    );
    expect(() => readReceiptPolicy({ REVIEW_RECEIPT_MODE: 'enabled' })).toThrow(
      'REVIEW_RECEIPT_MODE must be shadow',
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
        REVIEW_RECEIPT_REQUIRED_CHECKS: '[{"name":"CI","appId":77},{"name":"CI","appId":77}]',
      }),
    ).toThrow('duplicate selectors');
  });
});
