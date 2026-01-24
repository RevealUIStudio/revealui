/**
 * Agent Interface
 *
 * Defines the structure for AI agents
 */

import type { Message } from "../llm/providers/base.js";
import type { EpisodicMemory } from "../memory/memory/episodic-memory.js";
import type { Tool, ToolResult } from "../tools/base.js";

export interface Task {
	id: string;
	type: string;
	description: string;
	parameters?: Record<string, unknown>;
	priority?: number;
	deadline?: Date;
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
	 * Memory system
	 */
	memory: EpisodicMemory;

	/**
	 * Execute a task
	 */
	execute(task: Task): Promise<AgentResult>;

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
	type: "tool_call" | "memory_read" | "memory_write" | "llm_call";
	timestamp: Date;
	details: Record<string, unknown>;
}
