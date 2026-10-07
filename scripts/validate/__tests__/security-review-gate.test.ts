import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildOwnerOverrideComment,
  buildOwnerOverridePayload,
} from '../../../packages/harnesses/src/gates/signed-override.js';

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

afterEach(() => vi.unstubAllEnvs());

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

describe('classifyFiles — maintained push admission and execution entry points', () => {
  const protectedFiles = [
    '.husky/pre-push',
    'scripts/git-hooks/push.sh',
    'scripts/git-hooks/push-admission.cjs',
    'scripts/git-hooks/cleanup.sh',
    'scripts/git-hooks/__tests__/push.test.cjs',
    'packages/scripts/exec.ts',
    'scripts/gates/ci-gate.ts',
    'scripts/gates/__tests__/ci-gate-worker-lifecycle.test.ts',
    'package.json',
    'packages/harnesses/package.json',
  ];

  it.each(protectedFiles)('requires security review for %s', (file) => {
    expect(classifyFiles([file])).toEqual([file]);
    expect(
      decideReviewGate({ verdict: noMarker, labels: [CLEAR_LABEL], reviewDecision: 'APPROVED' })
        .action,
    ).toBe('hold');
  });

  it('keeps code-owner review on the same push and manifest surfaces', () => {
    const owners = readFileSync(join(__dirname, '../../../.github/CODEOWNERS'), 'utf8');
    for (const pattern of [
      '/.husky/pre-push',
      '/scripts/git-hooks/',
      '/packages/scripts/exec.ts',
      '/scripts/gates/',
      '**/package.json',
    ]) {
      expect(owners.split('\n')).toContain(`${pattern} @joshua-v-dev @RevealUIStudio`);
    }
  });

  it('does not classify normal cache content or documentation as execution policy', () => {
    expect(
      classifyFiles([
        'docs/CI_CD_GUIDE.md',
        'apps/admin/.next/cache/entry',
        'packages/scripts/paths.ts',
        'scripts/utils/base.ts',
      ]),
    ).toEqual([]);
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
    useConfiguredAnchor = false,
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
      allowedSigners: useConfiguredAnchor ? undefined : 'anchor',
      verifyImpl: ({ allowedSigners }: { allowedSigners: string }) =>
        signed && (!useConfiguredAnchor || allowedSigners === 'anchor')
          ? { ok: true }
          : { ok: false, reason: 'missing-or-invalid-anchor' },
    });
  }
  it('accepts a current signed exact-head merged feature containing the commit', () =>
    expect(fixture()).toEqual([{ number: 91, hasVerdict: true }]));
  it('denies unmerged association', () => expect(fixture({ merged: false })).toEqual([]));
  it('uses the canonical configured anchor for merged promotion coverage', () => {
    vi.stubEnv('REVEALFLEET_OVERRIDE_SIGNERS', 'anchor');
    vi.stubEnv('REVFLEET_OVERRIDE_SIGNERS', 'different-deprecated-anchor');
    expect(fixture({ useConfiguredAnchor: true })).toEqual([{ number: 91, hasVerdict: true }]);
  });
  it('denies promotion coverage when only deprecated configuration is populated', () => {
    vi.stubEnv('REVEALFLEET_OVERRIDE_SIGNERS', undefined);
    vi.stubEnv('REVFLEET_OVERRIDE_SIGNERS', 'anchor');
    expect(fixture({ useConfiguredAnchor: true })).toEqual([{ number: 91, hasVerdict: false }]);
  });
  it.each([{ signed: false }, { sameHead: false }, { member: false }, { hold: true }])(
    'denies missing or mismatched owner evidence %j',
    (options) => expect(fixture(options)[0].hasVerdict).toBe(false),
  );
});

