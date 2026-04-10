/**
 * Agent Interface
 *
 * Defines the structure for AI agents
 */

import type { EpisodicMemory } from '../memory/stores/episodic-memory.js';
import type { Tool, ToolResult } from '../tools/base.js';
import type { WebSearchProvider } from '../tools/web/types.js';

/**
 * Per-agent configuration. Extends the base Agent interface with optional
 * provider overrides and capability declarations.
 *
 * Pass as `agent.config` to opt into pluggable search backends (P4-3) and
 * capability-based task routing (A3).
 */
export interface AgentConfig {
  /**
   * Pluggable web search backend.
   * Defaults to DuckDuckGo (zero-config) when not set.
   * Set to a TavilyProvider or ExaProvider for higher-quality BYOK search.
   */
  webSearchProvider?: WebSearchProvider;

  /**
   * Capability tags used by AgentOrchestrator.findBestAgent() for routing.
   * Example: ['admin', 'search', 'ticket', 'summarize']
   */
  capabilities?: string[];
}

export interface Task {
  id: string;
  type: string;
  description: string;
  parameters?: Record<string, unknown>;
  priority?: number;
  deadline?: Date;
  /**
   * Capability tags required to handle this task.
   * AgentOrchestrator.findBestAgent() prefers agents whose
   * AgentConfig.capabilities intersect with this set.
   * Falls back to tool-name matching when no intersection is found.
   */
  requiredCapabilities?: string[];
}

export interface AgentResult {
  success: boolean;
  output?: string;
  toolResults?: ToolResult[];
  error?: string;
  metadata?: {
    executionTime?: number;
    tokensUsed?: number;
    cost?: number;
  };
}

export interface Agent {
  /**
   * Unique agent ID
   */
  id: string;

  /**
   * Agent name
   */
  name: string;

  /**
   * Agent instructions (system prompt)
   */
  instructions: string;

  /**
   * Available tools
   */
  tools: Tool[];

  /**
   * Memory system (optional — agents without memory skip episodic recall)
   */
  memory?: EpisodicMemory;

  /**
   * Per-agent configuration (provider overrides, capability declarations).
   */
  config?: AgentConfig;

  /**
   * Get agent context
   */
  getContext(): AgentContext;
}

export interface AgentContext {
  agentId: string;
  userId?: string;
  sessionId?: string;
  currentTask?: Task;
  recentActions?: AgentAction[];
  metadata?: Record<string, unknown>;
}

export interface AgentAction {
  type: 'tool_call' | 'memory_read' | 'memory_write' | 'llm_call';
  timestamp: Date;
  details: Record<string, unknown>;
}
