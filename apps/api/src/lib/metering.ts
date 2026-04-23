/**
 * Usage-meter writer for apps/api. Persists `usage_meters` rows produced
 * by `@revealui/ai/createUsageMeterSink` (agent-adapter boundary) and
 * `@revealui/mcp.MCPHypervisor.setUsageMeterSink()` (hypervisor boundary).
 *
 * Design note. `@revealui/db` stays schema-only by convention — no
 * `writers/` surface. The single concrete insert lives here so agent-side
 * code has one import target and a uniform place to grow retention,
 * dedup, or alerting logic once the first usage data lands.
 *
 * Per A.1 of the post-v1 MCP arc; see
 * `.jv/docs/admin-mcp-integration-scope.md` §1.A.1 Q3 for the rationale.
 */

import type { McpUsageMeterRow } from '@revealui/ai';
import { getClient } from '@revealui/db';
import { usageMeters } from '@revealui/db/schema';

/**
 * Persist a single `usage_meters` row. Idempotent via the unique index on
 * `idempotency_key` — retries of the same semantic call collapse to a
 * single row when the caller supplies a stable key. The default generator
 * in `createUsageMeterSink` uses a fresh UUID per event (no coalescence);
 * override with a deterministic key whenever retry dedup matters.
 *
 * Write failures propagate; both `createUsageMeterSink` and
 * `MCPHypervisor.setUsageMeterSink` wrap their writer in safe-dispatch so
 * a thrown error is logged at warn but never breaks the underlying MCP
 * protocol call.
 */
export async function recordUsageMeter(row: McpUsageMeterRow): Promise<void> {
  const db = getClient();
  await db.insert(usageMeters).values(row).onConflictDoNothing();
}
