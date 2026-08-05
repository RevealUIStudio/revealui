import { describe, expect, it } from 'vitest';
import {
  checkDispositionCommand,
  isGhPrMergeCommand,
  isSecuritySelfClearCommand,
} from '../disposition-command-gate.js';

describe('isGhPrMergeCommand', () => {
  it('detects gh pr merge', () => {
    expect(isGhPrMergeCommand('gh pr merge 12 --merge')).toBe(true);
    expect(isGhPrMergeCommand('cd ~/x && gh pr merge 1 -R o/r')).toBe(true);
  });

  it('ignores unrelated gh pr commands', () => {
    expect(isGhPrMergeCommand('gh pr view 12')).toBe(false);
    expect(isGhPrMergeCommand('gh pr create --title x')).toBe(false);
  });
});

describe('isSecuritySelfClearCommand', () => {
  it('detects review dismiss', () => {
    expect(isSecuritySelfClearCommand('gh pr review 1 --dismiss')).toBe(true);
  });

  it('detects remove-label sec-review', () => {
    expect(isSecuritySelfClearCommand('gh pr edit 1 --remove-label sec-review:approved')).toBe(
      true,
    );
  });
});

describe('checkDispositionCommand', () => {
  it('blocks merge', () => {
    const r = checkDispositionCommand('gh pr merge 3 --squash');
    expect(r.block).toBe(true);
    expect(r.rule).toBe('disposition-no-merge');
  });

  it('blocks self-clear', () => {
    const r = checkDispositionCommand('gh pr review 9 --dismiss -b "cleared"');
    expect(r.block).toBe(true);
  });

  it('allows ordinary commands', () => {
    expect(checkDispositionCommand('pnpm test').block).toBe(false);
    expect(checkDispositionCommand('gh pr view 1 --json title').block).toBe(false);
  });
});
