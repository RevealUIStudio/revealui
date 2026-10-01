import { describe, expect, it, vi } from 'vitest';

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
  'scripts/validate/security-paths.shared.json',
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

// GAP-404: shared markers (security-paths.shared.json) must drive classifyFiles.
// These three surfaces were the GAP-400 false-pass class — sessions, editor, audit store.
describe('classifyFiles — shared SECURITY_PATHS source (GAP-404)', () => {
  it('loads a non-empty shared marker list', () => {
    expect(Array.isArray(SECURITY_PATHS)).toBe(true);
    expect(SECURITY_PATHS.length).toBeGreaterThan(20);
    expect(SECURITY_PATHS).toContain('packages/editor/');
    expect(SECURITY_PATHS).toContain('packages/db/src/audit-store');
    expect(SECURITY_PATHS).toContain('routes/content/sessions');
  });

  it.each([
    'apps/server/src/routes/content/sessions.ts',
    'packages/editor/src/canvas.tsx',
    'packages/db/src/audit-store.ts',
    'packages/db/src/schema/audit-log.ts',
    'packages/db/migrations/0026_audit_append_only.sql',
    'packages/harnesses/src/hooks/policy.ts',
  ])('flags %s via shared markers', (file) => {
    expect(classifyFiles([file])).toContain(file);
  });
});

describe('decideReviewGate — a live REQUEST-CHANGES holds, overriding the label', () => {
  it('HOLDS on a live REQUEST-CHANGES even with the clearance label present', () => {
    const d = decideReviewGate({ verdict: holdVerdict, labels: [CLEAR_LABEL] });
    expect(d.action).toBe('hold');
    expect(d.kind).toBe('request-changes');
  });
});

describe('decideReviewGate — owner signature is the only grant', () => {
  it.each([noMarker, clearVerdict])(
    'denies labels, reviews and reviewer markers without a signature',
    (verdict) => {
      expect(
        decideReviewGate({ verdict, labels: [CLEAR_LABEL], reviewDecision: 'APPROVED' }).action,
      ).toBe('hold');
    },
  );
  it('denies a valid signature without a request label', () => {
    expect(
      decideReviewGate({ verdict: noMarker, labels: [], ownerVerification: { ok: true } }).action,
    ).toBe('hold');
  });
  it('clears a request label and valid owner signature', () => {
    expect(
      decideReviewGate({
        verdict: clearVerdict,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true, url: 'signed-comment' },
      }),
    ).toEqual({ action: 'clear', kind: 'owner-signature', url: 'signed-comment' });
  });
  it('keeps a live REQUEST-CHANGES above even a valid owner signature', () => {
    expect(
      decideReviewGate({
        verdict: holdVerdict,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true },
      }).kind,
    ).toBe('request-changes');
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

const {
  isPromotePr,
  decidePromoteUpstreamCoverage,
  prRecordHasVerdict,
} = require('../security-review-gate.cjs');

describe('isPromotePr — GAP-458 promote detection', () => {
  it('recognizes test → main', () => {
    expect(isPromotePr('main', 'test')).toBe(true);
  });
  it('rejects feature → test', () => {
    expect(isPromotePr('test', 'fix/gap-454')).toBe(false);
  });
  it('rejects main → test backflow', () => {
    expect(isPromotePr('test', 'main')).toBe(false);
  });
});

describe('prRecordHasVerdict — promotion never inherits label-only grants', () => {
  it('denies legacy labels and approving reviews', () => {
    expect(
      prRecordHasVerdict({ merged: true, labels: [CLEAR_LABEL], reviewDecision: 'APPROVED' }),
    ).toBe(false);
  });
  it('requires both merged status and the signed door', () => {
    expect(
      prRecordHasVerdict({
        merged: true,
        verdict: noMarker,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true },
      }),
    ).toBe(true);
    expect(
      prRecordHasVerdict({
        merged: false,
        verdict: noMarker,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true },
      }),
    ).toBe(false);
  });
  it('denies live reviewer hold and expired signature', () => {
    expect(
      prRecordHasVerdict({
        merged: true,
        verdict: holdVerdict,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true },
      }),
    ).toBe(false);
    expect(
      prRecordHasVerdict({
        merged: true,
        verdict: noMarker,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: false, reason: 'expired' },
      }),
    ).toBe(false);
  });
});

describe('decidePromoteUpstreamCoverage — GAP-458', () => {
  it('CLEARS when every security commit has a covering PR with verdict', () => {
    const d = decidePromoteUpstreamCoverage([
      { sha: 'aaa1111', shortSha: 'aaa1111', prs: [{ number: 2273, hasVerdict: true }] },
      { sha: 'bbb2222', shortSha: 'bbb2222', prs: [{ number: 2273, hasVerdict: true }] },
    ]);
    expect(d.action).toBe('clear');
    expect(d.kind).toBe('upstream-verdict');
    expect(d.coveredCount).toBe(2);
  });

  it('HOLDS and names uncovered commits (red seed)', () => {
    const d = decidePromoteUpstreamCoverage([
      { sha: 'aaa1111deadbeef', shortSha: 'aaa1111', prs: [{ number: 2273, hasVerdict: true }] },
      { sha: 'ccc3333orphan00', shortSha: 'ccc3333', prs: [] },
      {
        sha: 'ddd4444noverdict',
        shortSha: 'ddd4444',
        prs: [{ number: 9999, hasVerdict: false }],
      },
    ]);
    expect(d.action).toBe('hold');
    expect(d.kind).toBe('uncovered-commits');
    expect(d.uncovered).toEqual(['ccc3333', 'ddd4444']);
  });

  it('HOLDS when coverage list is empty (fail closed)', () => {
    const d = decidePromoteUpstreamCoverage([]);
    expect(d.action).toBe('hold');
    expect(d.kind).toBe('no-security-commits');
  });
});

