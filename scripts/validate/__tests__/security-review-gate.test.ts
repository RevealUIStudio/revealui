import { describe, expect, it } from 'vitest';

const {
  SECURITY_PATHS,
  classifyFiles,
  resolveGateDecision,
} = require('../security-review-gate.cjs');

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

describe('resolveGateDecision — clearance policy (B2: marker alone never merges)', () => {
  it('non-security-sensitive PR always clears', () => {
    expect(
      resolveGateDecision({
        securitySensitive: false,
        verdictStatus: 'no-marker',
        hasOwnerClearance: false,
      }).clear,
    ).toBe(true);
  });

  it('a live REQUEST-CHANGES holds even WITH owner clearance', () => {
    const d = resolveGateDecision({
      securitySensitive: true,
      verdictStatus: 'hold',
      hasOwnerClearance: true,
    });
    expect(d.clear).toBe(false);
    expect(d.kind).toBe('hold');
  });

  // The B2 regression: before the fix, a `clear` marker exited 0 without ever
  // consulting the label, so a self-posted APPROVE comment cleared the gate.
  it('B2: a clear APPROVE marker WITHOUT owner clearance HOLDS', () => {
    const d = resolveGateDecision({
      securitySensitive: true,
      verdictStatus: 'clear',
      hasOwnerClearance: false,
    });
    expect(d.clear).toBe(false);
    expect(d.kind).toBe('verdict-without-owner');
  });

  it('a clear APPROVE marker WITH owner clearance clears', () => {
    const d = resolveGateDecision({
      securitySensitive: true,
      verdictStatus: 'clear',
      hasOwnerClearance: true,
    });
    expect(d.clear).toBe(true);
    expect(d.kind).toBe('verdict-and-owner');
  });

  it('no marker + no owner clearance holds (legacy path, security-sensitive)', () => {
    const d = resolveGateDecision({
      securitySensitive: true,
      verdictStatus: 'no-marker',
      hasOwnerClearance: false,
    });
    expect(d.clear).toBe(false);
    expect(d.kind).toBe('no-verdict');
  });

  it('no marker + owner clearance clears (legacy backward-compat)', () => {
    const d = resolveGateDecision({
      securitySensitive: true,
      verdictStatus: 'no-marker',
      hasOwnerClearance: true,
    });
    expect(d.clear).toBe(true);
    expect(d.kind).toBe('legacy-owner');
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
