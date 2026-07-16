import { describe, expect, it } from 'vitest';

const { SECURITY_PATHS, classifyFiles } = require('../security-review-gate.cjs');

// The enforcement-machinery markers this gate must self-protect. A PR editing
// any of these files has to carry a recorded guardrail-2 verdict before merge.
const ENFORCEMENT_MACHINERY_FILES = [
  'scripts/validate/security-review-gate.cjs',
  'scripts/validate/sec-audit-label-decision.cjs',
  '.github/workflows/security-review-gate.yml',
  '.github/workflows/sec-audit-label-guard.yml',
  '.github/workflows/security.yml',
];

describe('classifyFiles — enforcement-machinery self-protection', () => {
  it.each(ENFORCEMENT_MACHINERY_FILES)('flags %s as security-sensitive', (file) => {
    expect(classifyFiles([file])).toContain(file);
  });

  it('flags a whole changeset when only a machinery file is touched', () => {
    const changed = ['README.md', 'scripts/validate/sec-audit-label-decision.cjs'];
    expect(classifyFiles(changed)).toEqual(['scripts/validate/sec-audit-label-decision.cjs']);
  });

  it('does NOT flag an unrelated file (red-proof for the new markers)', () => {
    // This benign path contains none of the machinery markers. If the markers
    // were removed, ENFORCEMENT_MACHINERY_FILES above would stop being flagged;
    // this line guarantees the markers are not so broad they catch everything.
    expect(classifyFiles(['apps/marketing/app/components/Hero.tsx'])).toEqual([]);
  });
});

describe('SECURITY_PATHS — machinery markers present', () => {
  const MACHINERY_MARKERS = [
    'scripts/validate/security-review-gate',
    'scripts/validate/sec-audit-label-decision',
    '.github/workflows/security-review-gate',
    '.github/workflows/sec-audit-label-guard',
    '.github/workflows/security.yml',
  ];

  it.each(MACHINERY_MARKERS)('includes the %s marker', (marker) => {
    expect(SECURITY_PATHS).toContain(marker);
  });
});
