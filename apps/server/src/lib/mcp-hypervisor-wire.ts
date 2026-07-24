/**
 * GAP-406 WIRE — opt-in MCPHypervisor wiring on apps/server.
 *
 * Phase 1 (`REVEALUI_MCP_HYPERVISOR=1`):
 *   Install usage-meter + integrity-audit sinks on the process singleton.
 *   Install vault-backed credential resolver (phase 3).
 *
 * Phase 2 (`REVEALUI_MCP_HYPERVISOR_SPAWN=1` in addition):
 *   Register + start process-local first-party MCP servers via `revealui-mcp`.
 *   Default server list is public introspection only (`contracts,docs`) unless
 *   `REVEALUI_MCP_HYPERVISOR_SERVERS` overrides (comma-separated allowlist).
 *   Process-local children inherit `process.env` for host credentials.
 *
 * Phase 3 (with phase 1):
 *   Credential resolver reads `mcp/<tenantId>/<serverName>/env` (JSON object of
 *   env vars) from a Vault (default revvault). Missing path → null (no tenant
 *   env). Tenant spawn still merges process.env in the hypervisor today;
 *   isolation tightening is a follow-up.
 *
 * Default (env unset): no-op. Safe for local/dev/serverless without hypervisor traffic.
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see GAP-406
 */

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { logger } from '@revealui/core/observability/logger';
import type {
  MCPCredentialResolver,
  MCPServerConfig,
  McpAuditEvent,
  McpMeterEvent,
  Vault,
} from '@revealui/mcp';
import { createRevvaultVault, MCPHypervisor } from '@revealui/mcp';
import { recordMcpToolAudit } from './mcp-audit.js';
import { recordUsageMeter } from './metering.js';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

/** Safe tenant/server path segment (matches MCP remote-client SAFE_ID_RE). */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Servers safe to auto-spawn without product tenant credentials. */
export const DEFAULT_SPAWN_SERVERS = ['contracts', 'docs'] as const;

/** Full first-party allowlist for REVEALUI_MCP_HYPERVISOR_SERVERS. */
export const SPAWN_ALLOWLIST = new Set([
  'contracts',
  'docs',
  'revealui-content',
  'revealui-email',
  'revealui-memory',
  'revealui-stripe',
  'neon',
  'stripe',
  'vercel',
  'playwright',
  'next-devtools',
]);

const require = createRequire(import.meta.url);

export function isMcpHypervisorWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_MCP_HYPERVISOR?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

export function isMcpHypervisorSpawnEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isMcpHypervisorWireEnabled(env)) return false;
  const raw = env.REVEALUI_MCP_HYPERVISOR_SPAWN?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
}

/**
 * Parse spawn server names from env. Unknown names are dropped with a warn.
 */
export function parseSpawnServerList(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.REVEALUI_MCP_HYPERVISOR_SERVERS?.trim();
  const names = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [...DEFAULT_SPAWN_SERVERS];

  const out: string[] = [];
  for (const name of names) {
    if (!SPAWN_ALLOWLIST.has(name)) {
      logger.warn('[mcp-hypervisor-wire] skipping unknown spawn server', { name });
      continue;
    }
    out.push(name);
  }
  return out;
}

/**
 * Resolve the compiled revealui-mcp CLI entry for process.execPath spawn.
 */
export function resolveMcpCliPath(): string {
  return require.resolve('@revealui/mcp/dist/cli.js');
}

export function buildServerConfig(serverName: string, cliPath: string): MCPServerConfig {
  return {
    name: serverName,
    command: process.execPath,
    args: [cliPath, serverName],
  };
}

/**
 * Map a hypervisor meter event into a `usage_meters` row.
 * Skips when no tenantId (no account fk) — process-local calls stay unmetered.
 */
export function meterEventToUsageRow(
  event: McpMeterEvent,
): Parameters<typeof recordUsageMeter>[0] | null {
  const accountId = event.tenantId?.trim();
  if (!accountId) {
    return null;
  }
  const id = randomUUID();
  return {
    id,
    accountId,
    meterName: event.kind,
    quantity: 1,
    periodStart: new Date(),
    periodEnd: null,
    source: 'agent',
    idempotencyKey: `hv:${event.serverName}:${event.toolName}:${id}`,
    durationMs: event.duration_ms,
    errored: !event.success,
  };
}

function installMeterSink(hv: MCPHypervisor): void {
  hv.setUsageMeterSink(async (event: McpMeterEvent) => {
    const row = meterEventToUsageRow(event);
    if (!row) {
      logger.debug('[mcp-hypervisor-wire] skip meter (no tenantId)', {
        serverName: event.serverName,
        toolName: event.toolName,
      });
      return;
    }
    try {
      await recordUsageMeter(row);
    } catch (error) {
      logger.warn('[mcp-hypervisor-wire] usage meter write failed', {
        error: error instanceof Error ? error.message : String(error),
        serverName: event.serverName,
        toolName: event.toolName,
      });
    }
  });
}

