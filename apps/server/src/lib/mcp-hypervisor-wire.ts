/**
 * GAP-406 WIRE phase 1 — opt-in MCPHypervisor sink wiring on apps/server.
 *
 * When `REVEALUI_MCP_HYPERVISOR=1`, installs usage-meter + integrity-audit sinks
 * on the process singleton. Does **not** spawn MCP server children and does
 * **not** register a credential resolver (those need product design for
 * multi-tenant spawn — later phases of GAP-406).
 *
 * Default (env unset/false): no-op. Safe for local/dev/serverless without
 * hypervisor traffic.
 *
 * @see docs/architecture/ADR-007-c11-unwired-subsystem-incubate.md
 * @see .jv/docs/gaps/GAP-406.yml
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import type { McpAuditEvent, McpMeterEvent } from '@revealui/mcp';
import { MCPHypervisor } from '@revealui/mcp';
import { recordMcpToolAudit } from './mcp-audit.js';
import { recordUsageMeter } from './metering.js';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isMcpHypervisorWireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.REVEALUI_MCP_HYPERVISOR?.trim().toLowerCase();
  return raw !== undefined && ENABLED_VALUES.has(raw);
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
 * Wire sinks when enabled. Idempotent enough for double-call (re-sets sinks).
 * Returns true when wiring ran.
 */
export function wireMcpHypervisorIfEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isMcpHypervisorWireEnabled(env)) {
    return false;
  }

  const hv = MCPHypervisor.getInstance();
  installMeterSink(hv);
  installAuditSink(hv);

  logger.info(
    '[mcp-hypervisor-wire] GAP-406 phase 1: meter + audit sinks installed (no auto-spawn)',
  );
  return true;
}
