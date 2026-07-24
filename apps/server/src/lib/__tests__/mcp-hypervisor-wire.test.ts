import { afterEach, describe, expect, it, vi } from 'vitest';

const setUsageMeterSink = vi.fn();
const setAuditSink = vi.fn();
const registerServer = vi.fn();
const startServer = vi.fn().mockResolvedValue(undefined);
const setCredentialResolver = vi.fn();
const getInstance = vi.fn(() => ({
  setUsageMeterSink,
  setAuditSink,
  registerServer,
  startServer,
  setCredentialResolver,
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

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:module')>();
  return {
    ...actual,
    createRequire: () => {
      const req = ((id: string) => {
        throw new Error(`unexpected require ${id}`);
      }) as NodeRequire;
      req.resolve = (id: string) => {
        if (id.includes('@revealui/mcp')) return '/fake/mcp/dist/cli.js';
        throw new Error(`unexpected resolve ${id}`);
      };
      req.cache = {};
      req.extensions = {};
      req.main = undefined;
      return req;
    },
  };
});

describe('mcp-hypervisor-wire', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('is disabled by default', async () => {
    const { isMcpHypervisorWireEnabled, wireMcpHypervisorIfEnabled } = await import(
      '../mcp-hypervisor-wire.js'
    );
    expect(isMcpHypervisorWireEnabled({})).toBe(false);
    expect(await wireMcpHypervisorIfEnabled({})).toBe(false);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('enables on REVEALUI_MCP_HYPERVISOR=1 and installs sinks without spawn', async () => {
    const { wireMcpHypervisorIfEnabled } = await import('../mcp-hypervisor-wire.js');
    expect(await wireMcpHypervisorIfEnabled({ REVEALUI_MCP_HYPERVISOR: '1' })).toBe(true);
    expect(getInstance).toHaveBeenCalledOnce();
    expect(setUsageMeterSink).toHaveBeenCalledOnce();
    expect(setAuditSink).toHaveBeenCalledOnce();
    expect(registerServer).not.toHaveBeenCalled();
    expect(startServer).not.toHaveBeenCalled();
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

  it('parseSpawnServerList defaults to contracts,docs and filters unknown', async () => {
    const { parseSpawnServerList, DEFAULT_SPAWN_SERVERS } = await import(
      '../mcp-hypervisor-wire.js'
    );
    expect(parseSpawnServerList({})).toEqual([...DEFAULT_SPAWN_SERVERS]);
    expect(
      parseSpawnServerList({ REVEALUI_MCP_HYPERVISOR_SERVERS: 'contracts,nope,docs' }),
    ).toEqual(['contracts', 'docs']);
  });

  it('spawn path registers and starts allowlisted servers', async () => {
    const { wireMcpHypervisorIfEnabled, buildServerConfig } = await import(
      '../mcp-hypervisor-wire.js'
    );

    expect(buildServerConfig('contracts', '/fake/cli.js')).toMatchObject({
      name: 'contracts',
      command: process.execPath,
      args: ['/fake/cli.js', 'contracts'],
    });

    expect(
      await wireMcpHypervisorIfEnabled({
        REVEALUI_MCP_HYPERVISOR: '1',
        REVEALUI_MCP_HYPERVISOR_SPAWN: '1',
        REVEALUI_MCP_HYPERVISOR_SERVERS: 'contracts',
      }),
    ).toBe(true);

    expect(setCredentialResolver).toHaveBeenCalledOnce();
    expect(registerServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'contracts',
        command: process.execPath,
        args: ['/fake/mcp/dist/cli.js', 'contracts'],
      }),
    );
    expect(startServer).toHaveBeenCalledWith('contracts');
  });
});
