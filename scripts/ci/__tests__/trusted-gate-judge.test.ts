import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildOwnerOverrideComment,
  buildOwnerOverridePayload,
} from '../../../packages/harnesses/src/gates/signed-override.js';
import {
  compareLockedSurfaces,
  decideTrustedGate,
  extractJob,
  extractRegion,
  LOCKED_FILES,
  LOCKED_JOBS,
  LOCKED_REGIONS,
} from '../trusted-gate-judge.mjs';

const require = createRequire(import.meta.url);
const {
  REVIEW_RECEIPT_MAX_BYTES,
  buildReviewReceiptRequest,
}: {
  REVIEW_RECEIPT_MAX_BYTES: number;
  buildReviewReceiptRequest: (
    repo: string,
    pr: number,
    head: string,
  ) => { enabled: boolean; reason: string; url: string };
} = require('../../validate/security-review-gate.cjs');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const temps: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'trusted-gate-judge-'));
  temps.push(dir);
  return dir;
}

function lockedRels(): string[] {
  const rels = new Set<string>(LOCKED_FILES);
  for (const entry of LOCKED_JOBS) rels.add(entry.file);
  for (const region of LOCKED_REGIONS) rels.add(region.file);
  return [...rels];
}

function copyLocked(dest: string): void {
  for (const rel of lockedRels()) {
    const from = path.join(repoRoot, rel);
    const to = path.join(dest, rel);
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(from, to);
  }
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('extractJob', () => {
  it('returns one job and stops before the next job key', () => {
    const text = ['jobs:', '  alpha:', '    name: Alpha', '  beta:', '    name: Beta', ''].join(
      '\n',
    );
    expect(extractJob(text, 'alpha')).toBe('  alpha:\n    name: Alpha');
    expect(extractJob(text, 'missing')).toBeNull();
  });
});

describe('extractRegion', () => {
  it('returns the marked block once', () => {
    const text = 'before\n# trusted-judge:begin\nstep\n# trusted-judge:end\nafter\n';
    expect(extractRegion(text, '# trusted-judge:begin', '# trusted-judge:end')).toBe(
      '# trusted-judge:begin\nstep\n# trusted-judge:end',
    );
    expect(extractRegion('no markers', '# trusted-judge:begin', '# trusted-judge:end')).toBeNull();
  });
});

describe('compareLockedSurfaces', () => {
  it('accepts the repository compared with itself', () => {
    const report = compareLockedSurfaces(repoRoot, repoRoot);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('rejects a head result job that no longer matches base', () => {
    const base = tempDir();
    const head = tempDir();
    copyLocked(base);
    copyLocked(head);
    const ciPath = path.join(head, '.github/workflows/ci.yml');
    const ci = readFileSync(ciPath, 'utf8');
    writeFileSync(ciPath, ci.replace('CHECK: unit', 'CHECK: unit-weakened'));
    const report = compareLockedSurfaces(base, head);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('job test-unit-result'))).toBe(true);
  });

  it('rejects a head classifier that no longer matches base', () => {
    const base = tempDir();
    const head = tempDir();
    copyLocked(base);
    copyLocked(head);
    const classifier = path.join(head, 'scripts/ci/expensive-suite.mjs');
    writeFileSync(
      classifier,
      `${readFileSync(classifier, 'utf8')}\nexport const weakened = true;\n`,
    );
    const report = compareLockedSurfaces(base, head);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('expensive-suite.mjs'))).toBe(true);
  });
});

const HEAD = 'a'.repeat(40);
const OTHER_HEAD = 'b'.repeat(40);
const REPO = 'RevealUIStudio/revealui';
const PR = 91;
const REQUEST_LABEL = 'sec-review:approved';

