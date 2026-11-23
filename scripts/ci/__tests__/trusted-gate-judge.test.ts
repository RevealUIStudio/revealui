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
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
    const securityEntry = path.join(repoRoot, 'packages/security/dist/review-receipt.js');
    if (!existsSync(securityEntry)) {
      execFileSync('pnpm', ['--filter', '@revealui/security', 'build'], {
        cwd: repoRoot,
        stdio: 'inherit',
      });
    }
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

  function signedComment(head: string, expires: string): string {
    const payloadPath = path.join(keyDir, `payload-${head}-${expires}`);
    const payload = buildOwnerOverridePayload(
      { repo: REPO, pr: PR, head, gate: 'sec-review' },
      expires,
    );
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

  function record(body: string | undefined, labels: string[], head = HEAD) {
    return {
      labels,
      head,
      pr: PR,
      repo: REPO,
      comments: body ? [{ body, url: 'signed-fixture' }] : [],
      allowedSigners: anchor,
    };
  }

  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  it('accepts a valid signature on the exact head', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(signedComment(HEAD, future), [REQUEST_LABEL]),
    );
    expect(decision.ok).toBe(true);
    expect(decision.kind).toBe('owner-signature');
  });

  it('fails when the request label is missing', () => {
    const decision = decideTrustedGate(lockedReport(), record(signedComment(HEAD, future), []));
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('missing-request-label');
  });

  it('fails when the label has no signature', () => {
    const decision = decideTrustedGate(lockedReport(), record(undefined, [REQUEST_LABEL]));
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('missing-owner-signature');
  });

  it('fails when the signature is expired', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(signedComment(HEAD, past), [REQUEST_LABEL]),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('expired');
  });

  it('fails when the signature is for a different head', () => {
    const decision = decideTrustedGate(
      lockedReport(),
      record(signedComment(OTHER_HEAD, future), [REQUEST_LABEL], HEAD),
    );
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('wrong-context');
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