const {
  fetchPrDiscussion,
  verifyPrOwnerRecord,
  fetchCommitPulls,
  fetchPrCommitShas,
} = require('../security-review-gate.cjs');
const target = 'RevealUIStudio/revealui';
const featureHead = 'a'.repeat(40);

describe('owner grant evidence adapter', () => {
  it('paginates comments AND reviews and normalizes reviewer identities', () => {
    const calls: string[][] = [];
    const result = fetchPrDiscussion(91, target, (args: string[]) => {
      calls.push(args);
      return JSON.stringify([
        [
          {
            body: 'first',
            user: { login: 'owner' },
            created_at: '2026-09-30T01:00:00Z',
            submitted_at: '2026-09-30T01:00:00Z',
            html_url: 'url',
          },
        ],
        [{ body: 'second', user: { login: 'reviewer' } }],
      ]);
    });
    expect(calls.every((args) => args.includes('--paginate') && args.includes('--slurp'))).toBe(
      true,
    );
    expect(result.comments).toHaveLength(2);
    expect(result.reviews).toHaveLength(2);
    expect(result.comments[0]).toMatchObject({ author: { login: 'owner' }, url: 'url' });
  });
  it('fails closed on incomplete or malformed paginated evidence', () => {
    expect(() => fetchPrDiscussion(91, target, () => '{}')).toThrow();
    expect(() => fetchPrDiscussion(91, target, () => '[[{"body":null}]]')).toThrow();
  });
  it('passes the trusted target and exact feature head to the sole shared verifier', () => {
    const verifier = vi.fn(() => ({ ok: true }));
    expect(
      verifyPrOwnerRecord(
        { author: { login: 'owner' }, labels: [{ name: CLEAR_LABEL }], headRefOid: featureHead },
        91,
        target,
        { comments: [], reviews: [] },
        'owner-anchor',
        verifier,
      ).action,
    ).toBe('clear');
    expect(verifier).toHaveBeenCalledWith({
      comments: [],
      allowedSigners: 'owner-anchor',
      expected: { repo: target, pr: 91, head: featureHead, gate: 'sec-review' },
    });
    // No historical `now` is supplied: expired historical grants cannot be revived.
  });
  it('does not let the signature verifier erase a paginated live reviewer hold', () => {
    const verifier = vi.fn(() => ({ ok: true }));
    const decision = verifyPrOwnerRecord(
      { author: { login: 'owner' }, labels: [{ name: CLEAR_LABEL }], headRefOid: featureHead },
      91,
      target,
      {
        comments: [
          {
            body: '<!-- guardrail2-verdict: REQUEST-CHANGES -->',
            author: { login: 'reviewer' },
            createdAt: '2026-09-30T01:00:00Z',
          },
        ],
        reviews: [],
      },
      'anchor',
      verifier,
    );
    expect(decision.kind).toBe('request-changes');
    expect(verifier).not.toHaveBeenCalled();
  });
  it('denies commit-list truncation at the supported API ceiling', () => {
    expect(() =>
      fetchPrCommitShas(91, target, () =>
        Array.from({ length: 250 }, () => featureHead).join('\n'),
      ),
    ).toThrow('API ceiling');
  });
});

describe('signed merged feature promotion coverage', () => {
  function fixture({
    merged = true,
    signed = true,
    sameHead = true,
    member = true,
    hold = false,
  } = {}) {
    const sha = 'b'.repeat(40);
    const run = (args: string[]) => {
      if (args[0] === 'pr')
        return JSON.stringify({
          labels: [{ name: CLEAR_LABEL }],
          author: { login: 'owner' },
          headRefOid: featureHead,
          mergedAt: merged ? '2026-09-30T01:00:00Z' : null,
        });
      const endpoint = args[1] ?? '';
      if (endpoint.includes('/commits/') && endpoint.includes('/pulls?'))
        return JSON.stringify([
          [
            {
              number: 91,
              merged_at: merged ? 'yes' : null,
              base: { repo: { full_name: target } },
              head: { sha: sameHead ? featureHead : 'c'.repeat(40) },
            },
          ],
        ]);
      if (endpoint.includes('/comments?'))
        return JSON.stringify([
          hold
            ? [
                {
                  body: '<!-- guardrail2-verdict: REQUEST-CHANGES -->',
                  user: { login: 'reviewer' },
                  created_at: '2026-09-30T01:00:00Z',
                },
              ]
            : [],
        ]);
      if (endpoint.includes('/reviews?')) return '[[]]';
      if (endpoint.endsWith('/commits')) return member ? `${sha}\n` : `${'d'.repeat(40)}\n`;
      throw new Error(`unexpected endpoint ${endpoint}`);
    };
    return fetchCommitPulls(sha, target, 99, run, {
      allowedSigners: 'anchor',
      verifyImpl: () => (signed ? { ok: true } : { ok: false, reason: 'expired' }),
    });
  }
  it('accepts a current signed exact-head merged feature containing the commit', () =>
    expect(fixture()).toEqual([{ number: 91, hasVerdict: true }]));
  it('denies unmerged association', () => expect(fixture({ merged: false })).toEqual([]));
  it.each([{ signed: false }, { sameHead: false }, { member: false }, { hold: true }])(
    'denies missing or mismatched owner evidence %j',
    (options) => expect(fixture(options)[0].hasVerdict).toBe(false),
  );
});
