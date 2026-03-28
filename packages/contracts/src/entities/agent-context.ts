/**
 * AgentContext Entity Contract
 *
 * Manages agent working memory and context with semantic search capabilities.
 * Agent contexts store session-specific state with CRDT sync and vector embeddings.
 *
 * Business Rules:
 * - Context ID format: {sessionId}:{agentId}
 * - Priority range: 0 (low) to 1 (high), default 0.5
 * - Embeddings must be 1536 dimensions (OpenAI ada-002 format)
 * - Context data validated for circular references and size limits
 * - Automatic versioning for schema migrations
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const AGENT_CONTEXT_SCHEMA_VERSION = 1;

// Embedding configuration (OpenAI ada-002 standard)
export const EMBEDDING_CONFIG = {
  DIMENSIONS: 1536,
  MIN_VALUE: -1.0,
  MAX_VALUE: 1.0,
} as const;

// Priority configuration
export const PRIORITY_CONFIG = {
  MIN: 0.0,
  MAX: 1.0,
  DEFAULT: 0.5,
  HIGH: 0.8,
  LOW: 0.2,
} as const;

// Context data limits
export const CONTEXT_LIMITS = {
  MAX_KEYS: 100,
  MAX_KEY_LENGTH: 256,
  MAX_VALUE_SIZE_BYTES: 1_000_000, // 1MB
  MAX_TOTAL_SIZE_BYTES: 10_000_000, // 10MB
} as const;

// =============================================================================
// Base AgentContext Schema
// =============================================================================

/**
 * Embedding vector schema with validation
 */
export const EmbeddingVectorSchema = z
  .array(z.number())
  .length(
    EMBEDDING_CONFIG.DIMENSIONS,
    `Embedding must have exactly ${EMBEDDING_CONFIG.DIMENSIONS} dimensions`,
  )
  .refine(
    (arr) =>
      arr.every((val) => val >= EMBEDDING_CONFIG.MIN_VALUE && val <= EMBEDDING_CONFIG.MAX_VALUE),
    {
      message: `All embedding values must be between ${EMBEDDING_CONFIG.MIN_VALUE} and ${EMBEDDING_CONFIG.MAX_VALUE}`,
    },
  );

export type EmbeddingVector = z.infer<typeof EmbeddingVectorSchema>;

/**
 * Agent Context object schema
 */
