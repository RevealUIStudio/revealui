/**
 * Store Memory Tool
 *
 * Explicit memory storage tool that agents must call to persist information
 * to long-term episodic memory. Agents are never auto-enrolled into memory
 * writes  -  they must invoke this tool with a clear reason.
 *
 * GDPR rationale: Requiring explicit intent aligns with the data minimisation
 * principle (GDPR Art. 5(1)(c)) and purpose limitation principle (Art. 5(1)(b)).
 * Only information an agent actively decides to store is persisted.
 *
 * See AgentMemoryIntegrationConfig.requireExplicitStore for the gate that
 * blocks auto-writes at the integration layer.
 */

import { z } from 'zod/v4';
import type { EpisodicMemory } from '../../memory/stores/episodic-memory.js';
import type { Tool, ToolResult } from '../base.js';

const StoreMemoryParamsSchema = z.object({
  content: z.string().min(1).describe('The information to store in long-term memory'),
  tags: z.array(z.string()).optional().describe('Optional tags to categorize the memory'),
  reason: z.string().min(1).describe('Why this information should be remembered across sessions'),
});

export type StoreMemoryParams = z.infer<typeof StoreMemoryParamsSchema>;

/**
 * Create an explicit store-memory tool bound to an EpisodicMemory instance.
 *
 * Agents must call this tool to persist information. Auto-store via
 * AgentMemoryIntegration.storeContext() is blocked when
 * `requireExplicitStore: true` (default).
 *
 * @example
 * ```typescript
 * const tool = createStoreMemoryTool(episodicMemory, agent.id)
 * agent.tools.push(tool)
 * ```
 */
export function createStoreMemoryTool(memory: EpisodicMemory, agentId: string): Tool {
  return {
    name: 'store_memory',
    description:
      'Explicitly store important information in long-term memory for future sessions. ' +
      'Only call this when information is genuinely valuable to retain. ' +
      'Provide a clear reason  -  this is required for privacy compliance.',
    parameters: StoreMemoryParamsSchema,

    async execute(params: unknown): Promise<ToolResult> {
      const { content, tags, reason } = StoreMemoryParamsSchema.parse(params);

      try {
        const memoryId = `explicit-${agentId}-${Date.now()}`;

        const memoryEntry = {
          id: memoryId,
          version: 1 as const,
          content,
          type: 'fact' as const,
          source: {
            type: 'agent' as const,
            id: agentId,
            confidence: 1,
          },
          metadata: {
            importance: 0.7,
            agentId,
            storeReason: reason,
            explicit: true,
            ...(tags && tags.length > 0 && { tags }),
          },
          createdAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          verified: false,
        };

        await memory.add(memoryEntry);
        await memory.save();

        return {
          success: true,
          data: {
            stored: true,
            memoryId,
            message: `Memory stored: "${content.length > 80 ? `${content.substring(0, 80)}…` : content}"`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to store memory: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    getMetadata() {
      return {
        category: 'memory',
        version: '1.0.0',
        author: 'RevealUI',
        gdprAligned: true,
      };
    },
  };
}
