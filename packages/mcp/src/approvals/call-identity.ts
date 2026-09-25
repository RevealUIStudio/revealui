/**
 * Exact-call identity for governed MCP approvals.
 *
 * Hashes use RFC 8785 (`canonicalizeJcs`) so sign-time and verify-time bytes
 * match. The factory receipt digest still uses its local canonicalizer until
 * a later slice switches that path. An approval id never belongs in these
 * inputs: it travels outside `arguments`.
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
 * sha256 hex of JCS(arguments). `null` and `undefined` hash as `{}`.
 * Nested `undefined` throws (fail closed): JSON cannot represent it.
 */
export function hashMcpArguments(args: unknown): string {
  return sha256Hex(canonicalizeJcs(args ?? {}));
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
