import { describe, expect, it } from 'vitest';
import { makeMergeIntent, mergeIntentNow } from './__tests__/merge-intent.js';
import {
  canonicalMergeIntent,
  evaluateMergeExecution,
  mergeIntentSha256,
  validateMergeIntent,
} from './merge-admission.js';

describe('disabled merge admission', () => {
  it('never turns structurally valid hashes into authority', () => {
    const result = evaluateMergeExecution(makeMergeIntent(), mergeIntentNow);
    expect(result.allowed).toBe(false);
    expect(result.holds).toContain('merge_owner_grant_contract_unsupported');
    expect(result.holds).toContain('merge_application_time_authority_unsupported');
    expect(result.holds).toContain('merge_mutable_pr_eligibility_unsupported');
    expect(result.holds).toContain('merge_transport_unsupported');
  });
  it.each([
    { purpose: 'execute' },
    { transport: () => {} },
    { baseRef: 'refs/heads/test/../main' },
    { parents: ['b'.repeat(40), 'a'.repeat(40)] },
    { repositoryId: 0 },
    { authorizationGeneration: 0 },
    { receiptExpiresAt: '2026-10-22T22:00:00.000Z' },
    { grantExpiresAt: '2026-10-22T21:59:59.000Z' },
  ])('holds invalid or expired intent: %j', (change) => {
    expect(
      evaluateMergeExecution({ ...makeMergeIntent(), ...change }, mergeIntentNow).allowed,
    ).toBe(false);
    expect(() =>
      validateMergeIntent({ ...makeMergeIntent(), ...change }, mergeIntentNow),
    ).toThrow();
  });
  it('copies and freezes the candidate, canonicalizes key order, and binds its digest', () => {
    const original = makeMergeIntent();
    const intent = validateMergeIntent(original, mergeIntentNow);
    const digest = mergeIntentSha256(intent);
    const reordered = Object.fromEntries(Object.entries(original).reverse());
    expect(mergeIntentSha256(validateMergeIntent(reordered, mergeIntentNow))).toBe(digest);
    original.parents = ['0'.repeat(40), '0'.repeat(40)];
    expect(intent.parents).toEqual(['a'.repeat(40), 'b'.repeat(40)]);
    expect(Object.isFrozen(intent)).toBe(true);
    expect(Object.isFrozen(intent.parents)).toBe(true);
    expect(
      mergeIntentSha256(
        validateMergeIntent(makeMergeIntent({ treeOid: '9'.repeat(40) }), mergeIntentNow),
      ),
    ).not.toBe(digest);
    expect(canonicalMergeIntent(intent)).not.toContain('transport');
  });

  it.each([
    'indexed getter',
    'custom iterator',
    'iterator getter',
    'symbol accessor',
    'hidden symbol accessor',
    'nested symbol accessor',
    'top-level proxy',
    'nested proxy',
  ])('rejects %s without invoking caller behavior', (variant) => {
    let input = makeMergeIntent();
    let invoked = false;
    if (variant === 'indexed getter')
      Object.defineProperty(input.parents, '0', {
        get() {
          invoked = true;
          return 'a'.repeat(40);
        },
      });
    if (variant === 'custom iterator')
      Object.defineProperty(input.parents, Symbol.iterator, {
        value: function* () {
          invoked = true;
          yield '0'.repeat(40);
          yield '0'.repeat(40);
        },
      });
    if (variant === 'iterator getter')
      Object.defineProperty(input.parents, Symbol.iterator, {
        get() {
          invoked = true;
          return Array.prototype[Symbol.iterator];
        },
      });
    if (variant === 'symbol accessor' || variant === 'hidden symbol accessor') {
      Object.defineProperty(input, Symbol('unexpected'), {
        enumerable: variant === 'symbol accessor',
        get() {
          invoked = true;
          return 1;
        },
      });
    }
    if (variant === 'nested symbol accessor')
      Object.defineProperty(input.parents, Symbol('unexpected'), {
        enumerable: true,
        get() {
          invoked = true;
          return 1;
        },
      });
    if (variant === 'top-level proxy')
      input = new Proxy(input, {
        getPrototypeOf(target) {
          invoked = true;
          return Reflect.getPrototypeOf(target);
        },
      });
    if (variant === 'nested proxy')
      input.parents = new Proxy(input.parents, {
        get(target, key) {
          invoked = true;
          return Reflect.get(target, key);
        },
      });
    expect(() => validateMergeIntent(input, mergeIntentNow)).toThrow(/^merge_(intent|parents)_/);
    expect(invoked).toBe(false);
  });
});
