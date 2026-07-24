/**
 * GAP-355 Stage 6 S6-1 — AgentPrincipal resolvers (pure unit tests).
 */

import { describe, expect, it } from 'vitest';
import {
  type AgentPrincipal,
  principalHasGrant,
  principalRoleList,
  resolveDispatchPrincipal,
  resolveJobPrincipal,
  resolveMcpBoundPrincipal,
  resolveStreamPrincipal,
} from '../agent-principal.js';

function assertFrozen(principal: AgentPrincipal): void {
  expect(Object.isFrozen(principal)).toBe(true);
  expect(Object.isFrozen(principal.roles)).toBe(true);
  expect(Object.isFrozen(principal.grants)).toBe(true);
}

describe('resolveStreamPrincipal', () => {
  it('builds admin-stream-agent with user + agent roles', () => {
    const p = resolveStreamPrincipal({
      mode: 'admin',
      userId: 'user-1',
      userRole: 'editor',
      tenantId: 'tenant-a',
      accountId: 'acct-1',
    });
    expect(p).toMatchObject({
      agentId: 'admin-stream-agent',
      kind: 'stream',
      tenantId: 'tenant-a',
      accountId: 'acct-1',
      actingUserId: 'user-1',
      roles: ['editor', 'agent'],
      grants: [],
    });
    assertFrozen(p);
  });

  it('builds coding-stream-agent for coding mode', () => {
    const p = resolveStreamPrincipal({
      mode: 'coding',
      userId: 'user-2',
      userRole: 'owner',
    });
    expect(p.agentId).toBe('coding-stream-agent');
    expect(p.roles).toEqual(['owner', 'agent']);
    expect(p.tenantId).toBeNull();
    expect(p.accountId).toBeNull();
  });

  it('dedupes agent role when userRole is already agent', () => {
    const p = resolveStreamPrincipal({
      mode: 'admin',
      userId: 'u',
      userRole: 'agent',
    });
    expect(p.roles).toEqual(['agent']);
  });

  it('preserves explicit grants', () => {
    const p = resolveStreamPrincipal({
      mode: 'coding',
      userId: 'u',
      userRole: 'admin',
      grants: [{ resource: 'agent:tool:coding:shell_exec', action: 'execute' }],
    });
    expect(p.grants).toEqual([{ resource: 'agent:tool:coding:shell_exec', action: 'execute' }]);
    expect(principalHasGrant(p, 'agent:tool:coding:shell_exec', 'execute')).toBe(true);
  });

  it('throws when userId is empty', () => {
    expect(() =>
      resolveStreamPrincipal({ mode: 'admin', userId: '  ', userRole: 'admin' }),
    ).toThrow(/userId/);
  });
});

describe('resolveDispatchPrincipal', () => {
  it('scopes agentId to ticket when present', () => {
    const p = resolveDispatchPrincipal({
      ticketId: 'ticket-42',
      userId: 'user-1',
      userRole: 'admin',
      workspaceId: 'ws-1',
      accountId: 'acct-1',
    });
    expect(p).toMatchObject({
      agentId: 'ticket-agent-ticket-42',
      kind: 'dispatch',
      tenantId: 'ws-1',
      accountId: 'acct-1',
      actingUserId: 'user-1',
      roles: ['admin', 'agent'],
    });
    assertFrozen(p);
  });

  it('falls back to ticket-agent-dispatcher without ticketId', () => {
    const p = resolveDispatchPrincipal({
      userId: null,
      userRole: null,
    });
    expect(p.agentId).toBe('ticket-agent-dispatcher');
    expect(p.actingUserId).toBeNull();
    expect(p.roles).toEqual(['agent']);
  });
});

describe('resolveJobPrincipal', () => {
  it('builds a job principal', () => {
    const p = resolveJobPrincipal({
      agentId: 'ticket-agent-ticket-9',
      userId: 'owner-1',
      userRole: 'owner',
      tenantId: 't1',
      accountId: 'a1',
    });
    expect(p.kind).toBe('job');
    expect(p.agentId).toBe('ticket-agent-ticket-9');
    expect(p.roles).toEqual(['owner', 'agent']);
    assertFrozen(p);
  });

  it('throws when agentId is empty', () => {
    expect(() => resolveJobPrincipal({ agentId: '' })).toThrow(/agentId/);
  });
});

describe('resolveMcpBoundPrincipal', () => {
  it('prefixes agentId with mcp:', () => {
    const p = resolveMcpBoundPrincipal({
      clientName: 'opencode',
      userId: 'user-1',
      userRole: 'editor',
      accountId: 'acct-1',
    });
    expect(p).toMatchObject({
      agentId: 'mcp:opencode',
      kind: 'mcp-bound',
      actingUserId: 'user-1',
      roles: ['editor', 'agent'],
      accountId: 'acct-1',
    });
    assertFrozen(p);
  });

  it('uses unknown client when name blank', () => {
    const p = resolveMcpBoundPrincipal({
      clientName: '  ',
      userId: 'user-1',
      userRole: 'viewer',
    });
    expect(p.agentId).toBe('mcp:unknown');
  });
});

describe('principalHasGrant / principalRoleList', () => {
  it('principalHasGrant is false when grants empty', () => {
    const p = resolveStreamPrincipal({
      mode: 'admin',
      userId: 'u',
      userRole: 'admin',
    });
    expect(principalHasGrant(p, 'anything', 'execute')).toBe(false);
  });

  it('principalRoleList returns a mutable copy', () => {
    const p = resolveStreamPrincipal({
      mode: 'admin',
      userId: 'u',
      userRole: 'admin',
    });
    const list = principalRoleList(p);
    list.push('mutated');
    expect(p.roles).toEqual(['admin', 'agent']);
  });
});
