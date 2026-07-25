/**
 * GAP-355 S5-4 — wrapToolWithIntegrityAudit fail-closed contract.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Tool } from '../../tools/base.js';
import {
  maybeWrapToolsWithIntegrityAudit,
  wrapToolWithIntegrityAudit,
} from '../../tools/integrity-audit.js';

function makeTool(execute: Tool['execute'], name = 'demo_tool'): Tool {
  return {
    name,
    description: 'demo',
    parameters: z.object({}),
    execute,
  };
}

describe('wrapToolWithIntegrityAudit', () => {
  it('awaits audit after a successful execute', async () => {
    const order: string[] = [];
    const tool = makeTool(async () => {
      order.push('exec');
      return { success: true, data: { ok: true } };
    });

    const wrapped = wrapToolWithIntegrityAudit(tool, async (e) => {
      order.push('audit');
      expect(e).toMatchObject({ toolName: 'demo_tool', success: true });
    });

    const result = await wrapped.execute({});
    expect(result.success).toBe(true);
    expect(order).toEqual(['exec', 'audit']);
  });

  it('fails closed when audit throws after success', async () => {
    const tool = makeTool(async () => ({ success: true, data: {} }));
    const wrapped = wrapToolWithIntegrityAudit(tool, async () => {
      throw new Error('audit write failed');
    });

    await expect(wrapped.execute({})).rejects.toThrow(/audit write failed/);
  });

  it('returns tool failure when audit throws on an already-failed call', async () => {
    const tool = makeTool(async () => ({ success: false, error: 'nope' }));
    const wrapped = wrapToolWithIntegrityAudit(tool, async () => {
      throw new Error('audit write failed');
    });

    await expect(wrapped.execute({})).resolves.toEqual({
      success: false,
      error: 'nope',
    });
  });

  it('maybeWrapToolsWithIntegrityAudit is a no-op without a handler', () => {
    const tool = makeTool(async () => ({ success: true }));
    const out = maybeWrapToolsWithIntegrityAudit([tool], undefined);
    expect(out[0]).toBe(tool);
  });

  it('maybeWrapToolsWithIntegrityAudit wraps when handler present', async () => {
    const onToolAudit = vi.fn(async () => undefined);
    const tool = makeTool(async () => ({ success: true }));
    const [wrapped] = maybeWrapToolsWithIntegrityAudit([tool], onToolAudit);
    await wrapped?.execute({});
    expect(onToolAudit).toHaveBeenCalledOnce();
  });
});
