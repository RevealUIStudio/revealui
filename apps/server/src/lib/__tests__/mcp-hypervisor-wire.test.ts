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

const memoryStore = new Map<string, string>();
const memoryVault = {
  async get(path: string) {
    return memoryStore.get(path);
  },
  async set(path: string, value: string) {
    memoryStore.set(path, value);
  },
  async delete(path: string) {
    memoryStore.delete(path);
  },
  async list(prefix: string) {
    return [...memoryStore.keys()].filter((k) => k.startsWith(prefix));
  },
};

vi.mock('@revealui/mcp', () => ({
  MCPHypervisor: {
    getInstance,
  },
  createRevvaultVault: () => memoryVault,
  createMemoryVault: () => memoryVault,
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
    memoryStore.clear();
  });

  it('is disabled by default', async () => {
    const { isMcpHypervisorWireEnabled, wireMcpHypervisorIfEnabled } = await import(
      '../mcp-hypervisor-wire.js'
    );
    expect(isMcpHypervisorWireEnabled({})).toBe(false);
    expect(await wireMcpHypervisorIfEnabled({})).toBe(false);
    expect(getInstance).not.toHaveBeenCalled();
  });

  it('enables on REVEALUI_MCP_HYPERVISOR=1 and installs sinks + vault resolver', async () => {
    const { wireMcpHypervisorIfEnabled } = await import('../mcp-hypervisor-wire.js');
    expect(await wireMcpHypervisorIfEnabled({ REVEALUI_MCP_HYPERVISOR: '1' })).toBe(true);
    expect(getInstance).toHaveBeenCalledOnce();
    expect(setUsageMeterSink).toHaveBeenCalledOnce();
    expect(setAuditSink).toHaveBeenCalledOnce();
    expect(setCredentialResolver).toHaveBeenCalledOnce();
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
    // Repo-only tsx server: not in compiled revealui-mcp CLI (cli.ts header).
    expect(
      parseSpawnServerList({ REVEALUI_MCP_HYPERVISOR_SERVERS: 'code-validator,contracts' }),
    ).toEqual(['contracts']);
  });

  it('SPAWN_ALLOWLIST matches compiled revealui-mcp CLI server names', async () => {
    const { SPAWN_ALLOWLIST } = await import('../mcp-hypervisor-wire.js');
    expect([...SPAWN_ALLOWLIST].sort()).toEqual(
      [
        'contracts',
        'docs',
        'neon',
        'next-devtools',
        'playwright',
        'revealui-content',
        'revealui-email',
        'revealui-memory',
        'revealui-stripe',
        'stripe',
        'vercel',
      ].sort(),
    );
    expect(SPAWN_ALLOWLIST.has('code-validator')).toBe(false);
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

  it('vault credential resolver returns env map from mcp/tenant/server/env', async () => {
    const { createVaultCredentialResolver, mcpTenantEnvVaultPath } = await import(
      '../mcp-hypervisor-wire.js'
    );
    const path = mcpTenantEnvVaultPath('tenant1', 'neon');
    await memoryVault.set(path, JSON.stringify({ NEON_API_KEY: 'nk_test' }));

    const resolver = createVaultCredentialResolver({ vault: memoryVault });
    await expect(resolver.resolve('tenant1', 'neon')).resolves.toEqual({
      NEON_API_KEY: 'nk_test',
    });
    await expect(resolver.resolve('tenant1', 'missing-server')).resolves.toBeNull();
    await expect(resolver.resolve('bad/id', 'neon')).resolves.toBeNull();
  });

  it('parseTenantEnvBlob rejects non-string values', async () => {
    const { parseTenantEnvBlob } = await import('../mcp-hypervisor-wire.js');
    expect(parseTenantEnvBlob('{"A":"ok"}')).toEqual({ A: 'ok' });
    expect(parseTenantEnvBlob('{"A":1}')).toBeNull();
    expect(parseTenantEnvBlob('[]')).toBeNull();
    expect(parseTenantEnvBlob('not-json')).toBeNull();
  });
});
