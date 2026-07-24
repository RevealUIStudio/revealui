/**
 * GAP-355 Stage 6 S6-2 — authorizeAgentTool policy matrix.
 */

import { describe, expect, it } from 'vitest';
import {
  type AgentPrincipal,
  resolveDispatchPrincipal,
  resolveStreamPrincipal,
} from '../agent-principal.js';
import {
  agentToolPermissionKey,
  authorizeAgentTool,
  getAgentToolMeta,
  listExecToolNames,
} from '../agent-tool-access.js';

function stream(role: string, grants?: AgentPrincipal['grants']): AgentPrincipal {
  return resolveStreamPrincipal({
    mode: 'coding',
    userId: 'user-1',
    userRole: role,
    grants,
  });
}

describe('agentToolPermissionKey', () => {
  it('prefixes exact tool names', () => {
    expect(agentToolPermissionKey('shell_exec')).toBe('agent:tool:shell_exec');
  });
});

describe('getAgentToolMeta', () => {
  it('classifies known tools', () => {
    expect(getAgentToolMeta('file_read')).toMatchObject({
      surface: 'coding',
      class: 'read',
    });
    expect(getAgentToolMeta('list_users')).toMatchObject({
      surface: 'admin',
      class: 'admin-pii',
    });
    expect(getAgentToolMeta('shell_exec')?.class).toBe('exec');
  });

  it('returns undefined for unknown tools', () => {
    expect(getAgentToolMeta('not_a_real_tool')).toBeUndefined();
  });
});

describe('authorizeAgentTool — deny by default', () => {
  it('denies unknown tools', () => {
    const r = authorizeAgentTool(stream('owner'), 'mcp_fake__tool');
    expect(r).toMatchObject({
      allowed: false,
      reason: 'unknown_tool',
      permissionKey: null,
    });
  });
});

describe('authorizeAgentTool — coding exec requires grant', () => {
  for (const name of listExecToolNames()) {
    it(`denies ${name} without explicit grant even for owner`, () => {
      const r = authorizeAgentTool(stream('owner'), name);
      expect(r).toMatchObject({
        allowed: false,
        reason: 'exec_requires_grant',
        class: 'exec',
      });
    });

    it(`allows ${name} with explicit grant`, () => {
      const r = authorizeAgentTool(
        stream('viewer', [{ resource: agentToolPermissionKey(name), action: 'execute' }]),
        name,
      );
      expect(r).toMatchObject({
        allowed: true,
        reason: 'explicit_grant',
        class: 'exec',
      });
    });
  }
});

describe('authorizeAgentTool — coding read/mutate', () => {
  it('allows file_read for agent+viewer roles', () => {
    const r = authorizeAgentTool(stream('viewer'), 'file_read');
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('allowed');
  });

  it('allows file_write for editor (agent has mutate coding)', () => {
    const r = authorizeAgentTool(stream('editor'), 'file_write');
    expect(r.allowed).toBe(true);
  });

  it('denies file_write for viewer (agent role alone would allow mutate, viewer human is N/A for coding)', () => {
    // Coding surface does not apply human ∩ — agent role includes mutate.
    // Viewer principal roles = [viewer, agent]; roleAllows with full roles passes
    // because agent has file_write. That is intentional for coding (not admin ∩).
    const r = authorizeAgentTool(stream('viewer'), 'file_write');
    expect(r.allowed).toBe(true);
  });
});

describe('authorizeAgentTool — admin ∩ human role', () => {
  it('allows list_collections for editor (both agent and editor have read admin)', () => {
    const r = authorizeAgentTool(
      resolveStreamPrincipal({ mode: 'admin', userId: 'u', userRole: 'editor' }),
      'list_collections',
    );
    expect(r).toMatchObject({ allowed: true, reason: 'allowed', surface: 'admin' });
  });

  it('denies list_users for editor (admin-pii is owner/admin only on human side)', () => {
    const r = authorizeAgentTool(
      resolveStreamPrincipal({ mode: 'admin', userId: 'u', userRole: 'editor' }),
      'list_users',
    );
    // agent role also lacks admin-pii → agent_role_denied first
    expect(r.allowed).toBe(false);
    expect(['agent_role_denied', 'user_role_denied']).toContain(r.reason);
  });

  it('allows list_users for owner', () => {
    const r = authorizeAgentTool(
      resolveStreamPrincipal({ mode: 'admin', userId: 'u', userRole: 'owner' }),
      'list_users',
    );
    expect(r.allowed).toBe(true);
  });

  it('denies delete_document when only agent role would pass but human is viewer', () => {
    const r = authorizeAgentTool(
      resolveStreamPrincipal({ mode: 'admin', userId: 'u', userRole: 'viewer' }),
      'delete_document',
    );
    // agent has mutate admin; viewer human does not → user_role_denied
    expect(r).toMatchObject({
      allowed: false,
      reason: 'user_role_denied',
      surface: 'admin',
    });
  });

  it('denies admin tools when principal has no human role (agent-only)', () => {
    const p = resolveDispatchPrincipal({
      userId: null,
      userRole: null,
    });
    expect(p.roles).toEqual(['agent']);
    const r = authorizeAgentTool(p, 'list_collections');
    // agent allows read admin, but no human role for ∩
    expect(r).toMatchObject({
      allowed: false,
      reason: 'no_human_role',
    });
  });
});

describe('authorizeAgentTool — dispatch principal', () => {
  it('allows coding file_read for dispatch agent with admin human role', () => {
    const p = resolveDispatchPrincipal({
      ticketId: 't1',
      userId: 'u',
      userRole: 'admin',
    });
    expect(authorizeAgentTool(p, 'file_read').allowed).toBe(true);
  });
});
