import { describe, expect, it } from 'vitest';
import {
  containsPattern,
  isAlnum,
  isDigit,
  isHexLower,
  isLower,
  lit,
  literalIncludes,
  run,
} from '../predicates';

describe('literalIncludes', () => {
  it('matches a substring', () => {
    expect(literalIncludes('cd /mnt/e/backups', '/mnt/e/')).toBe(true);
  });
  it('rejects when absent', () => {
    expect(literalIncludes('cd /mnt/d/backups', '/mnt/e/')).toBe(false);
  });
});

describe('containsPattern', () => {
  const teamId = [lit('team_'), run(isAlnum, 16)];

  it('matches prefix + class run at the required min length', () => {
    expect(containsPattern('id team_ABCdef0123456789 here', teamId)).toBe(true);
  });
  it('rejects when the class run is too short', () => {
    expect(containsPattern('team_ABCdef0123', teamId)).toBe(false);
  });
  it('advances the start index (match not at position 0)', () => {
    expect(containsPattern('zzzteam_ABCDEFGHIJKLMNOP', teamId)).toBe(true);
  });
  it('honors an exact max on a bounded run', () => {
    const handoff = [
      lit('/HANDOFF-'),
      run(isDigit, 4, 4),
      lit('-'),
      run(isDigit, 2, 2),
      lit('-'),
      run(isDigit, 2, 2),
    ];
    expect(containsPattern('docs/HANDOFF-2026-06-08-x', handoff)).toBe(true);
    expect(containsPattern('docs/HANDOFF-202-06-08', handoff)).toBe(false);
  });
  it('matches a multi-part token (license key)', () => {
    const license = [lit('RVUI-'), run(isLower, 1), lit('-'), run(isHexLower, 16)];
    expect(containsPattern('key RVUI-pro-0123456789abcdef', license)).toBe(true);
    expect(containsPattern('key RVUI-pro-0123', license)).toBe(false);
  });
});
