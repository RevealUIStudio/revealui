import { describe, expect, it } from 'vitest';
import { httpFallbackDid } from '../did.js';

describe('httpFallbackDid', () => {
  it('is stable for the same user and account', () => {
    const a = httpFallbackDid('user-1', 'acct_1');
    const b = httpFallbackDid('user-1', 'acct_1');
    expect(a).toEqual(b);
    expect(a.didKind).toBe('user-account-fallback');
    expect(a.did.startsWith('did:revfleet:user_')).toBe(true);
  });

  it('differs across accounts', () => {
    expect(httpFallbackDid('user-1', 'acct_1').did).not.toBe(
      httpFallbackDid('user-1', 'acct_2').did,
    );
  });
});