function installAuditSink(hv: MCPHypervisor): void {
  hv.setAuditSink(async (event: McpAuditEvent) => {
    const accountId = event.tenantId?.trim() || null;
    const userId = accountId ?? 'system:hypervisor';
    await recordMcpToolAudit({
      outcome: event.success ? 'invoked' : 'failed',
      clientName: 'mcp-hypervisor',
      userId,
      accountId,
      tool: `${event.serverName}/${event.toolName}`,
      argsDigest: event.argsDigest ?? '',
      scalars: {
        serverName: event.serverName,
        toolName: event.toolName,
      },
      durationMs: event.duration_ms,
      reason: event.error,
    });
  });
}

/**
 * Canonical revvault path for process-env credentials for a tenant MCP server.
 * Value must be a JSON object of string env keys → string values.
 */
export function mcpTenantEnvVaultPath(tenantId: string, serverName: string): string {
  return `mcp/${tenantId}/${serverName}/env`;
}

/**
 * Parse vault blob into env map. Rejects non-objects and non-string values.
 */
export function parseTenantEnvBlob(raw: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    if (typeof value !== 'string') {
      return null;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Tenant credential resolver stub (phase 2 / tests).
 * Always returns null (no tenant env). Prefer {@link createVaultCredentialResolver}.
 */
export function createStubCredentialResolver(): MCPCredentialResolver {
  return {
    async resolve(tenantId: string, serverName: string): Promise<Record<string, string> | null> {
      logger.debug('[mcp-hypervisor-wire] credential resolver stub (null)', {
        tenantId,
        serverName,
      });
      return null;
    },
  };
}

export interface VaultCredentialResolverOptions {
  /** Injected vault (tests use memory vault). Default: revvault CLI vault. */
  vault?: Vault;
}

/**
 * Vault-backed credential resolver (GAP-406 phase 3).
 *
 * Reads `mcp/<tenantId>/<serverName>/env` as JSON `Record<string, string>`.
 * Returns null when path missing, ids unsafe, server not allowlisted, blob
 * invalid, or vault errors (logged).
 */
export function createVaultCredentialResolver(
  options: VaultCredentialResolverOptions = {},
): MCPCredentialResolver {
  const vault = options.vault ?? createRevvaultVault();

  return {
    async resolve(tenantId: string, serverName: string): Promise<Record<string, string> | null> {
      if (!(SAFE_ID_RE.test(tenantId) && SAFE_ID_RE.test(serverName))) {
        logger.warn('[mcp-hypervisor-wire] reject unsafe tenant/server id for vault resolve', {
          tenantId,
          serverName,
        });
        return null;
      }
      if (!SPAWN_ALLOWLIST.has(serverName)) {
        logger.debug('[mcp-hypervisor-wire] server not on spawn allowlist; no vault env', {
          serverName,
        });
        return null;
      }

      const path = mcpTenantEnvVaultPath(tenantId, serverName);
      let raw: string | undefined;
      try {
        raw = await vault.get(path);
      } catch (error) {
        logger.warn('[mcp-hypervisor-wire] vault get failed for tenant env', {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }

      if (raw === undefined || raw.trim() === '') {
        logger.debug('[mcp-hypervisor-wire] no vault env for tenant server', { path });
        return null;
      }

      const envMap = parseTenantEnvBlob(raw);
      if (!envMap) {
        logger.warn('[mcp-hypervisor-wire] invalid vault env JSON (expect object of strings)', {
          path,
        });
        return null;
      }

      return envMap;
    },
  };
}

async function registerAndStartServers(hv: MCPHypervisor, env: NodeJS.ProcessEnv): Promise<void> {
  const servers = parseSpawnServerList(env);
  if (servers.length === 0) {
    logger.warn('[mcp-hypervisor-wire] spawn enabled but server list empty');
    return;
  }

  let cliPath: string;
  try {
    cliPath = resolveMcpCliPath();
  } catch (error) {
    logger.error(
      '[mcp-hypervisor-wire] cannot resolve @revealui/mcp CLI; skip spawn',
      error instanceof Error ? error : new Error(String(error)),
    );
    return;
  }

  for (const name of servers) {
    const config = buildServerConfig(name, cliPath);
    hv.registerServer(config);
    try {
      await hv.startServer(name);
      logger.info('[mcp-hypervisor-wire] started process-local MCP server', { name });
    } catch (error) {
      logger.warn('[mcp-hypervisor-wire] failed to start MCP server', {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Wire sinks, vault credential resolver, and optional spawn when enabled.
 * Returns true when phase-1 wiring ran.
 */
export async function wireMcpHypervisorIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
  options: VaultCredentialResolverOptions = {},
): Promise<boolean> {
  if (!isMcpHypervisorWireEnabled(env)) {
    return false;
  }

  const hv = MCPHypervisor.getInstance();
  installMeterSink(hv);
  installAuditSink(hv);
  hv.setCredentialResolver(createVaultCredentialResolver(options));

  logger.info(
    '[mcp-hypervisor-wire] GAP-406 phase 1+3: meter + audit sinks + vault credential resolver',
  );

  if (isMcpHypervisorSpawnEnabled(env)) {
    await registerAndStartServers(hv, env);
    logger.info('[mcp-hypervisor-wire] GAP-406 phase 2: process-local spawn attempted');
  } else {
    logger.info('[mcp-hypervisor-wire] spawn off (set REVEALUI_MCP_HYPERVISOR_SPAWN=1 to enable)');
  }

  return true;
}
