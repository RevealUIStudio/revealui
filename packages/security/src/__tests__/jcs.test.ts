import { describe, expect, it } from 'vitest';
import { canonicalizeJcs } from '../jcs.js';

describe('canonicalizeJcs (RFC 8785)', () => {
  it('sorts object keys by UTF-16 code unit', () => {
    expect(canonicalizeJcs({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it('sorts nested object keys recursively', () => {
    expect(canonicalizeJcs({ z: { y: 1, x: 2 }, a: 1 })).toBe('{"a":1,"z":{"x":2,"y":1}}');
  });

  it('orders ASCII before higher code points (a before é)', () => {
    // JCS sorts by UTF-16 code unit: 'a' (U+0061) < 'é' (U+00E9).
    expect(canonicalizeJcs({ é: 1, a: 2 })).toBe('{"a":2,"é":1}');
  });

  it('orders uppercase before lowercase (code-unit order)', () => {
    // 'A' (U+0041) < 'a' (U+0061)
    expect(canonicalizeJcs({ a: 1, A: 2 })).toBe('{"A":2,"a":1}');
  });

  it('preserves array element order (arrays are not sorted)', () => {
    expect(canonicalizeJcs([3, 1, 2])).toBe('[3,1,2]');
  });

  it('serializes scalars', () => {
    expect(canonicalizeJcs(null)).toBe('null');
    expect(canonicalizeJcs(true)).toBe('true');
    expect(canonicalizeJcs(false)).toBe('false');
    expect(canonicalizeJcs('hello')).toBe('"hello"');
    expect(canonicalizeJcs(42)).toBe('42');
    expect(canonicalizeJcs(1.5)).toBe('1.5');
  });

  it('normalizes -0 to 0', () => {
    expect(canonicalizeJcs(-0)).toBe('0');
    expect(canonicalizeJcs({ n: -0 })).toBe('{"n":0}');
  });

  it('escapes strings per JSON (quotes, backslash, control chars)', () => {
    expect(canonicalizeJcs('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(canonicalizeJcs('tab\tnewline\n')).toBe('"tab\\tnewline\\n"');
  });

  it('is stable regardless of input key insertion order (the load-bearing property)', () => {
    const a = canonicalizeJcs({ one: 1, two: 2, three: 3 });
    const b = canonicalizeJcs({ three: 3, one: 1, two: 2 });
    expect(a).toBe(b);
  });

  it('canonicalizes a representative audit payload deterministically', () => {
    const payload = { userId: 'u1', tool: 'read', nested: { b: [2, 3], a: 1 } };
    expect(canonicalizeJcs(payload)).toBe(
      '{"nested":{"a":1,"b":[2,3]},"tool":"read","userId":"u1"}',
    );
  });

  // Fail-loud on non-JSON-representable input — the property that stops a signer
  // from signing something other than what it was handed.
  it('throws on undefined', () => {
    expect(() => canonicalizeJcs(undefined)).toThrow(/undefined/);
  });

  it('throws on a non-finite number (NaN / Infinity)', () => {
    expect(() => canonicalizeJcs(Number.NaN)).toThrow(/non-finite/);
    expect(() => canonicalizeJcs(Number.POSITIVE_INFINITY)).toThrow(/non-finite/);
  });

  it('throws on bigint, function, and symbol — including nested', () => {
    expect(() => canonicalizeJcs(1n)).toThrow(/bigint/);
    expect(() => canonicalizeJcs({ f: () => 0 })).toThrow(/function/);
    expect(() => canonicalizeJcs({ s: Symbol('x') })).toThrow(/symbol/);
  });

  it('throws on an undefined object value rather than dropping the key', () => {
    expect(() => canonicalizeJcs({ a: 1, b: undefined })).toThrow(/undefined/);
  });
});
