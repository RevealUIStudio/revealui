import { describe, expect, it } from 'vitest';

const { SECURITY_PATHS, classifyFiles, decideReviewGate } = require('../security-review-gate.cjs');

const CLEAR_LABEL = 'sec-review:approved';
const noMarker = { status: 'no-marker' };
const holdVerdict = { status: 'hold', reviewer: 'reviewer', timestamp: '2026-07-17T00:13:55Z' };
const clearVerdict = { status: 'clear', reviewer: 'reviewer', timestamp: '2026-07-17T00:20:00Z' };

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

describe('decideReviewGate — a live REQUEST-CHANGES holds, overriding the label', () => {
  it('HOLDS on a live REQUEST-CHANGES even with the clearance label present', () => {
    const d = decideReviewGate({ verdict: holdVerdict, labels: [CLEAR_LABEL] });
    expect(d.action).toBe('hold');
    expect(d.kind).toBe('request-changes');
  });
});

describe('decideReviewGate — B2: an APPROVE marker never clears without the owner label', () => {
  // The #1914 B2 regression: a `clear` guardrail-2 verdict used to exit 0 on its
  // own, so any APPROVE-marker comment (which the PR author can post) cleared the
  // gate with no owner label. A marker is a reviewer proposal; the label is the
  // owner disposition. Clearing requires the label (or an approving review) too.
  it('HOLDS on a clear marker when no owner label / approving review exists', () => {
    const d = decideReviewGate({ verdict: clearVerdict, labels: [] });
    expect(d.action).toBe('hold');
    expect(d.kind).toBe('no-verdict');
  });
  it('CLEARS when the clear marker is accompanied by the owner label', () => {
    const d = decideReviewGate({ verdict: clearVerdict, labels: [CLEAR_LABEL] });
    expect(d.action).toBe('clear');
    expect(d.kind).toBe('label');
  });
  it('CLEARS a no-marker PR on the owner label (legacy path, unchanged)', () => {
    expect(decideReviewGate({ verdict: noMarker, labels: [CLEAR_LABEL] }).action).toBe('clear');
  });
  it('CLEARS a no-marker PR on an approving review (legacy path, unchanged)', () => {
    const d = decideReviewGate({ verdict: noMarker, labels: [], reviewDecision: 'APPROVED' });
    expect(d.action).toBe('clear');
    expect(d.kind).toBe('review');
  });
  it('HOLDS a no-marker PR with neither label nor approving review', () => {
    expect(decideReviewGate({ verdict: noMarker, labels: ['bug'] }).action).toBe('hold');
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
