/**
 * RFC 8785 (JSON Canonicalization Scheme) — deterministic JSON serialization.
 *
 * GAP-355 Stage 3: the single fleet canonicalizer. Signing an `audit_log` row
 * over `JSON.stringify(payload)` is not verifiable, because the payload is a
 * `jsonb` column and Postgres does not preserve object key order — the bytes
 * signed at write time cannot be reconstructed at read time (ADR
 * `2026-07-12-audit-receipt-architecture` finding 2). Canonicalizing to a
 * deterministic byte string at BOTH sign and verify time is what makes a
 * per-row signature reproducible from storage.
 *
 * Promoted from `apps/server/src/lib/mcp-audit.ts`'s `canonicalJson` (which was
 * already most of RFC 8785: recursive lexicographic key sort via JS string `<`,
 * which is UTF-16 code-unit ordering as JCS specifies, and `JSON.stringify` per
 * scalar, which adopts ES number/string serialization). Hardened here to full
 * conformance: it FAILS LOUDLY on any value JSON cannot represent rather than
 * silently coercing it (a signer must never sign something other than what it
 * was handed), and normalizes `-0` to `0`.
 *
 * Zero authored regex (fleet no-regex rule) — a manual recursive serializer.
 *
 * Number caveat: scalar numbers use `JSON.stringify` (ES `Number.prototype.
 * toString`), which is RFC 8785 §3.2.2.3-conformant across the range audit rows
 * carry (integers within `Number.MAX_SAFE_INTEGER`, ordinary decimals). The full
 * ECMAScript number-formatting edge cases (extreme exponents) are not
 * independently reimplemented; audit payloads do not carry such values.
 */

/**
 * Canonicalize a JSON-compatible value to its RFC 8785 string form.
 *
 * Throws on any value JSON cannot represent — `undefined`, functions, symbols,
 * `bigint`, and non-finite numbers (`NaN`/`±Infinity`) — wherever it appears in
 * the tree. This is deliberate: silently coercing `undefined`/`NaN` to `null`
 * (as `JSON.stringify` does) would let a signer sign bytes that differ from the
 * caller's intent, which is exactly the class of bug this module exists to kill.
 */
export function canonicalizeJcs(value: unknown): string {
  switch (typeof value) {
    case 'undefined':
      throw new Error('canonicalizeJcs: undefined is not JSON-representable');
    case 'function':
    case 'symbol':
      throw new Error(`canonicalizeJcs: ${typeof value} is not JSON-representable`);
    case 'bigint':
      throw new Error('canonicalizeJcs: bigint is not JSON-representable');
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error('canonicalizeJcs: non-finite number is not JSON-representable');
      }
      // Normalize -0 to 0 (JCS/ES serialization); JSON.stringify(-0) is "0"
      // already, but be explicit so the intent survives refactors.
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'boolean':
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (value === null) return 'null';
      if (Array.isArray(value)) {
        return `[${value.map(canonicalizeJcs).join(',')}]`;
      }
      // Object: sort keys by UTF-16 code unit (JS string comparison), then
      // recurse. An `undefined` value on any key throws via the recursion above
      // rather than being dropped, so the canonical form is total over the input.
      const entries = Object.entries(value as Record<string, unknown>).sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
      );
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalizeJcs(v)}`).join(',')}}`;
    }
    default:
      throw new Error(`canonicalizeJcs: unsupported type ${typeof value}`);
  }
}
