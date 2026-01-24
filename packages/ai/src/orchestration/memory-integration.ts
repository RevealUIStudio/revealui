/**
 * Memory Integration
 *
 * Connects agents to the existing memory system
 */

import type { AgentMemory } from "@revealui/contracts/agents";
import type { EpisodicMemory } from "../memory/memory/episodic-memory.js";
import type { Agent, AgentContext } from "./agent.js";

/**
 * Integrate agent with memory system
 */
export class AgentMemoryIntegration {
	/**
	 * Store agent context in memory
	 */
	static async storeContext(
		agent: Agent,
		memory: EpisodicMemory,
		context: AgentContext,
	): Promise<void> {
		const memoryEntry: AgentMemory = {
			id: `context-${agent.id}-${Date.now()}`,
			version: 1,
			content: JSON.stringify(context),
			type: "fact", // Use 'fact' type since context is a learned fact about the agent state
			source: {
				type: "agent",
				id: agent.id,
				confidence: 1,
			},
			metadata: {
				importance: 0.5,
				agentId: agent.id,
				sessionId: context.sessionId,
				custom: context.metadata,
			},
			createdAt: new Date().toISOString(),
			accessedAt: new Date().toISOString(),
			accessCount: 0,
			verified: false,
		};

		await memory.add(memoryEntry);
		await memory.save();
	}

	/**
	 * Retrieve relevant memories for agent
	 */
	static async retrieveMemories(
		agent: Agent,
		memory: EpisodicMemory,
		query?: string,
		limit = 10,
	): Promise<AgentMemory[]> {
		const allMemories = await memory.getAll();

		// Filter by agent ID (check metadata.agentId or source.id)
		const agentMemories = allMemories.filter(
			(m) => m.metadata?.agentId === agent.id || m.source.id === agent.id,
		);

		// If query provided, filter by content (simplified - would use semantic search in production)
		if (query) {
			const queryLower = query.toLowerCase();
			return agentMemories
				.filter((m) => m.content.toLowerCase().includes(queryLower))
				.slice(0, limit);
		}

		// Return most recent
		return agentMemories
			.sort((a, b) => {
				const aTime = new Date(a.accessedAt).getTime();
				const bTime = new Date(b.accessedAt).getTime();
				return bTime - aTime;
			})
			.slice(0, limit);
	}

	/**
	 * Update memory from agent action
	 */
	static async updateMemoryFromAction(
		agent: Agent,
		memory: EpisodicMemory,
		action: {
			type: string;
			result: unknown;
			metadata?: Record<string, unknown>;
		},
	): Promise<void> {
		const memoryEntry: AgentMemory = {
			id: `action-${agent.id}-${Date.now()}`,
			version: 1,
			content: JSON.stringify({
				type: action.type,
				result: action.result,
				timestamp: new Date().toISOString(),
			}),
			type: "decision", // Use 'decision' type since actions represent decisions made
			source: {
				type: "agent",
				id: agent.id,
				confidence: 1,
			},
			metadata: {
				importance: 0.5,
				agentId: agent.id,
				custom: {
					actionType: action.type,
					...action.metadata,
				},
			},
			createdAt: new Date().toISOString(),
			accessedAt: new Date().toISOString(),
			accessCount: 0,
			verified: false,
		};

		await memory.add(memoryEntry);
		await memory.save();
	}

	/**
	 * Get agent context from memory
	 */
	static async getContext(
		agent: Agent,
		memory: EpisodicMemory,
	): Promise<AgentContext | null> {
		const memories = await AgentMemoryIntegration.retrieveMemories(
			agent,
			memory,
			"context",
			1,
		);

		if (memories.length === 0 || !memories[0]) {
			return null;
		}

		try {
			const context = JSON.parse(memories[0].content) as AgentContext;
			return context;
		} catch {
			return null;
		}
	}
}
