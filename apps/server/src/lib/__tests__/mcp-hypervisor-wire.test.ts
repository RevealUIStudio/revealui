import { afterEach, describe, expect, it, vi } from 'vitest';

const setUsageMeterSink = vi.fn();
const setAuditSink = vi.fn();
const getInstance = vi.fn(() => ({
  setUsageMeterSink,
  setAuditSink,
}));

vi.mock('@revealui/mcp', () => ({
  MCPHypervisor: {
    getInstance,
  },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../metering.js', () => ({
  recordUsageMeter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../mcp-audit.js', () => ({
  recordMcpToolAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('mcp-hypervisor-wire', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.REVEALUI_MCP_HYPERVISOR;
  });

  it('is disabled by default', async () => {
    const { isMcpHypervisorWireEnabled, wireMcpHypervisorIfEnabled } = await import(
      '../mcp-hypervisor-wire.js'
    );
    expect(isMcpHypervisorWireEnabled({})).toBe(false);
    expect(wireMcpHypervisorIfEnabled({})).toBe(false);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('enables on REVEALUI_MCP_HYPERVISOR=1 and installs sinks', async () => {
    const { wireMcpHypervisorIfEnabled } = await import('../mcp-hypervisor-wire.js');
    expect(wireMcpHypervisorIfEnabled({ REVEALUI_MCP_HYPERVISOR: '1' })).toBe(true);
    expect(getInstance).toHaveBeenCalledOnce();
    expect(setUsageMeterSink).toHaveBeenCalledOnce();
    expect(setAuditSink).toHaveBeenCalledOnce();
  });

  it('maps tenant meter events to usage rows and skips without tenant', async () => {
    const { meterEventToUsageRow } = await import('../mcp-hypervisor-wire.js');
    const withTenant = meterEventToUsageRow({
      kind: 'mcp.tool.call',
      serverName: 'content',
      toolName: 'list',
      tenantId: 'acct_1',
      duration_ms: 12,
      success: true,
    });
    expect(withTenant).toMatchObject({
      accountId: 'acct_1',
      meterName: 'mcp.tool.call',
      source: 'agent',
      durationMs: 12,
      errored: false,
    });

    expect(
      meterEventToUsageRow({
        kind: 'mcp.tool.call',
        serverName: 'content',
        toolName: 'list',
        duration_ms: 3,
        success: false,
        error: 'boom',
      }),
    ).toBeNull();
  });
});