describe('owner signature clears a locked judge path', () => {
  const keyDir = mkdtempSync(path.join(tmpdir(), 'trusted-gate-sign-'));
  const key = path.join(keyDir, 'owner');
  let anchor = '';

  beforeAll(() => {
    const bundle = path.join(repoRoot, 'packages/harnesses/dist/gates/index.cjs');
    if (!existsSync(bundle)) {
      execFileSync(
        'pnpm',
        ['--filter', '@revealui/harnesses', 'exec', 'tsup', '--config', 'tsup.gates-cjs.ts'],
        { cwd: repoRoot, stdio: 'inherit' },
      );
    }
    execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', key], { stdio: 'pipe' });
    anchor = `owner@revealui.com ${readFileSync(`${key}.pub`, 'utf8')}`;
  }, 120000);

  afterAll(() => {
    rmSync(keyDir, { recursive: true, force: true });
  });

  function signedComment(
    head: string,
    expires: string,
    binding: { repo?: string; pr?: number } = {},
  ): string {
    const repo = binding.repo ?? REPO;
    const pr = binding.pr ?? PR;
    const payloadPath = path.join(
      keyDir,
      `payload-${repo.split('/').join('-')}-${String(pr)}-${head}-${expires}`,
    );
    const payload = buildOwnerOverridePayload({ repo, pr, head, gate: 'sec-review' }, expires);
    writeFileSync(payloadPath, payload);
    execFileSync(
      'ssh-keygen',
      ['-Y', 'sign', '-f', key, '-n', 'revealfleet-override', payloadPath],
      {
        stdio: 'pipe',
      },
    );
    return buildOwnerOverrideComment(payload, readFileSync(`${payloadPath}.sig`, 'utf8'));
  }

  function lockedReport() {
    const base = tempDir();
    const head = tempDir();
    copyLocked(base);
    copyLocked(head);
    const classifier = path.join(head, 'scripts/ci/expensive-suite.mjs');
    writeFileSync(
      classifier,
      `${readFileSync(classifier, 'utf8')}\nexport const signedEdit = true;\n`,
    );
    const report = compareLockedSurfaces(base, head);
    expect(report.ok).toBe(false);
    return report;
  }

  function record(body: string | undefined, labels: string[], head = HEAD, receipt?: string) {
    return {
      labels,
      head,
      pr: PR,
      repo: REPO,
      comments: body ? [{ body, url: 'signed-fixture' }] : [],
      receipt,
      allowedSigners: anchor,
    };
  }

  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  it('accepts an exact-head receipt', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [], HEAD, signedComment(HEAD, future)),
    );
    expect(decision.ok).toBe(true);
    expect(decision.kind).toBe('review-receipt');
  });

  it('fails when a comment override is the only signature', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(signedComment(HEAD, future), [REQUEST_LABEL], HEAD, ''),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('missing-review-receipt');
  });

  it('fails when the receipt is missing', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [REQUEST_LABEL], HEAD, ''),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('missing-review-receipt');
  });

  it('fails when the receipt is expired', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [REQUEST_LABEL], HEAD, signedComment(HEAD, past)),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('expired');
  });

  it('fails when the receipt is for a different head', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [REQUEST_LABEL], HEAD, signedComment(OTHER_HEAD, future)),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('wrong-context');
  });

  it('fails when a valid receipt is signed for a different repository', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(
        undefined,
        [REQUEST_LABEL],
        HEAD,
        signedComment(HEAD, future, { repo: 'other-org/other-repo' }),
      ),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('wrong-context');
  });

  it('fails when a valid receipt is signed for a different pull request', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [REQUEST_LABEL], HEAD, signedComment(HEAD, future, { pr: PR + 1 })),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('wrong-context');
  });

  it('holds a locked change when receipt mode is unrecognized or malformed', () => {
    const malformed = [
      ['not-a-repo', 'receipts'],
      ['off', 'receipts'],
      ['owner/repo/extra', 'receipts'],
      ['owner/repo', ''],
      ['', 'receipts'],
      ['owner/repo', '../receipts'],
      ['owner/repo', 'receipts?raw=1'],
      ['bad repo/name', 'receipts'],
    ] as const;
    for (const [repo, ref] of malformed) {
      vi.stubEnv('REVIEW_RECEIPT_REPO', repo);
      vi.stubEnv('REVIEW_RECEIPT_REF', ref);
      const request = buildReviewReceiptRequest(REPO, PR, HEAD);
      expect(request.enabled).toBe(false);
      expect(request.reason).toBe('invalid-receipt-mode');
      expect(request.url).toBe('');
    }
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [REQUEST_LABEL], HEAD, ''),
    );
    expect(decision.ok).toBe(false);
    expect(decision.kind).not.toBe('review-receipt');
  });

  it('fails when the receipt exceeds the loader size limit', () => {
    const receipt = signedComment(HEAD, future);
    expect(receipt.length).toBeLessThanOrEqual(REVIEW_RECEIPT_MAX_BYTES);
    const oversized = `${receipt}${'x'.repeat(REVIEW_RECEIPT_MAX_BYTES - receipt.length + 1)}`;
    expect(oversized.length).toBe(REVIEW_RECEIPT_MAX_BYTES + 1);
    const decision = decideTrustedGate(
      lockedReport(),
      record(undefined, [REQUEST_LABEL], HEAD, oversized),
    );
    expect(decision.ok).toBe(false);
    expect(decision.kind).not.toBe('review-receipt');
  });

  it('keeps a live REQUEST_CHANGES review above an exact-head receipt', () => {
    const decision = decideTrustedGate(lockedReport(), {
      ...record(undefined, [REQUEST_LABEL], HEAD, signedComment(HEAD, future)),
      reviews: [
        {
          body: '<!-- guardrail2-verdict: REQUEST-CHANGES -->',
          author: { login: 'reviewer' },
          submittedAt: '2026-09-30T01:00:00Z',
        },
      ],
      authorLogin: 'author',
    });
    expect(decision.ok).toBe(false);
    expect(decision.kind).toBe('request-changes');
  });

  it('leaves a non-locked change alone', () => {
    const base = tempDir();
    const head = tempDir();
    copyLocked(base);
    copyLocked(head);
    const report = compareLockedSurfaces(base, head);
    const decision = decideTrustedGate(report, record(undefined, []));
    expect(decision.ok).toBe(true);
    expect(decision.kind).toBe('unchanged');
  });
});
