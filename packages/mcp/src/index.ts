/**
 * @revealui/mcp
 *
 * Model Context Protocol integrations for RevealUI.
 *
 * Provides:
 * - MCP adapter framework (Vercel, Stripe, Neon)
 * - Database adapter (PGlite / PostgreSQL) with CRDT support
 * - MCP contracts (Zod schemas for request/response/tool bridging)
 * - MCP server launchers (code-validator, stripe, neon, etc.)
 *
 * @packageDocumentation
 */

import { isFeatureEnabled } from '@revealui/core/features'
import { initializeLicense } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'

/**
 * Check if the MCP package is licensed for use.
 * Initializes the license cache from environment variables, then checks the tier.
 * Returns false with a warning log if no Pro/Enterprise license is active.
 */
export async function checkMcpLicense(): Promise<boolean> {
  await initializeLicense()
  if (!isFeatureEnabled('mcp')) {
    logger.warn(
      '[@revealui/mcp] MCP server integration requires a Pro or Enterprise license. ' +
        'Visit https://revealui.com/pricing for details.',
    )
    return false
  }
  return true
}

// Database adapter
export {
  type CrdtOperationsInsert,
  type CrdtOperationsRow,
  connectPglite,
  connectPostgres,
  createMcpDbClient,
  type McpDbClient,
  type QueryResult,
} from './adapters/db.js'
// Configuration
export {
  getMcpConfig,
  type McpConfig as McpEnvConfig,
  type McpMetricsMode,
} from './config/index.js'
// Contracts (Zod schemas + tool bridging)
export {
  agentDefinitionToAgentCard,
  agentDefinitionToMcpTools,
  contractsToolDefinitionToMcpTool,
  type MCPAdapterConfig,
  MCPAdapterConfigSchema,
  type MCPRequest,
  type MCPRequestOptions,
  MCPRequestOptionsSchema,
  MCPRequestSchema,
  type MCPResponse,
  type MCPResponseMetadata,
  MCPResponseMetadataSchema,
  MCPResponseSchema,
  mcpToolToContractsToolDefinition,
} from './contracts.js'
// Adapter framework
export {
  createMCPAdapter,
  disposeAllAdapters,
  generateIdempotencyKey,
  generateUniqueIdempotencyKey,
  MCPAdapter,
  type MCPConfig,
  NeonAdapter,
  StripeAdapter,
  VercelAdapter,
} from './servers/adapter.js'
