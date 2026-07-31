/**
 * Rules-lockstep gate unit tests. Exercise the pure verification core against
 * temp-dir fixtures (no git repo needed: tracked files are injected), covering
 * the pass case, local-edit drift, missing files, leftover symlinks, strays,
 * and malformed manifests.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Manifest, sha256OfFile, verifyLockstep } from '../rules-lockstep.js';

let root: string;

function writeRule(rel: string, content: string): string {
  const abs = path.join(root, '.claude', rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

function manifestFor(files: Record<string, string>): Manifest {
  const entries: Record<string, { source: string; sha256: string }> = {};
  for (const [rel, _content] of Object.entries(files)) {
    entries[rel] = {
      source: `profiles/revealui/claude/${rel}`,
      sha256: sha256OfFile(path.join(root, '.claude', rel)),
    };
  }
  return { mode: 'copy', editor: 'claude', profiles: ['revfleet', 'revealui'], files: entries };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'rules-lockstep-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('verifyLockstep', () => {
  it('passes when every copy matches the manifest and no strays exist', () => {
    writeRule('rules/git.md', '# Git Conventions\n');
    writeRule('agents/builder.md', '# Builder\n');
    const manifest = manifestFor({
      'rules/git.md': '',
      'agents/builder.md': '',
    });
    const tracked = ['.claude/rules/git.md', '.claude/agents/builder.md'];
    expect(verifyLockstep(root, manifest, tracked)).toEqual([]);
  });

  it('flags a locally edited copy (hash mismatch)', () => {
    writeRule('rules/git.md', '# Git Conventions\n');
    const manifest = manifestFor({ 'rules/git.md': '' });
    writeRule('rules/git.md', '# Git Conventions\n\nHand edit.\n');
    const problems = verifyLockstep(root, manifest, ['.claude/rules/git.md']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('.claude/rules/git.md');
    expect(problems[0]).toContain('differs from the manifest');
  });

  it('flags a manifest entry missing on disk', () => {
    writeRule('rules/git.md', '# Git Conventions\n');
    const manifest = manifestFor({ 'rules/git.md': '' });
    rmSync(path.join(root, '.claude', 'rules', 'git.md'));
    const problems = verifyLockstep(root, manifest, []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('missing on disk');
  });

  it('flags a leftover symlink where a copy should be', () => {
    const target = path.join(root, 'profile-source.md');
    writeFileSync(target, '# Source\n');
    const manifest: Manifest = {
      mode: 'copy',
      editor: 'claude',
      profiles: ['revealui'],
      files: {
        'rules/linked.md': {
          source: 'profiles/revealui/claude/rules/linked.md',
          sha256: sha256OfFile(target),
        },
      },
    };
    mkdirSync(path.join(root, '.claude', 'rules'), { recursive: true });
    symlinkSync(target, path.join(root, '.claude', 'rules', 'linked.md'));
    const problems = verifyLockstep(root, manifest, ['.claude/rules/linked.md']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('still a symlink');
  });

  it('flags a tracked stray that is not in the manifest', () => {
    writeRule('rules/git.md', '# Git Conventions\n');
    const manifest = manifestFor({ 'rules/git.md': '' });
    const tracked = ['.claude/rules/git.md', '.claude/rules/hand-added.md'];
    const problems = verifyLockstep(root, manifest, tracked);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('hand-added.md');
    expect(problems[0]).toContain('not in the manifest');
  });

  it('rejects a manifest whose mode is not copy', () => {
    const manifest = { mode: 'symlink', editor: 'claude', profiles: [], files: {} } as Manifest;
    const problems = verifyLockstep(root, manifest, []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('malformed');
  });

  it('definition-owned Claude rules must match content (not revcon hash)', () => {
    const body = '# Biome\nfrom definitions\n';
    writeRule('rules/biome.md', body);
    mkdirSync(path.join(root, '.revealui', 'content', 'rules'), { recursive: true });
    writeFileSync(path.join(root, '.revealui', 'content', 'rules', 'biome.md'), body);
    // Manifest still has a stale revcon hash for biome.
    const manifest: Manifest = {
      mode: 'copy',
      editor: 'claude',
      profiles: ['revealui'],
      files: {
        'rules/biome.md': {
          source: 'profiles/revealui/claude/rules/biome.md',
          sha256: 'deadbeef',
        },
      },
    };
    const defIds = new Set(['biome']);
    expect(verifyLockstep(root, manifest, ['.claude/rules/biome.md'], defIds)).toEqual([]);

    writeRule('rules/biome.md', `${body}\ndrift\n`);
    const drifted = verifyLockstep(root, manifest, ['.claude/rules/biome.md'], defIds);
    expect(drifted.some((p) => p.includes('dual drift'))).toBe(true);
  });

  it('definition mirrors not in the revcon manifest are not strays when they match content', () => {
    const body = '# Code over docs\n';
    writeRule('rules/code-over-docs.md', body);
    mkdirSync(path.join(root, '.revealui', 'content', 'rules'), { recursive: true });
    writeFileSync(path.join(root, '.revealui', 'content', 'rules', 'code-over-docs.md'), body);
    writeRule('rules/git.md', '# Git\n');
    const manifest = manifestFor({ 'rules/git.md': '' });
    const defIds = new Set(['code-over-docs']);
    const tracked = ['.claude/rules/git.md', '.claude/rules/code-over-docs.md'];
    expect(verifyLockstep(root, manifest, tracked, defIds)).toEqual([]);
  });
});
