/**
 * GAP-355 S6-3 — applyAgentToolGovernance soft-fail + deny audit.
 * authorizeAgentTool is mocked so this suite does not need a full core build.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStreamPrincipal } from '../agent-principal.js';
import { applyAgentToolGovernance, type GovernableTool } from '../agent-tool-governance.js';

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
});
