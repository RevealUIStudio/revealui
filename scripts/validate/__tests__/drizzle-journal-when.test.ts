/**
 * Unit tests for the Drizzle journal when-order gate.
 *
 * node:test keeps the pull_request job install-free. Run with:
 *   node --experimental-strip-types --test scripts/validate/__tests__/drizzle-journal-when.test.ts
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkJournalWhenOrder,
  checkRepository,
  type JournalDocument,
  type JournalEntry,
  main,
  parseJournal,
  resolveBaseRef,
} from '../drizzle-journal-when.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const LABEL = 'meta/_journal.json';

function entry(idx: number, when: number, tag: string): JournalEntry {
  return { idx, when, tag };
}

function journal(...entries: JournalEntry[]): JournalDocument {
  return { entries };
}

function check(head: JournalDocument, base: JournalDocument) {
  return checkJournalWhenOrder(head, base, LABEL);
}

function expectIncludes(text: string, needle: string): void {
  assert.equal(text.includes(needle), true, text);
}

describe('checkJournalWhenOrder', () => {
  it('passes when the head journal matches the base branch', () => {
    const same = journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_next'));
    const result = check(same, same);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('passes when the PR journal is an older prefix of the base branch', () => {
    const result = check(
      journal(entry(0, 10, '0000_init')),
      journal(entry(0, 10, '0000_init'), entry(1, 50, '0001_landed')),
    );
    assert.equal(result.ok, true, result.errors.join('\n'));
  });

  it('passes when a new entry is strictly after the base max when and idx', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 40, '0001_added')),
      journal(entry(0, 10, '0000_init')),
    );
    assert.equal(result.ok, true, result.errors.join('\n'));
  });

  it('passes when several new entries increase and each beats the base max when', () => {
    const result = check(
      journal(
        entry(2, 300, '0002_c'),
        entry(0, 10, '0000_init'),
        entry(1, 20, '0001_kept'),
        entry(3, 400, '0003_d'),
      ),
      journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_kept')),
    );
    assert.equal(result.ok, true, result.errors.join('\n'));
  });

  it('fails when a new when is older than the base max, naming the tag and base max when', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 200, '0001_stale')),
      journal(entry(0, 10, '0000_init'), entry(1, 300, '0001_landed')),
    );
    assert.equal(result.ok, false);
    const text = result.errors.join('\n');
    expectIncludes(text, '0001_stale');
    expectIncludes(text, 'base max when=300');
    expectIncludes(text, '0001_landed');
  });

  it('fails when a new when equals the base max when', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 300, '0001_equal')),
      journal(entry(0, 10, '0000_init'), entry(1, 300, '0001_landed')),
    );
    assert.equal(result.ok, false);
    const text = result.errors.join('\n');
    expectIncludes(text, '0001_equal');
    expectIncludes(text, 'base max when=300');
  });

  it('fails when a later new idx has a smaller when', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 400, '0001_first'), entry(2, 350, '0002_second')),
      journal(entry(0, 10, '0000_init')),
    );
    assert.equal(result.ok, false);
    const text = result.errors.join('\n');
    expectIncludes(text, '0002_second');
    expectIncludes(text, '0001_first');
    expectIncludes(text, 'idx order');
  });

  it('fails when two new entries share a when', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 400, '0001_first'), entry(2, 400, '0002_same')),
      journal(entry(0, 10, '0000_init')),
    );
    assert.equal(result.ok, false);
    expectIncludes(result.errors.join('\n'), '0002_same');
  });

  it('fails when a new tag reuses an idx already on the base branch', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 500, '0001_parallel')),
      journal(entry(0, 10, '0000_init'), entry(1, 100, '0001_landed')),
    );
    assert.equal(result.ok, false);
    const text = result.errors.join('\n');
    expectIncludes(text, 'duplicate idx 1');
    expectIncludes(text, '0001_landed');
    expectIncludes(text, '0001_parallel');
  });

  it('fails on a duplicate idx inside the head journal', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_a'), entry(1, 30, '0001_b')),
      journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_a'), entry(1, 30, '0001_b')),
    );
    assert.equal(result.ok, false);
    expectIncludes(result.errors.join('\n'), 'duplicate idx 1');
  });

  it('fails on a duplicate tag inside the head journal', () => {
    const result = check(
      journal(entry(0, 10, '0000_dup'), entry(1, 20, '0000_dup')),
      journal(entry(0, 10, '0000_dup'), entry(1, 20, '0000_dup')),
    );
    assert.equal(result.ok, false);
    expectIncludes(result.errors.join('\n'), 'duplicate tag 0000_dup');
  });

  it('fails when the idx sequence skips a value', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_kept'), entry(3, 40, '0003_skip')),
      journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_kept')),
    );
    assert.equal(result.ok, false);
    expectIncludes(result.errors.join('\n'), 'missing idx 2');
  });

  it('fails when a new journal does not start at idx 0', () => {
    const result = check(journal(entry(1, 20, '0001_only')), journal());
    assert.equal(result.ok, false);
    expectIncludes(result.errors.join('\n'), 'missing idx 0');
  });

  it('passes a brand-new journal whose when values increase', () => {
    const result = check(journal(entry(0, 5, '0000_a'), entry(1, 6, '0001_b')), journal());
    assert.equal(result.ok, true, result.errors.join('\n'));
  });

  it('fails a brand-new journal whose when values decrease', () => {
    const result = check(journal(entry(0, 6, '0000_a'), entry(1, 5, '0001_b')), journal());
    assert.equal(result.ok, false);
    const text = result.errors.join('\n');
    expectIncludes(text, '0001_b');
    expectIncludes(text, 'idx order');
  });

  it('names every new entry that misses the base max when', () => {
    const result = check(
      journal(entry(0, 10, '0000_init'), entry(1, 50, '0001_low'), entry(2, 40, '0002_lower')),
      journal(entry(0, 10, '0000_init'), entry(1, 100, '0001_landed')),
    );
    const text = result.errors.join('\n');
    expectIncludes(text, '0001_low');
    expectIncludes(text, '0002_lower');
    expectIncludes(text, 'base max when=100');
  });
});

describe('parseJournal', () => {
  it('rejects invalid JSON', () => {
    const result = parseJournal('{', 'meta/_journal.json');
    assert.equal(result.ok, false);
    if (!result.ok) expectIncludes(result.errors[0] ?? '', 'not valid');
  });

  it('rejects a missing entries array', () => {
    const result = parseJournal('{"version":"7"}', 'meta/_journal.json');
    assert.equal(result.ok, false);
    if (!result.ok) expectIncludes(result.errors[0] ?? '', 'entries');
  });
});

describe('resolveBaseRef', () => {
  it('prefers --base-ref over GITHUB_BASE_REF', () => {
    assert.equal(
      resolveBaseRef(['node', 'script', '--base-ref', 'origin/test'], { GITHUB_BASE_REF: 'main' }),
      'origin/test',
    );
    assert.equal(
      resolveBaseRef(['node', 'script', '--base-ref=abc123'], { GITHUB_BASE_REF: 'main' }),
      'abc123',
    );
  });

  it('uses origin/$GITHUB_BASE_REF when the flag is absent', () => {
    assert.equal(resolveBaseRef(['node', 'script'], { GITHUB_BASE_REF: 'test' }), 'origin/test');
    assert.equal(resolveBaseRef(['node', 'script'], {}), null);
  });
});

describe('repository check', () => {
  it('passes for the committed journals compared with HEAD', () => {
    const result = checkRepository({ repoRoot, baseRef: 'HEAD' });
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.ok(result.journalCount >= 1);
  });

  it('fails a synthetic journal whose new when is older than the base max', () => {
    const dir = mkdtempSync(join(tmpdir(), 'journal-when-'));
    const rel = 'pkg/migrations/meta/_journal.json';
    try {
      git(dir, ['init', '-b', 'base']);
      writeJournal(dir, rel, journal(entry(0, 100, '0000_init'), entry(1, 300, '0001_landed')));
      git(dir, ['add', '.']);
      git(dir, ['commit', '-m', 'base journal']);
      writeJournal(
        dir,
        rel,
        journal(
          entry(0, 100, '0000_init'),
          entry(1, 300, '0001_landed'),
          entry(2, 200, '0002_stale'),
        ),
      );
      const result = checkRepository({ repoRoot: dir, baseRef: 'HEAD' });
      assert.equal(result.ok, false);
      const text = result.errors.join('\n');
      expectIncludes(text, '0002_stale');
      expectIncludes(text, 'base max when=300');
      expectIncludes(text, '0001_landed');

      const logged: string[] = [];
      const original = console.error;
      console.error = (message?: unknown) => {
        logged.push(String(message));
      };
      try {
        const code = main(['node', 'script', '--repo-root', dir, '--base-ref', 'HEAD']);
        assert.equal(code, 1);
      } finally {
        console.error = original;
      }
      const cli = logged.join('\n');
      expectIncludes(cli, '0002_stale');
      expectIncludes(cli, 'base max when=300');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes a synthetic journal whose new when is after the base max', () => {
    const dir = mkdtempSync(join(tmpdir(), 'journal-when-ok-'));
    const rel = 'db/meta/_journal.json';
    try {
      git(dir, ['init', '-b', 'base']);
      writeJournal(dir, rel, journal(entry(0, 100, '0000_init')));
      git(dir, ['add', '.']);
      git(dir, ['commit', '-m', 'base journal']);
      writeJournal(dir, rel, journal(entry(0, 100, '0000_init'), entry(1, 101, '0001_added')));
      const code = main(['node', 'script', '--repo-root', dir, '--base-ref=HEAD']);
      assert.equal(code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checks every journal and reports only the bad path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'journal-when-multi-'));
    const good = 'one/meta/_journal.json';
    const bad = 'two/meta/_journal.json';
    try {
      git(dir, ['init', '-b', 'base']);
      writeJournal(dir, good, journal(entry(0, 10, '0000_init')));
      writeJournal(dir, bad, journal(entry(0, 10, '0000_init')));
      git(dir, ['add', '.']);
      git(dir, ['commit', '-m', 'base journals']);
      writeJournal(dir, good, journal(entry(0, 10, '0000_init'), entry(1, 20, '0001_ok')));
      writeJournal(dir, bad, journal(entry(0, 10, '0000_init'), entry(1, 5, '0001_bad')));
      const result = checkRepository({ repoRoot: dir, baseRef: 'HEAD' });
      assert.equal(result.ok, false);
      const text = result.errors.join('\n');
      expectIncludes(text, 'two/meta/_journal.json');
      expectIncludes(text, '0001_bad');
      expectIncludes(text, 'base max when=10');
      assert.equal(text.includes('one/meta/_journal.json'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('workflow contract', () => {
  it('keeps a stable job name on pull_request to test and main', () => {
    const yml = readFileSync(join(repoRoot, '.github/workflows/drizzle-journal-when.yml'), 'utf8');
    expectIncludes(yml, 'name: Drizzle journal when order');
    expectIncludes(yml, 'pull_request:');
    expectIncludes(yml, 'branches: [test, main]');
    for (const event of ['opened', 'synchronize', 'reopened', 'edited']) {
      assert.equal(yml.includes(event), true, event);
    }
    expectIncludes(yml, 'cancel-in-progress: false');
    expectIncludes(yml, 'drizzle-journal-when.ts');
  });
});

function writeJournal(root: string, rel: string, document: JournalDocument): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const body = {
    version: '7',
    dialect: 'postgresql',
    entries: document.entries.map((item) => ({
      idx: item.idx,
      version: '7',
      when: item.when,
      tag: item.tag,
      breakpoints: true,
    })),
  };
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

function git(cwd: string, args: string[]): void {
  execFileSync(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=Journal Check',
      ...args,
    ],
    { cwd, encoding: 'utf8', stdio: 'pipe' },
  );
}
