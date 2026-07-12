/**
 * `listDir` determinism (GAP-349 item 2).
 *
 * `readdirSync` order is POSIX-unspecified — extractors that fold a
 * directory listing into a `Map` with last-write-wins semantics (see
 * `determinism.test.ts` for the concrete `workspace.ts` scenario this
 * enabled) could pick a different winner on a rescan of an unchanged tree.
 * `listDir` sorts at the single source so every consumer inherits a stable
 * order regardless of filesystem/kernel readdir behavior.
 */

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listDir } from '../shared.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readdirSync: vi.fn(actual.readdirSync) };
});

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('listDir', () => {
  it('returns entries in sorted (not raw readdir) order', () => {
    const root = mkdtempSync(join(tmpdir(), 'revkg-listdir-'));
    tempDirs.push(root);
    // Create in an order that is NOT already alphabetical, so a passing
    // test proves sorting happened rather than accidentally matching
    // filesystem insertion order.
    for (const name of ['zzz', 'aaa', 'mmm']) {
      writeFileSync(join(root, name), '');
    }

    expect(listDir(root)).toEqual(['aaa', 'mmm', 'zzz']);
  });

  it('returns an empty array for a path that does not exist', () => {
    expect(listDir(join(tmpdir(), 'revkg-listdir-does-not-exist'))).toEqual([]);
  });

  it('sorts even when the underlying readdirSync returns an unsorted order (prove-red target)', () => {
    // `readdirSync` order is POSIX-unspecified; on this sandbox's ext4 a
    // small freshly-created directory happens to come back alphabetical
    // already, so the fixture-based test above can't force a red run. This
    // mock pins a KNOWN unsorted raw order so the assertion is load-bearing
    // regardless of what any given filesystem/kernel happens to do.
    vi.mocked(readdirSync).mockReturnValueOnce(['zzz', 'aaa', 'mmm'] as unknown as ReturnType<
      typeof readdirSync
    >);

    expect(listDir('/irrelevant-mocked-path')).toEqual(['aaa', 'mmm', 'zzz']);
  });
});
