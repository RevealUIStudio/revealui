/**
 * Exact-call identity for governed MCP approvals.
 *
 * Hashes use RFC 8785 (`canonicalizeJcs`) so sign-time and verify-time bytes
 * match. The content factory receipt digest uses the same helper. An approval
 * id never belongs in these inputs: it travels outside `arguments`.
 *
 * Only plain JSON is hashed. A Date or other class instance is rejected so it
 * cannot collapse to `{}`.
 */

import { createHash } from 'node:crypto';
import { canonicalizeJcs } from '@revealui/security';

/** Version byte inside `callDigest`. Bump only with a new digest shape. */
export const MCP_CALL_DIGEST_VERSION = 1;

/** Advertised tool shape that `toolSchemaHash` binds. */
export interface McpToolSchemaIdentity {
  name: string;
  inputSchema: unknown;
  annotations?: unknown;
}

/** Fields bound into `callDigest`. */
export interface McpCallIdentityInput {
  tool: string;
  argsHash: string;
  toolSchemaHash: string;
  accountId: string;
  requesterUserId: string;
}

function sha256Hex(canonical: string): string {
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Reject values JSON cannot round-trip. `undefined` is left for JCS so the
 * error still names it. Class instances (Date, Map) are not plain JSON.
 */
function assertPlainJson(value: unknown): void {
  switch (typeof value) {
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint':
    case 'number':
    case 'string':
    case 'boolean':
      return;
    case 'object': {
      if (value === null) return;
      if (Array.isArray(value)) {
        for (const item of value) assertPlainJson(item);
        return;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error('hashMcpArguments: value is not plain JSON');
      }
      for (const nested of Object.values(value as Record<string, unknown>)) {
        assertPlainJson(nested);
      }
      return;
    }
    default:
      throw new Error('hashMcpArguments: value is not plain JSON');
  }
}

/**
 * sha256 hex of JCS(arguments). `null` and `undefined` hash as `{}`.
 * Nested `undefined` throws (fail closed): JSON cannot represent it.
 */
export function hashMcpArguments(args: unknown): string {
  const value = args ?? {};
  assertPlainJson(value);
  return sha256Hex(canonicalizeJcs(value));
}

/**
 * sha256 hex of JCS({ name, inputSchema, annotations }).
 * Missing annotations hash as `null`, so omission and explicit null match.
 */
export function hashMcpToolSchema(tool: McpToolSchemaIdentity): string {
  return sha256Hex(
    canonicalizeJcs({
      name: tool.name,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations ?? null,
    }),
  );
}

/**
 * sha256 hex of JCS({ v, tool, argsHash, toolSchemaHash, accountId, requesterUserId }).
 * Account and requester are inside the digest so another principal cannot replay it.
 */
export function hashMcpCallDigest(input: McpCallIdentityInput): string {
  return sha256Hex(
    canonicalizeJcs({
      v: MCP_CALL_DIGEST_VERSION,
      tool: input.tool,
      argsHash: input.argsHash,
      toolSchemaHash: input.toolSchemaHash,
      accountId: input.accountId,
      requesterUserId: input.requesterUserId,
    }),
  );
}
