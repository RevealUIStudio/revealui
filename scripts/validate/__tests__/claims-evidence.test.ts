import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  ClaimEntry,
  CoveredFile,
} from '../../../apps/marketing/app/content/claims-evidence.ts';
import {
  findCriticalProofGradeViolations,
  findMissingRouteEntries,
  findUntrackedCodeEvidence,
  isTrackedPath,
  loadTrackedFiles,
} from '../claims-evidence.ts';

describe('findMissingRouteEntries', () => {
  const covered: readonly CoveredFile[] = [{ file: 'home.ts' }, { file: 'pricing.ts' }];

  it('flags a covered file with no entry in the route map', () => {
    expect(
      findMissingRouteEntries(covered, { 'home.ts': { route: '/', pageTitle: 'Home' } }),
    ).toEqual(['pricing.ts']);
  });

  it('passes when every covered file has a route entry', () => {
    expect(
      findMissingRouteEntries(covered, {
        'home.ts': { route: '/', pageTitle: 'Home' },
        'pricing.ts': { route: '/pricing', pageTitle: 'Pricing' },
      }),
    ).toEqual([]);
  });

  it('returns an empty array for an empty covered-file list', () => {
    expect(findMissingRouteEntries([], {})).toEqual([]);
  });
});

describe('isTrackedPath', () => {
  const tracked = new Set(['apps/marketing/app/content/site.ts', 'packages/core/src/index.ts']);

  it('matches an exact tracked file', () => {
    expect(isTrackedPath(tracked, 'apps/marketing/app/content/site.ts')).toBe(true);
  });

  it('matches a directory-shaped ref that contains a tracked file', () => {
    expect(isTrackedPath(tracked, 'packages/core/src')).toBe(true);
  });

  it('normalizes a trailing slash on a directory ref', () => {
    expect(isTrackedPath(tracked, 'packages/core/src/')).toBe(true);
  });

  it('does not match a path outside the tracked set', () => {
    expect(isTrackedPath(tracked, 'apps/marketing/app/content/nonexistent.ts')).toBe(false);
  });

  it('does not match a directory with no tracked files under it', () => {
    expect(isTrackedPath(tracked, 'packages/nonexistent-pkg/src')).toBe(false);
  });
});

describe('findCriticalProofGradeViolations', () => {
  function claim(
    file: string,
    exportPath: string,
    proofGrade?: ClaimEntry['proofGrade'],
  ): ClaimEntry {
    return {
      file,
      exportPath,
      text: 'placeholder text long enough to pass the prose floor',
      evidence: [{ kind: 'code', ref: 'packages' }],
      proofGrade,
    };
  }

  it('flags a critical homepage claim with no proofGrade (path default)', () => {
    expect(findCriticalProofGradeViolations([claim('home.ts', 'HOME_HERO.h1')])).toEqual([
      { file: 'home.ts', exportPath: 'HOME_HERO.h1', grade: 'path' },
    ]);
  });

  it('flags a critical claim graded only path', () => {
    expect(
      findCriticalProofGradeViolations([claim('home.ts', 'HOME_PROBLEM.body', 'path')]),
    ).toEqual([{ file: 'home.ts', exportPath: 'HOME_PROBLEM.body', grade: 'path' }]);
  });

  it('passes critical claims graded behavior or outcome', () => {
    expect(
      findCriticalProofGradeViolations([
        claim('home.ts', 'HOME_HERO.h1', 'behavior'),
        claim('primitives.ts', 'HOME_PRIMITIVES[0].body', 'outcome'),
      ]),
    ).toEqual([]);
  });

  it('skips competitor-framing, FAQ questions, and chrome fields', () => {
    expect(
      findCriticalProofGradeViolations([
        claim('home.ts', 'HOME_PROBLEM.rows[0].sprawl'),
        claim('home.ts', 'HOME_FAQ.items[0].question'),
        claim('home.ts', 'HOME_GET_STARTED.newsletter.label'),
        claim('proof.ts', 'PROOF_TRUST.changelogCta.label'),
      ]),
    ).toEqual([]);
  });

  it('skips non-critical files even without a grade', () => {
    expect(
      findCriticalProofGradeViolations([claim('products.ts', 'PRODUCTS_PAGE_HERO.h1')]),
    ).toEqual([]);
  });
});

describe('findUntrackedCodeEvidence', () => {
  const tracked = new Set(['apps/marketing/app/content/site.ts']);

  function claim(exportPath: string, evidence: ClaimEntry['evidence']): ClaimEntry {
    return { file: 'home.ts', exportPath, text: 'placeholder text long enough to pass', evidence };
  }

  it('flags a code-kind ref to a path not tracked in the repo (proves red)', () => {
    const claims = [
      claim('HOME_HERO.h1', [{ kind: 'code', ref: 'apps/marketing/app/content/ghost.ts' }]),
    ];
    expect(findUntrackedCodeEvidence(claims, tracked)).toEqual([
      { file: 'home.ts', exportPath: 'HOME_HERO.h1', ref: 'apps/marketing/app/content/ghost.ts' },
    ]);
  });

  it('passes a code-kind ref to a tracked path (proves green)', () => {
    const claims = [
      claim('HOME_HERO.h1', [{ kind: 'code', ref: 'apps/marketing/app/content/site.ts' }]),
    ];
    expect(findUntrackedCodeEvidence(claims, tracked)).toEqual([]);
  });

  it('ignores non-code evidence kinds regardless of tracked state', () => {
    const claims = [
      claim('HOME_HERO.h1', [
        { kind: 'url', ref: 'https://revealui.com/nonexistent' },
        { kind: 'command', ref: 'pnpm nonexistent-script' },
        { kind: 'metric', ref: 'apps/marketing/app/content/ghost-metric.ts' },
      ]),
    ];
    expect(findUntrackedCodeEvidence(claims, tracked)).toEqual([]);
  });

  it('reports every claim citing a shared untracked ref, not just the first', () => {
    const ghostRef: ClaimEntry['evidence'][number] = {
      kind: 'code',
      ref: 'apps/marketing/app/content/ghost.ts',
    };
    const claims = [claim('A.field', [ghostRef]), claim('B.field', [ghostRef])];
    expect(findUntrackedCodeEvidence(claims, tracked)).toHaveLength(2);
  });
});

describe('loadTrackedFiles', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-evidence-git-'));
    execFileSync('git', ['init', '-q'], { cwd: tmp });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns files staged in the git index, not merely present on disk', () => {
    fs.writeFileSync(path.join(tmp, 'staged.ts'), '');
    fs.writeFileSync(path.join(tmp, 'unstaged.ts'), '');
    execFileSync('git', ['add', 'staged.ts'], { cwd: tmp });

    const tracked = loadTrackedFiles(tmp);
    expect(tracked.has('staged.ts')).toBe(true);
    expect(tracked.has('unstaged.ts')).toBe(false);
  });

  it('returns an empty set for a repo with nothing staged', () => {
    expect(loadTrackedFiles(tmp)).toEqual(new Set());
  });
});