it('real SSHSIG passes through the existing compiled resolver and sensitive gate decision', () => {
  const directory = mkdtempSync(join(tmpdir(), 'security-door-fixture-'));
  try {
    const key = join(directory, 'owner');
    execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', key], { stdio: 'pipe' });
    const payload = join(directory, 'payload');
    const expires = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    writeFileSync(
      payload,
      buildOwnerOverridePayload(
        { repo: target, pr: 91, head: featureHead, gate: 'sec-review' },
        expires,
      ),
    );
    execFileSync('ssh-keygen', ['-Y', 'sign', '-f', key, '-n', 'revealfleet-override', payload], {
      stdio: 'pipe',
    });
    const body = buildOwnerOverrideComment(
      readFileSync(payload, 'utf8'),
      readFileSync(`${payload}.sig`, 'utf8'),
    );
    const anchor = `owner@revealui.com ${readFileSync(`${key}.pub`, 'utf8')}`;
    const data = {
      author: { login: 'owner' },
      labels: [{ name: CLEAR_LABEL }],
      headRefOid: featureHead,
    };
    const discussion = { comments: [{ body, url: 'signed-fixture' }], reviews: [] };
    vi.stubEnv('REVEALFLEET_OVERRIDE_SIGNERS', anchor);
    vi.stubEnv('REVFLEET_OVERRIDE_SIGNERS', 'different-deprecated-anchor');
    expect(verifyPrOwnerRecord(data, 91, target, discussion)).toMatchObject({
      action: 'clear',
      kind: 'owner-signature',
      url: 'signed-fixture',
    });
    expect(
      verifyPrOwnerRecord({ ...data, headRefOid: 'b'.repeat(40) }, 91, target, discussion).action,
    ).toBe('hold');
    expect(verifyPrOwnerRecord(data, 91, target, discussion, '').action).toBe('hold');
    vi.stubEnv('REVEALFLEET_OVERRIDE_SIGNERS', undefined);
    vi.stubEnv('REVFLEET_OVERRIDE_SIGNERS', anchor);
    expect(verifyPrOwnerRecord(data, 91, target, discussion)).toMatchObject({
      action: 'hold',
      reason: 'missing-owner-anchor',
    });
    expect(
      verifyPrOwnerRecord({ ...data, labels: [] }, 91, target, discussion, anchor).action,
    ).toBe('hold');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const {
  SENSITIVE_PATH_CLASSES,
  RECEIPT_CHECK_NAME,
  RECEIPT_APP_ID_VAR,
  RECEIPT_APP_SLUG_VAR,
  classifySensitiveFiles,
  reviewAdmission,
  verifyAppReceiptCheck,
  verifyIndependentApproval,
  readReceiptControllerConfig,
  buildReceiptAdmission,
} = require('../security-review-gate.cjs');

const APP_ID = 4242;
const APP_SLUG = 'example-review-controller';
const HEAD = 'a'.repeat(40);
const OTHER_HEAD = 'b'.repeat(40);
const receiptOk = { ok: true, url: 'https://example.test/check/10' };

interface ReceiptRun {
  id: number;
  name: string;
  head_sha: string;
  status: string;
  conclusion: string;
  html_url: string;
  app: { id: number; slug: string };
}

function receiptRun(overrides: Partial<ReceiptRun> = {}): ReceiptRun {
  return {
    id: 10,
    name: RECEIPT_CHECK_NAME,
    head_sha: HEAD,
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://example.test/check/10',
    app: { id: APP_ID, slug: APP_SLUG },
    ...overrides,
  };
}

function classIds(file: string): string[] {
  return classifySensitiveFiles([file]).flatMap((hit: { classes: string[] }) => hit.classes);
}

const SENSITIVE_SAMPLES = [
  { id: 'workflows', file: '.github/workflows/ci.yml' },
  { id: 'actions', file: '.github/actions/setup/action.yml' },
  { id: 'auth', file: 'packages/auth/src/server/session.ts' },
  { id: 'migrations', file: 'packages/db/migrations/meta/_journal.json' },
  { id: 'gate', file: 'scripts/validate/security-review-gate.cjs' },
  { id: 'codeowners', file: '.github/CODEOWNERS' },
  { id: 'rulesets', file: '.github/rulesets/protect-main-test.json' },
] as const;

describe('sensitive path list', () => {
  it('loads the class list from receipt-sensitive-paths.json only', () => {
    const onDisk = JSON.parse(
      readFileSync(join(__dirname, '../receipt-sensitive-paths.json'), 'utf8'),
    ) as { classes: Array<{ id: string; markers: string[] }> };
    expect(SENSITIVE_PATH_CLASSES).toEqual(
      onDisk.classes.map((entry) => ({ id: entry.id, markers: entry.markers })),
    );
    expect(SENSITIVE_PATH_CLASSES.map((entry: { id: string }) => entry.id)).toEqual([
      'workflows',
      'actions',
      'auth',
      'migrations',
      'gate',
      'codeowners',
      'rulesets',
    ]);
  });

  it.each(SENSITIVE_SAMPLES)('classifies $id via $file', ({ id, file }) => {
    expect(classIds(file)).toContain(id);
  });

  it('covers auth, session, roles, permissions, admin access, and migration journals', () => {
    for (const file of [
      'packages/auth/src/server/session.ts',
      'apps/admin/src/lib/utils/session-cookies.ts',
      'apps/admin/src/lib/access/permissions/roles.ts',
      'apps/admin/src/lib/auth/roles.ts',
      'apps/admin/src/proxy.ts',
      'packages/core/src/auth/access.ts',
      'packages/security/src/authorization.ts',
      'packages/db/migrations/0054_example.sql',
      'packages/db/migrations/meta/_journal.json',
      'scripts/validate/receipt-sensitive-paths.json',
    ]) {
      expect(classIds(file).length).toBeGreaterThan(0);
    }
  });
});

describe('review controller receipt grant', () => {
  const normal = 'packages/paywall/src/index.ts';

  it('passes an owner SSHSIG on a sensitive path without an App receipt', () => {
    expect(classIds('.github/workflows/ci.yml')).toContain('workflows');
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true, url: 'signed-comment' },
        receiptVerification: { ok: false },
        independentApproval: { ok: false },
        sensitive: true,
      }),
    ).toEqual({ action: 'clear', kind: 'owner-signature', url: 'signed-comment' });
  });

  it('passes an App receipt on a normal security path', () => {
    expect(classifyFiles([normal])).toEqual([normal]);
    expect(classifySensitiveFiles([normal])).toEqual([]);
    expect(reviewAdmission([normal])).toMatchObject({ gated: true, sensitive: false });
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [],
        receiptVerification: receiptOk,
        sensitive: false,
      }),
    ).toEqual({ action: 'clear', kind: 'app-receipt', url: receiptOk.url });
  });

  it.each(SENSITIVE_SAMPLES)('fails an App receipt alone on $id', ({ file }) => {
    expect(reviewAdmission([file]).sensitive).toBe(true);
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [],
        receiptVerification: receiptOk,
        independentApproval: { ok: false, reason: 'no-independent-approval' },
        sensitive: true,
      }),
    ).toMatchObject({
      action: 'hold',
      kind: 'sensitive-needs-independent-review',
    });
  });

  it('passes an App receipt plus an independent approval on a sensitive path', () => {
    const approval = verifyIndependentApproval({
      authorLogin: 'pr-author',
      appSlug: APP_SLUG,
      reviews: [
        {
          author: { login: 'pr-author' },
          state: 'APPROVED',
          submittedAt: '2026-10-07T00:00:00Z',
        },
        {
          author: { login: `${APP_SLUG}[bot]` },
          state: 'APPROVED',
          submittedAt: '2026-10-07T00:01:00Z',
        },
        {
          author: { login: 'independent-reviewer' },
          state: 'APPROVED',
          submittedAt: '2026-10-07T00:02:00Z',
        },
      ],
    });
    expect(approval).toEqual({ ok: true, reviewer: 'independent-reviewer' });
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [],
        receiptVerification: receiptOk,
        independentApproval: approval,
        sensitive: true,
      }),
    ).toEqual({
      action: 'clear',
      kind: 'app-receipt-and-review',
      url: receiptOk.url,
      reviewer: 'independent-reviewer',
    });
  });

  it('rejects a receipt from a different app id even when the check name matches', () => {
    const result = verifyAppReceiptCheck({
      headSha: HEAD,
      checkRuns: [receiptRun({ app: { id: 999, slug: APP_SLUG } })],
      appId: APP_ID,
      appSlug: APP_SLUG,
    });
    expect(result).toEqual({ ok: false, reason: 'receipt-app-mismatch' });
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [],
        receiptVerification: result,
        sensitive: false,
      }).action,
    ).toBe('hold');
  });

  it('rejects a stale head SHA and accepts the same check on the current head', () => {
    const stale = verifyAppReceiptCheck({
      headSha: HEAD,
      checkRuns: [receiptRun({ head_sha: OTHER_HEAD })],
      appId: APP_ID,
      appSlug: APP_SLUG,
    });
    expect(stale).toEqual({ ok: false, reason: 'stale-head' });
    expect(
      verifyAppReceiptCheck({
        headSha: OTHER_HEAD,
        checkRuns: [receiptRun({ head_sha: OTHER_HEAD })],
        appId: APP_ID,
        appSlug: APP_SLUG,
      }).ok,
    ).toBe(true);
  });

  it('does not count an author self-review, including a different login case', () => {
    const self = verifyIndependentApproval({
      authorLogin: 'PR-Author',
      appSlug: APP_SLUG,
      reviews: [
        {
          author: { login: 'pr-author' },
          state: 'APPROVED',
          submittedAt: '2026-10-07T00:00:00Z',
        },
        {
          author: { login: `${APP_SLUG}[bot]` },
          state: 'APPROVED',
          submittedAt: '2026-10-07T00:01:00Z',
        },
      ],
    });
    expect(self.ok).toBe(false);
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [],
        receiptVerification: receiptOk,
        independentApproval: self,
        sensitive: true,
      }).action,
    ).toBe('hold');
  });

  it('keeps a live REQUEST-CHANGES above an App receipt', () => {
    expect(
      decideReviewGate({
        verdict: holdVerdict,
        labels: [CLEAR_LABEL],
        ownerVerification: { ok: true },
        receiptVerification: receiptOk,
        independentApproval: { ok: true, reviewer: 'independent-reviewer' },
        sensitive: false,
      }).kind,
    ).toBe('request-changes');
  });

  it('rejects a same-named check from another slug and a differently named check from the App', () => {
    expect(
      verifyAppReceiptCheck({
        headSha: HEAD,
        checkRuns: [receiptRun({ app: { id: APP_ID, slug: 'other-app' } })],
        appId: APP_ID,
        appSlug: APP_SLUG,
      }).reason,
    ).toBe('receipt-app-mismatch');
    expect(
      verifyAppReceiptCheck({
        headSha: HEAD,
        checkRuns: [receiptRun({ name: 'Some other check' })],
        appId: APP_ID,
        appSlug: APP_SLUG,
      }).ok,
    ).toBe(false);
  });

  it('uses the newest matching check run, so a later failure invalidates an older success', () => {
    expect(
      verifyAppReceiptCheck({
        headSha: HEAD,
        checkRuns: [receiptRun({ id: 1 }), receiptRun({ id: 2, conclusion: 'failure' })],
        appId: APP_ID,
        appSlug: APP_SLUG,
      }).reason,
    ).toBe('receipt-check-not-success');
  });

  it('reads the App id and slug from repository variable names and ignores a partial pair', () => {
    expect(readReceiptControllerConfig({})).toBeNull();
    expect(readReceiptControllerConfig({ [RECEIPT_APP_ID_VAR]: String(APP_ID) })).toEqual({
      ok: false,
    });
    expect(
      readReceiptControllerConfig({
        [RECEIPT_APP_ID_VAR]: String(APP_ID),
        [RECEIPT_APP_SLUG_VAR]: APP_SLUG,
      }),
    ).toEqual({ ok: true, appId: APP_ID, appSlug: APP_SLUG });
  });

  it('treats a check run fetched for the current head as stale when its head_sha differs', () => {
    const calls: string[][] = [];
    const result = buildReceiptAdmission(
      {
        headSha: HEAD,
        authorLogin: 'pr-author',
        reviews: [],
        files: [normal],
        repo: target,
        ghImpl: (args: string[]) => {
          calls.push(args);
          return JSON.stringify([
            {
              check_runs: [receiptRun({ head_sha: OTHER_HEAD })],
            },
          ]);
        },
      },
      {
        [RECEIPT_APP_ID_VAR]: String(APP_ID),
        [RECEIPT_APP_SLUG_VAR]: APP_SLUG,
      },
    );
    expect(calls[0]?.join(' ')).toContain(`/commits/${HEAD}/check-runs`);
    expect(result.receiptVerification).toEqual({ ok: false, reason: 'stale-head' });
    expect(result.sensitive).toBe(false);
  });

  it('counts an exact-head App receipt for promotion coverage and ignores a sensitive receipt alone', () => {
    vi.stubEnv(RECEIPT_APP_ID_VAR, String(APP_ID));
    vi.stubEnv(RECEIPT_APP_SLUG_VAR, APP_SLUG);
    const featureSha = 'c'.repeat(40);
    const run = (files: string) => (args: string[]) => {
      const endpoint = args[1] ?? '';
      if (endpoint.includes('/pulls?')) {
        return JSON.stringify([
          [
            {
              number: 91,
              merged_at: '2026-10-07T00:00:00Z',
              base: { repo: { full_name: target } },
              head: { sha: HEAD },
            },
          ],
        ]);
      }
      if (args[0] === 'pr') {
        return JSON.stringify({
          labels: [],
          author: { login: 'pr-author' },
          headRefOid: HEAD,
          mergedAt: '2026-10-07T00:00:00Z',
        });
      }
      if (endpoint.includes('/comments?') || endpoint.includes('/reviews?')) return '[[]]';
      if (endpoint.includes('/files')) return files;
      if (endpoint.includes('/check-runs')) {
        return JSON.stringify([{ check_runs: [receiptRun()] }]);
      }
      if (endpoint.endsWith('/commits')) return `${featureSha}\n`;
      throw new Error(`unexpected endpoint ${args.join(' ')}`);
    };
    expect(
      fetchCommitPulls(featureSha, target, 99, run('packages/paywall/src/index.ts\n')),
    ).toEqual([{ number: 91, hasVerdict: true }]);
    expect(
      fetchCommitPulls(featureSha, target, 99, run('.github/workflows/ci.yml\n'))[0]?.hasVerdict,
    ).toBe(false);
  });

  it('clears a non-sensitive record from the receipt when the request label is absent', () => {
    expect(
      verifyPrOwnerRecord(
        { author: { login: 'pr-author' }, labels: [], headRefOid: HEAD },
        91,
        target,
        { comments: [], reviews: [] },
        'anchor',
        () => {
          throw new Error('owner verifier must not run without a request label');
        },
        {
          receiptVerification: receiptOk,
          independentApproval: { ok: false },
          sensitive: false,
        },
      ),
    ).toMatchObject({ action: 'clear', kind: 'app-receipt' });
  });

  it('does not let an unclassifiable file list pass on an App receipt alone', () => {
    const admission = reviewAdmission(
      Array.from({ length: MAX_CLASSIFIABLE_FILES }, () => 'docs/page.md'),
    );
    expect(admission.sensitive).toBe(true);
    expect(
      decideReviewGate({
        verdict: noMarker,
        labels: [],
        receiptVerification: receiptOk,
        sensitive: admission.sensitive,
      }).action,
    ).toBe('hold');
  });
});

describe('security review gate workflow trust boundary', () => {
  const yml = readFileSync(
    join(__dirname, '../../../.github/workflows/security-review-gate.yml'),
    'utf8',
  );

  it('reads check runs and the App identifiers, and does not receive the App private key', () => {
    expect(yml).toContain('checks: read');
    expect(yml).not.toContain('checks: write');
    expect(yml).toContain(RECEIPT_APP_ID_VAR);
    expect(yml).toContain(RECEIPT_APP_SLUG_VAR);
    expect(yml).toContain('scripts/validate/receipt-sensitive-paths.json');
    expect(yml).not.toContain('GITHUB_APP_PRIVATE_KEY');
    expect(yml).not.toContain('PRIVATE_KEY');
  });
});
