/**
 * Default Tool Sets for Agent Types
 *
 * Defines the default tools available to standard agent configurations.
 * Consumers extend these by pushing to agent.tools or by passing
 * additionalTools to getWorkspaceAgentTools().
 *
 * MCP-discovered tools are merged at runtime by MCPHypervisor (P3-3).
 */

import type { Tool } from '../tools/base.js';
import { webSearchTool } from '../tools/web/index.js';

/**
 * Default tools for the WORKSPACE_AGENT profile.
 * Includes web search (DuckDuckGo, zero-config).
 */
export const WORKSPACE_AGENT_DEFAULT_TOOLS: Tool[] = [webSearchTool];

/**
 * Returns the workspace agent default tool set, optionally merged with
 * additional tools (e.g. CMS tools, MCP-discovered tools).
 */
export function getWorkspaceAgentTools(additionalTools: Tool[] = []): Tool[] {
  return [...WORKSPACE_AGENT_DEFAULT_TOOLS, ...additionalTools];
}
