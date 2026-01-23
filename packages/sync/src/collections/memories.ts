/**
 * Agent Memory Collection - ElectricSQL Integration
 *
 * Simplified ElectricSQL integration for agent memory sync.
 */

import type { AgentMemory, MemoryType } from "@revealui/contracts/agents";
import { z } from "zod";

// Memory schema for type safety
export const memorySchema = z.object({
	id: z.string(),
	content: z.string(),
	type: z.string(), // 'fact', 'skill', 'preference', etc.
	source: z.record(z.unknown()),
	embedding: z.array(z.number()).optional(),
	embeddingMetadata: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).default({}),
	accessCount: z.number().default(0),
	accessedAt: z.date().optional(),
	verified: z.boolean().default(false),
	verifiedBy: z.string().optional(),
	verifiedAt: z.date().optional(),
	siteId: z.string().optional(),
	agentId: z.string().optional(),
	createdAt: z.date(),
	expiresAt: z.date().optional(),
});

export type MemoryItem = z.infer<typeof memorySchema>;

// Shape configuration for ElectricSQL memories
export const memoryShape = {
	table: "agent_memories",
	// where clause will be set dynamically based on agentId
	getWhereClause: (agentId: string) =>
		`agent_id = '${agentId}' AND (expires_at IS NULL OR expires_at > NOW())`,
	orderBy: "created_at DESC",
};

// Filtered shape for recent memories only
export const recentMemoryShape = {
	table: "agent_memories",
	getWhereClause: (agentId: string) =>
		`agent_id = '${agentId}' AND created_at > NOW() - INTERVAL '7 days'`,
	orderBy: "created_at DESC",
	limit: 100,
};

// Utility functions for memory operations
export const memoryUtils = {
	// Create a new memory
	createMemory: (
		content: string,
		type: MemoryType,
		agentId: string,
		metadata?: Record<string, unknown>,
	): Omit<AgentMemory, "embedding"> => ({
		id: crypto.randomUUID(),
		content,
		type,
		source: { type: "agent", id: agentId, confidence: 1 },
		metadata: metadata ? { importance: 0.5, ...metadata } : { importance: 0.5 },
		createdAt: new Date().toISOString(),
		accessedAt: new Date().toISOString(),
		accessCount: 0,
		verified: false,
	}),

	// Update memory access
	updateAccess: (memory: AgentMemory): AgentMemory => ({
		...memory,
		accessedAt: new Date().toISOString(),
		accessCount: memory.accessCount + 1,
	}),

	// Check if memory is expired
	isExpired: (memory: AgentMemory): boolean => {
		return memory.expiresAt ? new Date(memory.expiresAt) < new Date() : false;
	},
};

export default memoryShape;
