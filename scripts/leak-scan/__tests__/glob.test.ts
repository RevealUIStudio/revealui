import { describe, expect, it } from 'vitest';
import { matchGlob } from '../glob';

describe('matchGlob', () => {
  it('matches an exact literal path', () => {
    expect(
      matchGlob('wsl/bashrc.d/70-revcon-personal.sh', 'wsl/bashrc.d/70-revcon-personal.sh'),
    ).toBe(true);
  });
  it('matches a basename suffix glob', () => {
    expect(matchGlob('logo.png', '*.png')).toBe(true);
    expect(matchGlob('logo.svg', '*.png')).toBe(false);
  });
  it('lets `*` cross path separators (bash [[ == ]] semantics)', () => {
    expect(matchGlob('a/b/c.ts', 'a/*.ts')).toBe(true);
    expect(matchGlob('a/b/c.ts', '*.ts')).toBe(true);
  });
  it('matches `?` as exactly one character', () => {
    expect(matchGlob('ab', 'a?')).toBe(true);
    expect(matchGlob('abc', 'a?')).toBe(false);
  });
  it('rejects a non-match', () => {
    expect(matchGlob('foo/bar', 'baz/*')).toBe(false);
  });
  it('trailing star matches the empty remainder', () => {
    expect(matchGlob('abc', 'abc*')).toBe(true);
  });
});
