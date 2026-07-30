import { describe, expect, it } from 'vitest';
import { isAbandonedSessionRow } from '../session/reap.js';

describe('isAbandonedSessionRow', () => {
  it('keeps active peers', () => {
    expect(isAbandonedSessionRow({ id: 'a', active: true, staleSeconds: 0 }, 3600, 'self')).toBe(
      false,
    );
  });

  it('skips self', () => {
    expect(
      isAbandonedSessionRow({ id: 'self', active: false, staleSeconds: 9999 }, 3600, 'self'),
    ).toBe(false);
  });

  it('flags heartbeat-idle rows', () => {
    expect(
      isAbandonedSessionRow({ id: 'zombie', active: false, staleSeconds: 7200 }, 3600, 'self'),
    ).toBe(true);
  });

  it('does not flag idle rows under the floor', () => {
    expect(
      isAbandonedSessionRow({ id: 'quiet', active: false, staleSeconds: 400 }, 3600, 'self'),
    ).toBe(false);
  });
});
