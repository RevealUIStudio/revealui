/**
 * Type declarations for @revealui/ai (Pro package).
 *
 * On CI/OSS builds the Pro package is absent (gitignored). These ambient
 * declarations prevent TypeScript from erroring on dynamic import() calls.
 * Route handlers always guard with `.catch(() => null)` so these types
 * only need to satisfy the callsites — the real types come from the
 * Pro package when installed.
 */

declare module '@revealui/ai' {
  export function createLLMClientFromEnv(): unknown;
  export function handleA2AJsonRpc(
    req: unknown,
    agentId: string | undefined,
    llmClient: unknown,
  ): Promise<{ result: unknown }>;
  export function getTask(
    taskId: string,
  ): { status: { state: string }; [key: string]: unknown } | null;

  export const agentCardRegistry: {
    getCard(agentId: string, baseUrl: string): unknown;
    getDef(agentId: string): unknown;
    has(agentId: string): boolean;
    register(def: unknown): void;
    unregister(agentId: string): boolean;
    update(...args: unknown[]): void;
    listCards(baseUrl: string): unknown[];
  };

  export class TicketAgentDispatcher {
    constructor(config: {
      llmClient: unknown;
      apiClient: unknown;
      ticketClient: unknown;
    });
    dispatch(input: unknown): Promise<{
      success: boolean;
      output?: string;
      metadata?: { executionTime?: number; tokensUsed?: number };
    }>;
  }
}

declare module '@revealui/ai/embeddings' {
  export function generateEmbedding(text: string): Promise<{ vector: number[] }>;
  export function generateEmbeddings(texts: string[]): Promise<Array<{ vector: number[] }>>;
}

declare module '@revealui/ai/llm/client' {
  export class LLMClient {
    constructor(config: {
      provider: string;
      apiKey?: string;
      baseURL?: string;
      model?: string;
    });
  }
}

declare module '@revealui/ai/llm/key-validator' {
  export function validateProviderKey(
    provider: string,
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }>;
}

declare module '@revealui/ai/llm/providers/base' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/llm/server' {
  export function createLLMClientFromEnv(): unknown;
  export function createLLMClientForUser(userId: string): Promise<unknown>;
}

declare module '@revealui/ai/orchestration/streaming-runtime' {
  interface StreamChunk {
    type: string;
    [key: string]: unknown;
  }

  export class StreamingAgentRuntime {
    constructor(config: { maxIterations?: number; timeout?: number });
    streamTask(
      agent: { tools: unknown[]; [key: string]: unknown },
      task: unknown,
      llmClient: unknown,
      signal?: AbortSignal,
    ): AsyncIterable<StreamChunk>;
  }
}

declare module '@revealui/ai/orchestration/agent' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/tools/cms' {
  export function createCMSTools(config: {
    apiClient: unknown;
    collections?: Array<{
      slug: string;
      label: string;
      description: string;
    }>;
    globals?: Array<{ slug: string; label: string; description: string }>;
  }): unknown[];
}

declare module '@revealui/ai/tools/coding' {
  export function createCodingTools(config: {
    projectRoot: string;
    allowedPaths?: string[];
    include?: string[];
  }): unknown[];
}

declare module '@revealui/ai/tools/registry' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/ingestion' {
  export class IngestionPipeline {
    constructor(...args: unknown[]);
    ingest(config: unknown): Promise<{ status: string; [key: string]: unknown }>;
    deleteDocument(documentId: string): Promise<void>;
  }
  export class CmsIndexer {
    constructor(config: unknown);
    index(...args: unknown[]): Promise<unknown>;
  }
}

declare module '@revealui/ai/memory' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/memory/vector' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/memory/persistence' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/memory/stores' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/memory/agent' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/memory/services' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/client' {
  const mod: Record<string, unknown>;
  export = mod;
}

declare module '@revealui/ai/skills' {
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