export const AgentContextObjectSchema = z.object({
  id: z.string().regex(/^[^:]+:[^:]+$/, 'Context ID must be in format sessionId:agentId'),
  version: z.number().int().default(AGENT_CONTEXT_SCHEMA_VERSION),
  sessionId: z.string().min(1, 'Session ID is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
  context: z.record(z.string(), z.unknown()).default({}),
  priority: z
    .number()
    .min(PRIORITY_CONFIG.MIN)
    .max(PRIORITY_CONFIG.MAX)
    .default(PRIORITY_CONFIG.DEFAULT),
  embedding: EmbeddingVectorSchema.nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Agent Context schema with validation rules
 */
export const AgentContextBaseSchema = AgentContextObjectSchema.refine(
  (data) => {
    // Validate ID matches sessionId:agentId format
    const expectedId = `${data.sessionId}:${data.agentId}`;
    return data.id === expectedId;
  },
  {
    message: 'Context ID must match format sessionId:agentId',
    path: ['id'],
  },
).refine(
  (data) => {
    // Validate context data size
    const keys = Object.keys(data.context);
    return keys.length <= CONTEXT_LIMITS.MAX_KEYS;
  },
  {
    message: `Context cannot have more than ${CONTEXT_LIMITS.MAX_KEYS} keys`,
    path: ['context'],
  },
);

export const AgentContextSchema = AgentContextBaseSchema;

// =============================================================================
// Insert Schema
// =============================================================================

/**
 * Schema for creating new agent contexts
 */
export const AgentContextInsertSchema = AgentContextObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type AgentContext = z.infer<typeof AgentContextSchema>;
export type AgentContextInsert = z.infer<typeof AgentContextInsertSchema>;

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate agent context ID from sessionId and agentId
 */
export function generateContextId(sessionId: string, agentId: string): string {
  return `${sessionId}:${agentId}`;
}

/**
 * Parse agent context ID into components
 */
export function parseContextId(contextId: string): { sessionId: string; agentId: string } | null {
  const parts = contextId.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [sessionId, agentId] = parts;
  if (!(sessionId && agentId)) {
    return null;
  }
  return { sessionId, agentId };
}

/**
 * Validate context ID format
 */
export function isValidContextId(contextId: string): boolean {
  return parseContextId(contextId) !== null;
}

// =============================================================================
// Priority Helpers
// =============================================================================

/**
 * Check if priority is high (>= 0.8)
 */
export function isHighPriority(context: AgentContext): boolean {
  return context.priority >= PRIORITY_CONFIG.HIGH;
}

/**
 * Check if priority is low (<= 0.2)
 */
export function isLowPriority(context: AgentContext): boolean {
  return context.priority <= PRIORITY_CONFIG.LOW;
}

/**
 * Get priority category
 */
export function getPriorityCategory(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= PRIORITY_CONFIG.HIGH) return 'high';
  if (priority <= PRIORITY_CONFIG.LOW) return 'low';
  return 'medium';
}

/**
 * Normalize priority to valid range
 */
export function normalizePriority(priority: number): number {
  return Math.max(PRIORITY_CONFIG.MIN, Math.min(PRIORITY_CONFIG.MAX, priority));
}

// =============================================================================
// Embedding Validation
// =============================================================================

/**
 * Validate embedding dimensions
 */
export function validateEmbeddingDimensions(embedding: number[]): boolean {
  return embedding.length === EMBEDDING_CONFIG.DIMENSIONS;
}

/**
 * Validate embedding values are in valid range
 */
export function validateEmbeddingValues(embedding: number[]): boolean {
  return embedding.every(
    (val) => val >= EMBEDDING_CONFIG.MIN_VALUE && val <= EMBEDDING_CONFIG.MAX_VALUE,
  );
}

/**
 * Check if context has valid embedding
 */
export function hasValidEmbedding(context: AgentContext): boolean {
  if (!context.embedding) return false;
  return (
    validateEmbeddingDimensions(context.embedding) && validateEmbeddingValues(context.embedding)
  );
}

/**
 * Normalize embedding vector (L2 normalization)
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;
  return embedding.map((val) => val / magnitude);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i] ?? 0;
    const val2 = embedding2[i] ?? 0;
    dotProduct += val1 * val2;
    mag1 += val1 * val1;
    mag2 += val2 * val2;
  }

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// =============================================================================
// Context Data Validation
// =============================================================================

/**
 * Validate context key format
 */
export function validateContextKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= CONTEXT_LIMITS.MAX_KEY_LENGTH &&
    !key.startsWith('_') && // Reserved prefix
    !key.includes('..') && // Prevent path traversal
    !/[<>{}\\]/.test(key) // Prevent injection
  );
}

/**
 * Estimate context data size in bytes
 */
export function estimateContextSize(context: Record<string, unknown>): number {
  return new Blob([JSON.stringify(context)]).size;
}

/**
 * Validate context data doesn't exceed size limits
 */
export function validateContextSize(context: Record<string, unknown>): boolean {
  const size = estimateContextSize(context);
  return size <= CONTEXT_LIMITS.MAX_TOTAL_SIZE_BYTES;
}

/**
 * Check for circular references in context data
 */
export function hasCircularReference(obj: unknown, seen = new WeakSet()): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  if (seen.has(obj)) {
    return true;
  }

  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.some((item) => hasCircularReference(item, seen));
  }

  return Object.values(obj as Record<string, unknown>).some((value) =>
    hasCircularReference(value, seen),
  );
}

/**
 * Validate context data for security and consistency
 */
