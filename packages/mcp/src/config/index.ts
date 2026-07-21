/**
 * MCP env config — single source is `@revealui/config/mcp`.
 * This file re-exports for the historical `@revealui/mcp` barrel path.
 * Do not re-implement; adapters already import from `@revealui/config/mcp`.
 */

export { default, getMcpConfig, type McpConfig, type McpMetricsMode } from '@revealui/config/mcp';
