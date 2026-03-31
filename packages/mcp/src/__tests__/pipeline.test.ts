import { describe, expect, it, vi } from 'vitest';
import type { MCPHypervisor, MCPTenantContext } from '../hypervisor.js';
import { executePipeline } from '../pipeline.js';

// ---------------------------------------------------------------------------
// Mock hypervisor factory
// ---------------------------------------------------------------------------

function createMockHypervisor(
  handler?: (server: string, tenant: string, tool: string, params: unknown) => unknown,
) {
  return {
    callToolForTenant: vi.fn(
      async (serverName: string, tenantId: string, toolName: string, params: unknown) => {
        if (handler) return handler(serverName, tenantId, toolName, params);
        return { content: [{ type: 'text', text: '{}' }] };
      },
    ),
  } as unknown as MCPHypervisor;
}

const ctx: MCPTenantContext = {
  tenantId: 'tenant-123',
  tier: 'pro',
};

// ---------------------------------------------------------------------------
// Basic execution
// ---------------------------------------------------------------------------

describe('executePipeline', () => {
  it('executes a single step', async () => {
    const hv = createMockHypervisor(() => ({
      content: [{ type: 'text', text: JSON.stringify({ id: 'cus_1' }) }],
    }));

    const result = await executePipeline(hv, ctx, [
      { tool: '@@mcp_stripe_create_customer', params: { email: 'a@b.com' } },
    ]);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.data).toEqual({ id: 'cus_1' });
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('executes multiple sequential steps', async () => {
    let callCount = 0;
    const hv = createMockHypervisor(() => {
      callCount++;
      return {
        content: [{ type: 'text', text: JSON.stringify({ step: callCount }) }],
      };
    });

    const result = await executePipeline(hv, ctx, [
      { label: 'a', tool: '@@mcp_svc_tool_a', params: {} },
      { label: 'b', tool: '@@mcp_svc_tool_b', params: {} },
      { label: 'c', tool: '@@mcp_svc_tool_c', params: {} },
    ]);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]?.data).toEqual({ step: 1 });
    expect(result.steps[2]?.data).toEqual({ step: 3 });
  });

  it('returns empty result for empty pipeline', async () => {
    const hv = createMockHypervisor();
    const result = await executePipeline(hv, ctx, []);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(0);
  });

  it('assigns auto-labels when not specified', async () => {
    const hv = createMockHypervisor();
    const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_svc_tool', params: {} }]);

    expect(result.steps[0]?.label).toBe('step_0');
  });

  // -------------------------------------------------------------------------
  // Tool name parsing
  // -------------------------------------------------------------------------

  describe('tool name parsing', () => {
    it('parses server and tool from namespaced name', async () => {
      const hv = createMockHypervisor();
      await executePipeline(hv, ctx, [
        { tool: '@@mcp_stripe_create_payment_intent', params: { amount: 2000 } },
      ]);

      expect(hv.callToolForTenant).toHaveBeenCalledWith(
        'stripe',
        'tenant-123',
        'create_payment_intent',
        { amount: 2000 },
      );
    });

    it('fails on tool name without prefix', async () => {
      const hv = createMockHypervisor();
      const result = await executePipeline(hv, ctx, [{ tool: 'bad_tool_name', params: {} }]);

      expect(result.success).toBe(false);
      expect(result.steps[0]?.error).toMatch('must start with');
    });

    it('fails on tool name with prefix but no underscore separator', async () => {
      const hv = createMockHypervisor();
      const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_serveronly', params: {} }]);

      expect(result.success).toBe(false);
      expect(result.steps[0]?.error).toMatch('expected format');
    });
  });

  // -------------------------------------------------------------------------
  // $ref resolution
  // -------------------------------------------------------------------------

  describe('$ref resolution', () => {
    it('resolves simple $ref from previous step', async () => {
      const hv = createMockHypervisor((_, __, tool) => {
        if (tool === 'create_customer') {
          return { content: [{ type: 'text', text: JSON.stringify({ id: 'cus_42' }) }] };
        }
        return { content: [{ type: 'text', text: '{}' }] };
      });

      await executePipeline(hv, ctx, [
        { label: 'customer', tool: '@@mcp_stripe_create_customer', params: { email: 'a@b.com' } },
        {
          label: 'charge',
          tool: '@@mcp_stripe_create_charge',
          params: { customer: { $ref: 'customer.id' } },
        },
      ]);

      expect(hv.callToolForTenant).toHaveBeenLastCalledWith(
        'stripe',
        'tenant-123',
        'create_charge',
        { customer: 'cus_42' },
      );
    });

    it('resolves nested $ref paths', async () => {
      const hv = createMockHypervisor((_, __, tool) => {
        if (tool === 'get_org') {
          return {
            content: [
              { type: 'text', text: JSON.stringify({ data: { billing: { plan: 'pro' } } }) },
            ],
          };
        }
        return { content: [{ type: 'text', text: '{}' }] };
      });

      await executePipeline(hv, ctx, [
        { label: 'org', tool: '@@mcp_svc_get_org', params: {} },
        {
          tool: '@@mcp_svc_update_plan',
          params: { currentPlan: { $ref: 'org.data.billing.plan' } },
        },
      ]);

      expect(hv.callToolForTenant).toHaveBeenLastCalledWith('svc', 'tenant-123', 'update_plan', {
        currentPlan: 'pro',
      });
    });

    it('resolves $ref in nested objects', async () => {
      const hv = createMockHypervisor((_, __, tool) => {
        if (tool === 'step_a') {
          return { content: [{ type: 'text', text: JSON.stringify({ val: 99 }) }] };
        }
        return { content: [{ type: 'text', text: '{}' }] };
      });

      await executePipeline(hv, ctx, [
        { label: 'a', tool: '@@mcp_svc_step_a', params: {} },
        {
          tool: '@@mcp_svc_step_b',
          params: { nested: { deep: { $ref: 'a.val' } } },
        },
      ]);

      expect(hv.callToolForTenant).toHaveBeenLastCalledWith('svc', 'tenant-123', 'step_b', {
        nested: { deep: 99 },
      });
    });

    it('resolves $ref in arrays', async () => {
      const hv = createMockHypervisor((_, __, tool) => {
        if (tool === 'step_a') {
          return { content: [{ type: 'text', text: JSON.stringify({ id: 'x' }) }] };
        }
        return { content: [{ type: 'text', text: '{}' }] };
      });

      await executePipeline(hv, ctx, [
        { label: 'a', tool: '@@mcp_svc_step_a', params: {} },
        {
          tool: '@@mcp_svc_step_b',
          params: { ids: [{ $ref: 'a.id' }, 'static'] },
        },
      ]);

      expect(hv.callToolForTenant).toHaveBeenLastCalledWith('svc', 'tenant-123', 'step_b', {
        ids: ['x', 'static'],
      });
    });

    it('throws on $ref to nonexistent step', async () => {
      const hv = createMockHypervisor();
      await expect(
        executePipeline(hv, ctx, [
          {
            tool: '@@mcp_svc_tool',
            params: { val: { $ref: 'nonexistent.field' } },
          },
        ]),
      ).rejects.toThrow('not found');
    });

    it('throws on $ref traversing through null', async () => {
      const hv = createMockHypervisor(() => ({
        content: [{ type: 'text', text: JSON.stringify({ data: null }) }],
      }));

      await expect(
        executePipeline(hv, ctx, [
          { label: 'a', tool: '@@mcp_svc_step_a', params: {} },
          {
            tool: '@@mcp_svc_step_b',
            params: { val: { $ref: 'a.data.nested' } },
          },
        ]),
      ).rejects.toThrow('cannot traverse');
    });
  });

  // -------------------------------------------------------------------------
  // Conditional steps (when)
  // -------------------------------------------------------------------------

  describe('conditional steps', () => {
    it('skips step when condition returns false', async () => {
      const hv = createMockHypervisor();
      const result = await executePipeline(hv, ctx, [
        {
          label: 'skipped',
          tool: '@@mcp_svc_tool',
          params: {},
          when: () => false,
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.steps[0]?.data).toEqual({ skipped: true });
      expect(result.steps[0]?.durationMs).toBe(0);
      expect(hv.callToolForTenant).not.toHaveBeenCalled();
    });

    it('runs step when condition returns true', async () => {
      const hv = createMockHypervisor();
      const result = await executePipeline(hv, ctx, [
        {
          tool: '@@mcp_svc_tool',
          params: {},
          when: () => true,
        },
      ]);

      expect(result.success).toBe(true);
      expect(hv.callToolForTenant).toHaveBeenCalledOnce();
    });

    it('passes previous results to when function', async () => {
      const whenSpy = vi.fn(() => true);
      const hv = createMockHypervisor(() => ({
        content: [{ type: 'text', text: JSON.stringify({ status: 'ok' }) }],
      }));

      await executePipeline(hv, ctx, [
        { label: 'first', tool: '@@mcp_svc_step_a', params: {} },
        { label: 'second', tool: '@@mcp_svc_step_b', params: {}, when: whenSpy },
      ]);

      expect(whenSpy).toHaveBeenCalledOnce();
      const resultsMap = whenSpy.mock.calls[0]![0] as Map<string, unknown>;
      expect(resultsMap.get('first')).toEqual({ status: 'ok' });
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('fails pipeline on first error', async () => {
      const hv = createMockHypervisor((_, __, tool) => {
        if (tool === 'fail_tool') throw new Error('Service unavailable');
        return { content: [{ type: 'text', text: '{}' }] };
      });

      const result = await executePipeline(hv, ctx, [
        { label: 'ok', tool: '@@mcp_svc_ok_tool', params: {} },
        { label: 'fail', tool: '@@mcp_svc_fail_tool', params: {} },
        { label: 'never', tool: '@@mcp_svc_never_tool', params: {} },
      ]);

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(2); // third never runs
      expect(result.steps[0]?.success).toBe(true);
      expect(result.steps[1]?.success).toBe(false);
      expect(result.steps[1]?.error).toBe('Service unavailable');
    });

    it('captures non-Error throws as string', async () => {
      const hv = createMockHypervisor(() => {
        throw 'raw string error';
      });

      const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_svc_tool', params: {} }]);

      expect(result.success).toBe(false);
      expect(result.steps[0]?.error).toBe('raw string error');
    });
  });

  // -------------------------------------------------------------------------
  // Response extraction
  // -------------------------------------------------------------------------

  describe('response extraction', () => {
    it('parses JSON from text content block', async () => {
      const hv = createMockHypervisor(() => ({
        content: [{ type: 'text', text: '{"key":"value"}' }],
      }));

      const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_svc_tool', params: {} }]);

      expect(result.steps[0]?.data).toEqual({ key: 'value' });
    });

    it('returns raw text when JSON parsing fails', async () => {
      const hv = createMockHypervisor(() => ({
        content: [{ type: 'text', text: 'plain text response' }],
      }));

      const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_svc_tool', params: {} }]);

      expect(result.steps[0]?.data).toBe('plain text response');
    });

    it('returns raw response when no content array', async () => {
      const hv = createMockHypervisor(() => ({ result: 'direct' }));

      const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_svc_tool', params: {} }]);

      expect(result.steps[0]?.data).toEqual({ result: 'direct' });
    });

    it('returns raw response for non-text content types', async () => {
      const hv = createMockHypervisor(() => ({
        content: [{ type: 'image', data: 'base64...' }],
      }));

      const result = await executePipeline(hv, ctx, [{ tool: '@@mcp_svc_tool', params: {} }]);

      expect(result.steps[0]?.data).toEqual({
        content: [{ type: 'image', data: 'base64...' }],
      });
    });
  });
});
