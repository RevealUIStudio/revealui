import { describe, expect, it } from 'vitest';

const {
  SECURITY_PATHS,
  MAX_CLASSIFIABLE_FILES,
  classifyFiles,
  decideReviewGate,
  fetchPrFiles,
  hitsForFiles,
} = require('../security-review-gate.cjs');

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

describe('fetchPrFiles — the full paginated list, not the 100-file window', () => {
  // The regression this pins: `gh pr view --json files` caps at 100 entries, so a
  // 641-file promotion whose 19 security paths all sat beyond the window was
  // classified "not security-sensitive" by a REQUIRED check. The fetch must page
  // the REST endpoint and classification must see every file.
  const sensitive = '.github/workflows/security-review-gate.yml';
  const bigList = Array.from({ length: 150 }, (_, i) =>
    i === 120 ? sensitive : `apps/docs/content/page-${String(i).padStart(3, '0')}.md`,
  );

  it('returns every file and classification sees a sensitive path beyond index 100', () => {
    const calls: string[][] = [];
    const ghImpl = (args: string[]) => {
      calls.push(args);
      return `${bigList.join('\n')}\n`;
    };
    const files = fetchPrFiles(1925, 'RevealUIStudio/revealui', ghImpl);
    expect(files).toHaveLength(150);
    expect(calls[0]).toContain('api');
    expect(calls[0]).toContain('--paginate');
    expect(calls[0]).toContain('repos/RevealUIStudio/revealui/pulls/1925/files');
    expect(classifyFiles(files)).toContain(sensitive);
  });

  it('resolves the repo from the current directory when --repo is absent', () => {
    const calls: string[][] = [];
    const ghImpl = (args: string[]) => {
      calls.push(args);
      return 'README.md\n';
    };
    fetchPrFiles(7, undefined, ghImpl);
    expect(calls[0]).toContain('repos/{owner}/{repo}/pulls/7/files');
  });
});

describe('hitsForFiles — the API ceiling fails closed', () => {
  const benign = (n: number) => Array.from({ length: n }, (_, i) => `docs/page-${i}.md`);

  it('classifies normally below the ceiling', () => {
    expect(hitsForFiles(benign(MAX_CLASSIFIABLE_FILES - 1))).toHaveLength(0);
  });
  it('treats a list at the ceiling as security-sensitive unconditionally', () => {
    const hits = hitsForFiles(benign(MAX_CLASSIFIABLE_FILES));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain('failing closed');
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
