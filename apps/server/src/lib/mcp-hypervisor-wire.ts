/**
 * GAP-406 WIRE — opt-in MCPHypervisor wiring on apps/server.
 *
 * Phase 1 (`REVEALUI_MCP_HYPERVISOR=1`):
 *   Install usage-meter + integrity-audit sinks on the process singleton.
 *
 * Phase 2 (`REVEALUI_MCP_HYPERVISOR_SPAWN=1` in addition):
 *   Register + start process-local first-party MCP servers via `revealui-mcp`.
 *   Default server list is public introspection only (`contracts,docs`) unless
 *   `REVEALUI_MCP_HYPERVISOR_SERVERS` overrides (comma-separated allowlist).
 *   Credential resolver is a stub that returns null (tenant spawn still blocked);
 *   process-local children inherit `process.env` for any credentials they need.
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
} from '@revealui/mcp';
import { MCPHypervisor } from '@revealui/mcp';
import { recordMcpToolAudit } from './mcp-audit.js';
import { recordUsageMeter } from './metering.js';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

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
 * Tenant credential resolver stub (phase 2).
 * Returns null so startServerForTenant fails closed until a real vault-backed
 * resolver lands. Process-local startServer still inherits process.env.
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

  hv.setCredentialResolver(createStubCredentialResolver());

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
 * Wire sinks (and optional spawn) when enabled.
 * Returns true when phase-1 wiring ran.
 */
export async function wireMcpHypervisorIfEnabled(
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (!isMcpHypervisorWireEnabled(env)) {
    return false;
  }

  const hv = MCPHypervisor.getInstance();
  installMeterSink(hv);
  installAuditSink(hv);

  logger.info('[mcp-hypervisor-wire] GAP-406 phase 1: meter + audit sinks installed');

  if (isMcpHypervisorSpawnEnabled(env)) {
    await registerAndStartServers(hv, env);
    logger.info('[mcp-hypervisor-wire] GAP-406 phase 2: process-local spawn attempted');
  } else {
    logger.info('[mcp-hypervisor-wire] spawn off (set REVEALUI_MCP_HYPERVISOR_SPAWN=1 to enable)');
  }

  return true;
}
