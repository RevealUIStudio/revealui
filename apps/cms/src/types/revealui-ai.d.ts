/**
 * Type declarations for @revealui/ai (Pro package).
 *
 * On CI/OSS builds the Pro package is absent (gitignored). These ambient
 * declarations prevent TypeScript from erroring on dynamic import() calls.
 * Route handlers always guard with `.catch(() => null)` so these types
 * only need to satisfy the callsites — the real types come from the
 * Pro package when installed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Pro stub types */

declare module '@revealui/ai/embeddings' {
  export function generateEmbedding(text: string): Promise<{ vector: number[] }>;
  export function generateEmbeddings(texts: string[]): Promise<Array<{ vector: number[] }>>;
}

declare module '@revealui/ai/llm/server' {
  export function createLLMClientFromEnv(): {
    chat(
      messages: unknown[],
      options?: unknown,
    ): Promise<{
      content: string;
      toolCalls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
      usage?: {
        promptTokens: number;
        completionTokens?: number;
        cacheReadTokens?: number;
        cacheCreationTokens?: number;
      };
    }>;
    getResponseCacheStats():
      | {
          hits: number;
          misses: number;
          hitRate: number;
          size: number;
          evictions: number;
        }
      | undefined;
    getSemanticCacheStats():
      | {
          hits: number;
          misses: number;
          hitRate: number;
          avgSimilarity: number;
          totalQueries: number;
        }
      | undefined;
  };
  export function createLLMClientForUser(userId: string): Promise<unknown>;
}

declare module '@revealui/ai/llm/client' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/llm/key-validator' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/llm/providers/base' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/memory/vector' {
  export class VectorMemoryService {
    constructor(...args: unknown[]);
    searchSimilar(
      vector: number[],
      options?: unknown,
    ): Promise<Array<{ memory: { content: string }; score: number }>>;
  }
}

declare module '@revealui/ai/memory/persistence' {
  export class CRDTPersistence {
    constructor(...args: unknown[]);
    loadCompositeState(...args: unknown[]): Promise<unknown>;
    saveCompositeState(...args: unknown[]): Promise<void>;
  }
}

declare module '@revealui/ai/memory/stores' {
  import type { AgentMemory } from '@revealui/contracts/agents';

  export class WorkingMemory {
    constructor(...args: unknown[]);
    load(): Promise<void>;
    save(): Promise<void>;
    getSessionId(): string;
    getContext(): Record<string, unknown>;
    setContext(context: Record<string, unknown>): void;
    getSessionState(): Record<string, unknown>;
    updateSessionState(state: Record<string, unknown>): void;
    getActiveAgents(): Array<{ id: string; [key: string]: unknown }>;
    addAgent(agent: unknown): void;
    removeAgentById(id: string): void;
    get(...args: unknown[]): Promise<unknown>;
    set(...args: unknown[]): Promise<void>;
    delete(...args: unknown[]): Promise<void>;
    list(...args: unknown[]): Promise<unknown[]>;
    clear(...args: unknown[]): Promise<void>;
  }
  export class EpisodicMemory {
    constructor(...args: unknown[]);
    load(): Promise<void>;
    save(): Promise<void>;
    getUserId(): string;
    getAccessCount(): number;
    getAll(): Promise<AgentMemory[]>;
    get(id: string): Promise<AgentMemory | null>;
    add(data: unknown): Promise<unknown>;
    update(id: string, data: Partial<AgentMemory>): Promise<AgentMemory>;
    removeById(id: string): Promise<number>;
    search(...args: unknown[]): Promise<unknown[]>;
    delete(...args: unknown[]): Promise<void>;
    list(...args: unknown[]): Promise<unknown[]>;
  }
}

declare module '@revealui/ai/memory/agent' {
  export class AgentContextManager {
    constructor(...args: unknown[]);
    load(): Promise<void>;
    save(): Promise<void>;
    getSessionId(): string;
    getAgentId(): string;
    getContext(...args: unknown[]): Promise<unknown>;
    getAllContext(): Record<string, unknown>;
    updateContext(updates: Record<string, unknown>): void;
    removeContext(key: string): void;
    saveContext(...args: unknown[]): Promise<void>;
  }
}

declare module '@revealui/ai/memory/services' {
  export class NodeIdService {
    constructor(...args: unknown[]);
    getNodeId(scope: string, entityId: string): Promise<string>;
  }
  export function createNodeIdService(...args: unknown[]): NodeIdService;
}

declare module '@revealui/ai/memory' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/tools/cms' {
  export function createCMSTools(config: {
    apiClient: unknown;
    collections?: Array<{ slug: string; label: string; description: string }>;
    globals?: Array<{ slug: string; label: string; description: string }>;
  }): Array<{
    name: string;
    description: string;
    execute: (...args: unknown[]) => Promise<unknown>;
  }>;
}

declare module '@revealui/ai/tools/registry' {
  export class ToolRegistry {
    constructor();
    register(tool: {
      name: string;
      description: string;
      execute: (...args: unknown[]) => Promise<unknown>;
    }): void;
    getAll(): Array<{ name: string }>;
    getToolDefinitions(): Array<unknown>;
    get(
      name: string,
    ): { name: string; execute: (...args: unknown[]) => Promise<unknown> } | undefined;
    execute(name: string, args: unknown): Promise<{ success: boolean; data?: unknown }>;
  }
  export function executeToolCall(registry: ToolRegistry, toolCall: unknown): Promise<unknown>;
}

declare module '@revealui/ai/tools/coding' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/ingestion' {
  export class IngestionPipeline {
    constructor(...args: unknown[]);
    ingest(...args: unknown[]): Promise<unknown>;
  }
  export class CmsIndexer {
    constructor(config: unknown);
    onDocumentChanged(event: {
      collection: string;
      id: string;
      operation: 'create' | 'update' | 'delete';
      doc?: Record<string, unknown>;
      workspaceId?: string;
    }): Promise<void>;
    index(...args: unknown[]): Promise<unknown>;
  }
}

declare module '@revealui/ai/client' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/skills' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/orchestration/streaming-runtime' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/orchestration/agent' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/inference' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/inference/context-budget' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/inference/tool-result-compressor' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/inference/task-decomposer' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai' {
  const mod: Record<string, unknown>;
  export = mod;
}
