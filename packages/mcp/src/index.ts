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
// MCP protocol client (Stage 0 complete; Stage 1 PR-1.1 adds Streamable HTTP transport)
export {
  type ClientCapabilities,
  type CompleteRequest,
  type CompleteResult,
  type Completion,
  type CompletionReference,
  type CreateMessageRequest,
  type CreateMessageResult,
  type CustomTransportOptions,
  type ElicitationHandler,
  type ElicitRequest,
  type ElicitResult,
  type GetPromptResult,
  type LoggingLevel,
  type LoggingMessageNotification,
  type LogMessageParams,
  McpCapabilityError,
  McpClient,
  type McpClientOptions,
  McpNotConnectedError,
  type McpRequestOptions,
  type Progress,
  type Prompt,
  type PromptMessage,
  type PromptReference,
  type Resource,
  type ResourceContents,
  type ResourceTemplateReference,
  type ResourceUpdatedParams,
  type Root,
  type RootsProvider,
  type SamplingHandler,
  type ServerCapabilities,
  type StdioTransportOptions,
  type StreamableHTTPClientTransportOptions,
  type StreamableHTTPReconnectionOptions,
  type StreamableHttpTransportOptions,
  type TransportOptions,
} from './client.js';
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
// OAuth 2.1 client provider (Stage 2 PR-2.1 — revvault-backed credential storage)
export {
  createMemoryVault,
  createRevvaultVault,
  type McpOAuthPaths,
  McpOAuthProvider,
  type McpOAuthProviderOptions,
  mcpOAuthPaths,
  type OAuthClientInformation,
  type OAuthClientInformationFull,
  type OAuthClientMetadata,
  type OAuthTokens,
  RevvaultError,
  type RevvaultVaultOptions,
  type Vault,
} from './oauth.js';
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
// First-party server factories (Stage 1 PR-1.2 — dual-mode template)
export {
  createRevealuiContentServer,
  setCredentials as setRevealuiContentCredentials,
} from './servers/factories/revealui-content.js';
// Server launchers
export { launchNeonMcp } from './servers/neon.js';
export { launchNextDevtoolsMcp } from './servers/next-devtools.js';
export { launchPlaywrightMcp } from './servers/playwright.js';
export { launchStripeMcp } from './servers/stripe.js';
export { launchSupabaseMcp } from './servers/supabase.js';
export { launchVercelMcp } from './servers/vercel.js';
// Streamable HTTP server-side helper (Stage 1 PR-1.1)
export {
  createNodeStreamableHttpHandler,
  type StreamableHttpHandler,
  type StreamableHttpHandlerOptions,
} from './streamable-http.js';
// Telemetry (structured observability events)
export {
  type McpEvent,
  type McpEventHandler,
  type McpEventType,
  McpTelemetry,
} from './telemetry.js';
