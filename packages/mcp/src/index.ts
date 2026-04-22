/**
 * @revealui/mcp
 *
 * Model Context Protocol integrations for RevealUI.
 *
 * Provides:
 * - MCP hypervisor: process management, tool discovery, health checks (pre-wired)
 * - MCP adapter framework: base class with retry, idempotency, error handling (pre-wired)
 * - Database adapter: PGlite / PostgreSQL with CRDT support (pre-wired)
 * - MCP contracts: Zod schemas for request/response/tool bridging (pre-wired)
 *
 * Server adapter status:
 * - NeonAdapter, StripeAdapter, VercelAdapter: scaffolded (adapter config + error mapping only,
 *   no live API calls). Implement execute() overrides before advertising as functional.
 *
 * @packageDocumentation
 */

import { isFeatureEnabled } from '@revealui/core/features';
import { initializeLicense } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';

/**
 * Check if the MCP package is licensed for use.
 * Initializes the license cache from environment variables, then checks the tier.
 * Returns false with a warning log if no Pro/Enterprise license is active.
 */
export async function checkMcpLicense(): Promise<boolean> {
  await initializeLicense();
  if (!isFeatureEnabled('mcp')) {
    logger.warn(
      '[@revealui/mcp] MCP server integration requires a Pro or Enterprise license. ' +
        'Visit https://revealui.com/pricing for details.',
    );
    return false;
  }
  return true;
}

// Database adapter
export {
  connectPglite,
  connectPostgres,
  createMcpDbClient,
  type McpDbClient,
  type McpDocumentOperationsInsert,
  type McpDocumentOperationsRow,
  type QueryResult,
} from './adapters/db.js';
// Auth bridge (JWT claims validation + tool authorization)
export {
  authorizeToolCall,
  type McpAuthClaims,
  McpAuthClaimsSchema,
  validateMcpClaims,
} from './auth.js';
// Configuration
export {
  getMcpConfig,
  type McpConfig as McpEnvConfig,
  type McpMetricsMode,
} from './config/index.js';
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
  type ToolOutputSchemaName,
  ToolOutputSchemas,
  validateToolOutput,
} from './contracts.js';
// Hypervisor: process management + dynamic tool discovery
export {
  type MCPCredentialResolver,
  MCPHypervisor,
  type MCPServerConfig,
  type MCPTenantContext,
  type MCPTool,
  type NamespacedTool,
} from './hypervisor.js';
// Tool pipeline (composition / chaining)
export {
  executePipeline,
  type PipelineResult,
  type PipelineStep,
  type PipelineStepResult,
} from './pipeline.js';
// Rate limit stores (pluggable backends)
export {
  InMemoryRateLimitStore,
  PGliteRateLimitStore,
  type RateLimitStore,
  type WindowEntry,
} from './rate-limit-store.js';
// Rate limiting (per-tier)
export {
  DEFAULT_TIER_LIMITS,
  McpRateLimiter,
  type McpRateLimiterOptions,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter.js';
// Adapter framework
export {
  createMCPAdapter,
  disposeAllAdapters,
  generateIdempotencyKey,
  generateUniqueIdempotencyKey,
  type IdempotencyStore,
  MCPAdapter,
  type MCPConfig,
  NeonAdapter,
  StripeAdapter,
  VercelAdapter,
} from './servers/adapter.js';
// Server launchers
export { launchNeonMcp } from './servers/neon.js';
export { launchNextDevtoolsMcp } from './servers/next-devtools.js';
export { launchPlaywrightMcp } from './servers/playwright.js';
export { launchStripeMcp } from './servers/stripe.js';
export { launchSupabaseMcp } from './servers/supabase.js';
export { launchVercelMcp } from './servers/vercel.js';
// Telemetry (structured observability events)
export {
  type McpEvent,
  type McpEventHandler,
  type McpEventType,
  McpTelemetry,
} from './telemetry.js';
