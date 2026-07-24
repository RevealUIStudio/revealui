/**
 * GAP-355 S6-3 — wrapToolWithGovernance soft-fail pre-authorize.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Tool } from '../../tools/base.js';
import { wrapToolWithGovernance } from '../../tools/governance.js';

function makeTool(execute: Tool['execute'], name = 'demo_tool'): Tool {
  return {
    name,
    description: 'demo',
    parameters: z.object({}),
    execute,
  };
}

describe('wrapToolWithGovernance', () => {
  it('does not execute when authorize denies; returns soft-fail ToolResult', async () => {
    const execute = vi.fn(async () => ({ success: true, data: {} }));
    const onDenied = vi.fn(async () => undefined);
    const tool = makeTool(execute);

    const wrapped = wrapToolWithGovernance(tool, {
      authorize: () => ({ allowed: false, reason: 'exec_requires_grant' }),
      onDenied,
    });

    const result = await wrapped.execute({});
    expect(result).toEqual({
      success: false,
      error: 'Permission denied (exec_requires_grant): demo_tool',
    });
    expect(execute).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledWith({
      toolName: 'demo_tool',
      reason: 'exec_requires_grant',
    });
  });

  it('executes when authorize allows', async () => {
    const execute = vi.fn(async () => ({ success: true, data: { ok: true } }));
    const tool = makeTool(execute);

    const wrapped = wrapToolWithGovernance(tool, {
      authorize: () => ({ allowed: true, reason: 'allowed' }),
    });

    const result = await wrapped.execute({});
    expect(result).toEqual({ success: true, data: { ok: true } });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('still soft-fails when onDenied throws', async () => {
    const execute = vi.fn(async () => ({ success: true }));
    const tool = makeTool(execute);

    const wrapped = wrapToolWithGovernance(tool, {
      authorize: () => ({ allowed: false, reason: 'unknown_tool' }),
      onDenied: async () => {
        throw new Error('audit failed');
      },
    });

    const result = await wrapped.execute({});
    expect(result.success).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});
