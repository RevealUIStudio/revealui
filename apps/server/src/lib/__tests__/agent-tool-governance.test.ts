/**
 * GAP-355 S6-3 — applyAgentToolGovernance soft-fail + deny audit.
 * authorizeAgentTool is mocked so this suite does not need a full core build.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStreamPrincipal } from '../agent-principal.js';
import { applyAgentToolGovernance, type GovernableTool } from '../agent-tool-governance.js';
import { configureAgentLowTrustMode } from '../low-trust-mode.js';

const mockAppend = vi.fn().mockResolvedValue(undefined);
const mockAuthorize = vi.fn();

vi.mock('../audit-signer.js', () => ({
  createAuditStore: () => ({
    append: mockAppend,
  }),
}));

vi.mock('@revealui/db', () => ({
  getClient: () => ({}),
}));

vi.mock('@revealui/core/security', () => ({
  classifyAuditWriteFailure: () => 'unknown',
  recordAuditWriteResult: vi.fn(),
  AuthorizationSystem: class {
    registerRole() {}
    hasPermission() {
      return false;
    }
  },
}));

vi.mock('../agent-tool-access.js', () => ({
  authorizeAgentTool: (...args: unknown[]) => mockAuthorize(...args),
  agentExecPermissionKey: (name: string) => `agent:exec:${name}`,
  agentAdminPiiPermissionKey: (name: string) => `agent:admin-pii:${name}`,
  agentToolPermissionKey: (name: string) => `agent:tool:${name}`,
}));

function makeTool(name: string, execute: GovernableTool['execute']): GovernableTool {
  return {
    name,
    execute,
  };
}

describe('applyAgentToolGovernance', () => {
  beforeEach(() => {
    mockAppend.mockClear();
    mockAuthorize.mockReset();
  });

  it('denies when authorize returns false and records agent:tool:denied', async () => {
    mockAuthorize.mockReturnValue({
      allowed: false,
      reason: 'exec_requires_grant',
      permissionKey: 'agent:tool:shell_exec',
      class: 'exec',
      surface: 'coding',
    });
    const execute = vi.fn(async () => ({ success: true }));
    const principal = resolveStreamPrincipal({
      mode: 'coding',
      userId: 'user-1',
      userRole: 'owner',
    });
    const [wrapped] = applyAgentToolGovernance([makeTool('shell_exec', execute)], {
      principal,
      namespace: 'coding',
      sessionId: 'sess-1',
      accountId: 'acct-1',
      userId: 'user-1',
      taskId: 'task-1',
    });

    const result = (await wrapped?.execute({})) as { success: boolean; error?: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exec_requires_grant/);
    expect(execute).not.toHaveBeenCalled();
    expect(mockAppend).toHaveBeenCalledOnce();
    const row = mockAppend.mock.calls[0]?.[0] as {
      eventType: string;
      payload: Record<string, unknown>;
    };
    expect(row.eventType).toBe('agent:tool:denied');
    expect(row.payload.reason).toBe('exec_requires_grant');
    expect(row.payload.tool).toBe('shell_exec');
  });

  it('allows and executes when authorize returns true', async () => {
    mockAuthorize.mockReturnValue({
      allowed: true,
      reason: 'allowed',
      permissionKey: 'agent:tool:file_read',
      class: 'read',
      surface: 'coding',
    });
    const execute = vi.fn(async () => ({ success: true, data: 'ok' }));
    const principal = resolveStreamPrincipal({
      mode: 'coding',
      userId: 'user-1',
      userRole: 'owner',
    });
    const [wrapped] = applyAgentToolGovernance([makeTool('file_read', execute)], {
      principal,
      namespace: 'coding',
      userId: 'user-1',
    });

    const result = await wrapped?.execute({});
    expect(result).toEqual({ success: true, data: 'ok' });
    expect(execute).toHaveBeenCalledOnce();
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it('fails closed when the grant-allow audit cannot be written', async () => {
    mockAuthorize.mockReturnValue({
      allowed: true,
      reason: 'explicit_grant',
      permissionKey: 'agent:tool:shell_exec',
      class: 'exec',
      surface: 'coding',
    });
    mockAppend.mockRejectedValueOnce(new Error('audit down'));
    const execute = vi.fn(async () => ({ success: true }));
    const principal = resolveStreamPrincipal({
      mode: 'coding',
      userId: 'user-1',
      userRole: 'owner',
      grants: [{ resource: 'agent:exec:shell_exec', action: 'execute' }],
    });
    const [wrapped] = applyAgentToolGovernance([makeTool('shell_exec', execute)], {
      principal,
      namespace: 'coding',
    });

    await expect(wrapped?.execute({})).rejects.toThrow('audit down');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('applyAgentToolGovernance — low_trust scope and output', () => {
  const trust = {
    preset: 'low_trust_review' as const,
    scope: { kind: 'ticket' as const, id: 'tkt-1', accountId: 'acct-1' },
    sources: ['task' as const],
  };

  function principal() {
    return resolveStreamPrincipal({
      mode: 'admin',
      userId: 'user-1',
      userRole: 'owner',
      accountId: 'acct-1',
      trust,
    });
  }

  function allow() {
    mockAuthorize.mockReturnValue({
      allowed: true,
      reason: 'allowed',
      permissionKey: 'agent:tool:add_ticket_comment',
      class: 'mutate',
      surface: 'admin',
    });
  }

  beforeEach(() => {
    mockAppend.mockReset();
    mockAppend.mockResolvedValue(undefined);
    mockAuthorize.mockReset();
    configureAgentLowTrustMode('enforce');
  });

  afterEach(() => {
    configureAgentLowTrustMode(null);
  });

  it('allows add_ticket_comment when the loaded ticket matches the scope', async () => {
    allow();
    const execute = vi.fn(async () => ({ success: true }));
    const load = vi.fn(async () => ({ accountId: 'acct-1' }));
    const [wrapped] = applyAgentToolGovernance([makeTool('add_ticket_comment', execute)], {
      principal: principal(),
      namespace: 'ticket-dispatch',
      ownership: { load },
    });

    const result = await wrapped?.execute({ text: 'scoped note' });
    expect(result).toEqual({ success: true });
    expect(execute).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith('ticket', 'tkt-1');
  });

  it('denies a different ticket id', async () => {
    allow();
    const execute = vi.fn(async () => ({ success: true }));
    const [wrapped] = applyAgentToolGovernance([makeTool('add_ticket_comment', execute)], {
      principal: principal(),
      namespace: 'ticket-dispatch',
      ownership: { load: async () => ({ accountId: 'acct-1' }) },
    });

    const result = (await wrapped?.execute({ ticketId: 'other' })) as {
      success: boolean;
      error?: string;
    };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/low_trust_out_of_scope/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('denies a tool with no scope extractor', async () => {
    allow();
    const execute = vi.fn(async () => ({ success: true }));
    const [wrapped] = applyAgentToolGovernance([makeTool('list_collections', execute)], {
      principal: principal(),
      namespace: 'admin-cms',
      ownership: { load: async () => ({ accountId: 'acct-1' }) },
    });

    const result = (await wrapped?.execute({})) as { error?: string };
    expect(result.error).toMatch(/low_trust_out_of_scope/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('denies when ownership does not match or the loader is missing', async () => {
    allow();
    const execute = vi.fn(async () => ({ success: true }));
    const mismatched = applyAgentToolGovernance([makeTool('add_ticket_comment', execute)], {
      principal: principal(),
      namespace: 'ticket-dispatch',
      ownership: { load: async () => ({ accountId: 'other' }) },
    });
    const missing = applyAgentToolGovernance([makeTool('add_ticket_comment', execute)], {
      principal: principal(),
      namespace: 'ticket-dispatch',
    });

    const first = (await mismatched[0]?.execute({})) as { error?: string };
    const second = (await missing[0]?.execute({})) as { error?: string };
    expect(first.error).toMatch(/low_trust_out_of_scope/);
    expect(second.error).toMatch(/low_trust_out_of_scope/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses output over the 8192 byte cap and audits output_capped', async () => {
    allow();
    const execute = vi.fn(async () => ({ success: true }));
    const [wrapped] = applyAgentToolGovernance([makeTool('add_ticket_comment', execute)], {
      principal: principal(),
      namespace: 'ticket-dispatch',
      ownership: { load: async () => ({ accountId: 'acct-1' }) },
    });

    const result = (await wrapped?.execute({ text: 'x'.repeat(8193) })) as { error?: string };
    expect(result.error).toMatch(/low_trust_output_too_large/);
    expect(execute).not.toHaveBeenCalled();
    const row = mockAppend.mock.calls.at(-1)?.[0] as { eventType: string };
    expect(row.eventType).toBe('agent:trust:output_capped');
  });

  it('logs would_deny in shadow and still runs the tool', async () => {
    configureAgentLowTrustMode('shadow');
    allow();
    const execute = vi.fn(async () => ({ success: true, data: 'kept' }));
    const [wrapped] = applyAgentToolGovernance([makeTool('add_ticket_comment', execute)], {
      principal: principal(),
      namespace: 'ticket-dispatch',
      ownership: { load: async () => null },
    });

    const result = await wrapped?.execute({});
    expect(result).toEqual({ success: true, data: 'kept' });
    const types = mockAppend.mock.calls.map((call) => (call[0] as { eventType: string }).eventType);
    expect(types).toContain('agent:trust:would_deny');
  });
});
