import { describe, expect, it } from 'vitest';
import {
  CONTROLLER_PATH_MARKERS,
  classifyControllerPaths,
  classifySecurityPaths,
  classifySecurityPathsAtApiLimit,
  classifySensitivePaths,
  MAX_CLASSIFIABLE_SECURITY_PATHS,
  SECURITY_PATH_CLASSIFIER_VERSION,
  SECURITY_PATH_MARKERS,
  SENSITIVE_PATH_MARKERS,
} from '../security-path-classifier.js';

describe('shared security path classifier', () => {
  it('uses the canonical marker list and identifies its classifier version', () => {
    expect(SECURITY_PATH_CLASSIFIER_VERSION).toBe('shared-security-paths-v1');
    expect(SECURITY_PATH_MARKERS).toContain('packages/security/');
    expect(classifySecurityPaths(['apps/marketing/page.tsx'])).toEqual([]);
    expect(classifySecurityPaths(['packages/security/credentials.ts'])).toEqual([
      'packages/security/credentials.ts',
    ]);
    expect(SENSITIVE_PATH_MARKERS).toContain('scripts/ci/');
    expect(SENSITIVE_PATH_MARKERS).toContain('scripts/**/gates-resolver.cjs');
    expect(CONTROLLER_PATH_MARKERS).toEqual(['apps/review-controller/']);
    expect(classifySensitivePaths(['scripts/validate/gates-resolver.cjs'])).toEqual([
      'scripts/validate/gates-resolver.cjs',
    ]);
    expect(classifySensitivePaths(['docs/gates-resolver.cjs'])).toEqual([]);
    expect(classifyControllerPaths(['apps/review-controller/fly.toml'])).toEqual([
      'apps/review-controller/fly.toml',
    ]);
    expect(classifyControllerPaths(['apps/server/fly.toml'])).toEqual([]);
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