export function validateContextData(context: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check key count
  if (Object.keys(context).length > CONTEXT_LIMITS.MAX_KEYS) {
    errors.push(`Context has too many keys (max ${CONTEXT_LIMITS.MAX_KEYS})`);
  }

  // Check each key
  for (const key of Object.keys(context)) {
    if (!validateContextKey(key)) {
      errors.push(`Invalid context key: ${key}`);
    }
  }

  // Check for circular references
  if (hasCircularReference(context)) {
    errors.push('Context contains circular references');
  }

  // Check total size
  if (!validateContextSize(context)) {
    const size = estimateContextSize(context);
    errors.push(`Context too large: ${size} bytes (max ${CONTEXT_LIMITS.MAX_TOTAL_SIZE_BYTES})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Context Creation
// =============================================================================

/**
 * Create agent context insert data
 */
export function createAgentContextInsert(
  sessionId: string,
  agentId: string,
  options?: {
    context?: Record<string, unknown>;
    priority?: number;
    embedding?: number[];
  },
): AgentContextInsert {
  const now = new Date();

  return {
    id: generateContextId(sessionId, agentId),
    version: AGENT_CONTEXT_SCHEMA_VERSION,
    sessionId,
    agentId,
    context: options?.context ?? {},
    priority:
      options?.priority !== undefined
        ? normalizePriority(options.priority)
        : PRIORITY_CONFIG.DEFAULT,
    embedding: options?.embedding ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update context data with validation
 */
export function updateAgentContext(updates: {
  context?: Record<string, unknown>;
  priority?: number;
  embedding?: number[] | null;
}): Partial<AgentContext> {
  const result: Partial<AgentContext> = {
    updatedAt: new Date(),
  };

  if (updates.context !== undefined) {
    result.context = updates.context;
  }

  if (updates.priority !== undefined) {
    result.priority = normalizePriority(updates.priority);
  }

  if (updates.embedding !== undefined) {
    result.embedding = updates.embedding;
  }

  return result;
}

// =============================================================================
// Extended Views with Computed Fields
// =============================================================================

/**
 * Agent context with computed fields for UI display
 */
export interface AgentContextWithComputed extends AgentContext {
  _computed: {
    hasEmbedding: boolean;
    embeddingValid: boolean;
    priorityCategory: 'high' | 'medium' | 'low';
    contextKeyCount: number;
    contextSizeBytes: number;
    isHighPriority: boolean;
    isLowPriority: boolean;
    parsedId: { sessionId: string; agentId: string };
  };
}

/**
 * Convert agent context to format with computed fields
 */
export function agentContextToHuman(context: AgentContext): AgentContextWithComputed {
  const parsedId = parseContextId(context.id);

  return {
    ...context,
    _computed: {
      hasEmbedding: context.embedding !== null && context.embedding !== undefined,
      embeddingValid: hasValidEmbedding(context),
      priorityCategory: getPriorityCategory(context.priority),
      contextKeyCount: Object.keys(context.context).length,
      contextSizeBytes: estimateContextSize(context.context),
      isHighPriority: isHighPriority(context),
      isLowPriority: isLowPriority(context),
      parsedId: parsedId ?? { sessionId: '', agentId: '' },
    },
  };
}

/**
 * Agent context with metadata for agent/API consumption
 */
export interface AgentContextAgent extends AgentContext {
  metadata: {
    embeddingPresent: boolean;
    embeddingDimensions: number | null;
    priorityLevel: 'high' | 'medium' | 'low';
    contextSize: number;
    keyCount: number;
  };
}

/**
 * Convert agent context to agent-compatible format
 */
export function agentContextToAgent(context: AgentContext): AgentContextAgent {
  return {
    ...context,
    metadata: {
      embeddingPresent: context.embedding !== null && context.embedding !== undefined,
      embeddingDimensions: context.embedding?.length ?? null,
      priorityLevel: getPriorityCategory(context.priority),
      contextSize: estimateContextSize(context.context),
      keyCount: Object.keys(context.context).length,
    },
  };
}

/**
 * Zod schema for agent context with computed fields
 */
export const AgentContextWithComputedSchema = AgentContextSchema.and(
  z.object({
    _computed: z.object({
      hasEmbedding: z.boolean(),
      embeddingValid: z.boolean(),
      priorityCategory: z.enum(['high', 'medium', 'low']),
      contextKeyCount: z.number().int(),
      contextSizeBytes: z.number().int(),
      isHighPriority: z.boolean(),
      isLowPriority: z.boolean(),
      parsedId: z.object({
        sessionId: z.string(),
        agentId: z.string(),
      }),
    }),
  }),
);

/**
 * Zod schema for agent context with agent metadata
 */
export const AgentContextAgentSchema = AgentContextSchema.and(
  z.object({
    metadata: z.object({
      embeddingPresent: z.boolean(),
      embeddingDimensions: z.number().int().nullable(),
      priorityLevel: z.enum(['high', 'medium', 'low']),
      contextSize: z.number().int(),
      keyCount: z.number().int(),
    }),
  }),
);
