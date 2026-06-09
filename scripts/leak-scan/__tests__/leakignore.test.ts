import { describe, expect, it } from 'vitest';
import { makeIsIgnored, parseLeakignore } from '../leakignore';

describe('parseLeakignore', () => {
  it('parses glob + tags and strips comments + blank lines', () => {
    const entries = parseLeakignore(
      [
        '# a comment',
        '',
        'wsl/bashrc.d/70-revcon-personal.sh   private-jv-repo',
        'docs/x.md   abs-windows-user   # reason',
      ].join('\n'),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]?.glob).toBe('wsl/bashrc.d/70-revcon-personal.sh');
    expect(entries[0]?.tags.has('private-jv-repo')).toBe(true);
  });
  it('skips a glob-only line that lists no tags', () => {
    expect(parseLeakignore('just/a/path\n')).toEqual([]);
  });
  it('parses multiple comma-separated tags', () => {
    const entries = parseLeakignore('a.ts  lts-drive,forge-drive\n');
    expect(entries[0]?.tags.has('lts-drive')).toBe(true);
    expect(entries[0]?.tags.has('forge-drive')).toBe(true);
  });
});

describe('makeIsIgnored', () => {
  const ignored = makeIsIgnored(parseLeakignore('frontend/src/foo.ts  abs-home-path\n'));

  it('suppresses only when BOTH the path-glob and the tag match', () => {
    expect(ignored('frontend/src/foo.ts', 'abs-home-path')).toBe(true);
    expect(ignored('frontend/src/foo.ts', 'lts-drive')).toBe(false);
    expect(ignored('other.ts', 'abs-home-path')).toBe(false);
  });
  it('normalizes a leading ./ (revvault#45 parity)', () => {
    expect(ignored('./frontend/src/foo.ts', 'abs-home-path')).toBe(true);
  });
});
