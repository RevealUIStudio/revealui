/**
 * Exact-call identity for governed MCP approvals.
 *
 * An approval binds the tool name, a JCS hash of the arguments, a JCS hash of
 * the advertised tool schema, and the account plus requester. Key order must
 * not change the digest. A nested `undefined` is not JSON, so hashing fails
 * closed instead of dropping the field.
 */

import { describe, expect, it } from 'vitest';
import {
  hashMcpArguments,
  hashMcpCallDigest,
  hashMcpToolSchema,
  MCP_CALL_DIGEST_VERSION,
} from '../approvals/call-identity.js';

const baseCall = {
  tool: 'kg_add_episode',
  argsHash: 'a'.repeat(64),
  toolSchemaHash: 'b'.repeat(64),
  accountId: 'acct-1',
  requesterUserId: 'user-1',
};

describe('MCP call identity hashes', () => {
  it('hashes arguments stably across key order and treats null as an empty object', () => {
    const left = hashMcpArguments({ siteId: 's1', collection: 'pages' });
    const right = hashMcpArguments({ collection: 'pages', siteId: 's1' });
    expect(left).toBe(right);
    expect(left).toHaveLength(64);
    expect(hashMcpArguments(undefined)).toBe(hashMcpArguments({}));
    expect(hashMcpArguments(null)).toBe(hashMcpArguments({}));
    expect(hashMcpArguments({ n: -0 })).toBe(hashMcpArguments({ n: 0 }));
  });

  it('changes the argument hash when a value changes', () => {
    expect(hashMcpArguments({ collection: 'pages' })).not.toBe(
      hashMcpArguments({ collection: 'posts' }),
    );
  });

  it('rejects undefined nested in arguments', () => {
    expect(() => hashMcpArguments({ collection: undefined })).toThrow(/undefined/);
  });

  it('hashes the tool schema stably and changes when the schema changes', () => {
    const schema = {
      type: 'object',
      properties: { collection: { type: 'string' } },
    };
    const reordered = {
      properties: { collection: { type: 'string' } },
      type: 'object',
    };
    const named = { name: 'revealui_session_open', inputSchema: schema };
    expect(hashMcpToolSchema(named)).toBe(hashMcpToolSchema({ ...named, inputSchema: reordered }));
    expect(hashMcpToolSchema(named)).toBe(hashMcpToolSchema({ ...named, annotations: null }));
    expect(hashMcpToolSchema(named)).not.toBe(
      hashMcpToolSchema({
        ...named,
        inputSchema: { type: 'object', properties: { collection: { type: 'number' } } },
      }),
    );
    expect(hashMcpToolSchema(named)).not.toBe(
      hashMcpToolSchema({ ...named, annotations: { readOnlyHint: false } }),
    );
  });

  it('binds tool, argument hash, schema hash, account, and requester into one digest', () => {
    const digest = hashMcpCallDigest(baseCall);
    expect(digest).toHaveLength(64);
    expect(MCP_CALL_DIGEST_VERSION).toBe(1);
    expect(hashMcpCallDigest(baseCall)).toBe(hashMcpCallDigest({ ...baseCall }));
    expect(hashMcpCallDigest({ ...baseCall, tool: 'revealui_session_patch' })).not.toBe(digest);
    expect(hashMcpCallDigest({ ...baseCall, argsHash: 'c'.repeat(64) })).not.toBe(digest);
    expect(hashMcpCallDigest({ ...baseCall, toolSchemaHash: 'd'.repeat(64) })).not.toBe(digest);
    expect(hashMcpCallDigest({ ...baseCall, accountId: 'acct-2' })).not.toBe(digest);
    expect(hashMcpCallDigest({ ...baseCall, requesterUserId: 'user-2' })).not.toBe(digest);
  });
});
