import { describe, expect, it } from 'vitest';
import {
  classifySecurityPaths,
  classifySecurityPathsAtApiLimit,
  MAX_CLASSIFIABLE_SECURITY_PATHS,
  SECURITY_PATH_CLASSIFIER_VERSION,
  SECURITY_PATH_MARKERS,
} from '../security-path-classifier.js';

describe('shared security path classifier', () => {
  it('uses the canonical marker list and identifies its classifier version', () => {
    expect(SECURITY_PATH_CLASSIFIER_VERSION).toBe('shared-security-paths-v1');
    expect(SECURITY_PATH_MARKERS).toContain('packages/security/');
    expect(classifySecurityPaths(['apps/marketing/page.tsx'])).toEqual([]);
    expect(classifySecurityPaths(['packages/security/credentials.ts'])).toEqual([
      'packages/security/credentials.ts',
    ]);
  });

  it('fails closed at the changed-file API ceiling', () => {
    expect(
      classifySecurityPathsAtApiLimit(['docs/readme.md'], MAX_CLASSIFIABLE_SECURITY_PATHS),
    ).toEqual(['(file list at the API ceiling — unclassifiable, failing closed)']);
    expect(classifySecurityPathsAtApiLimit(['docs/readme.md'], Number.NaN)).toEqual([
      '(file list count is invalid — unclassifiable, failing closed)',
    ]);
  });
});
