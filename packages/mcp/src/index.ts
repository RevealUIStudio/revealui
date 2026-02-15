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
