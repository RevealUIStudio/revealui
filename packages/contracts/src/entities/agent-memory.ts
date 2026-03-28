/**
 * AgentMemory Entity Contract
 *
 * Manages long-term agent memories with semantic search, verification workflow,
 * and multi-source tracking. Memories can be facts, preferences, decisions,
 * feedback, examples, corrections, skills, or warnings.
 *
 * Business Rules:
 * - Memory types: fact, preference, decision, feedback, example, correction, skill, warning
 * - Embeddings are 1536 dimensions (OpenAI ada-002 format)
 * - Source tracking required (conversation, user input, observation, etc.)
 * - Access tracking for importance scoring
 * - Verification workflow (verified, verifiedBy, verifiedAt)
 * - Optional expiration for time-sensitive memories
 * - Scoped to site and/or agent
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const AGENT_MEMORY_SCHEMA_VERSION = 1;

// Memory types
export const MEMORY_TYPES = [
  'fact',
  'preference',
  'decision',
  'feedback',
  'example',
  'correction',
  'skill',
  'warning',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

// Source types for memory provenance
export const SOURCE_TYPES = [
  'conversation',
  'user_input',
  'observation',
  'tool_use',
  'feedback',
  'correction',
  'inference',
  'import',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

// Embedding configuration (same as AgentContext)
export const MEMORY_EMBEDDING_CONFIG = {
  DIMENSIONS: 1536,
  MIN_VALUE: -1.0,
  MAX_VALUE: 1.0,
} as const;

// Access tracking thresholds
export const ACCESS_THRESHOLDS = {
  FREQUENTLY_ACCESSED: 10,
  RARELY_ACCESSED: 2,
  STALE_DAYS: 30,
} as const;

// Importance scores
export const IMPORTANCE_LEVELS = {
  CRITICAL: 1.0,
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3,
  MINIMAL: 0.1,
} as const;

// =============================================================================
// Base Schemas
// =============================================================================

/**
 * Memory source schema with provenance tracking
 */
export const MemorySourceSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  userId: z.string().optional(),
  timestamp: z.date().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type MemorySource = z.infer<typeof MemorySourceSchema>;

/**
 * Embedding metadata schema
 */
export const EmbeddingMetadataSchema = z.object({
  model: z.string(),
  dimensions: z.number().int().default(MEMORY_EMBEDDING_CONFIG.DIMENSIONS),
  generatedAt: z.date(),
  version: z.string().optional(),
});

export type EmbeddingMetadata = z.infer<typeof EmbeddingMetadataSchema>;

/**
 * Memory metadata schema
 */
export const MemoryMetadataSchema = z.object({
  importance: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  relatedMemories: z.array(z.string()).optional(),
});

export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;

/**
 * Embedding vector schema (1536 dimensions)
 */
export const MemoryEmbeddingVectorSchema = z
  .array(z.number())
  .length(
    MEMORY_EMBEDDING_CONFIG.DIMENSIONS,
    `Embedding must have exactly ${MEMORY_EMBEDDING_CONFIG.DIMENSIONS} dimensions`,
  )
  .refine(
    (arr) =>
      arr.every(
        (val) =>
          val >= MEMORY_EMBEDDING_CONFIG.MIN_VALUE && val <= MEMORY_EMBEDDING_CONFIG.MAX_VALUE,
      ),
    {
      message: `All embedding values must be between ${MEMORY_EMBEDDING_CONFIG.MIN_VALUE} and ${MEMORY_EMBEDDING_CONFIG.MAX_VALUE}`,
    },
  );

export type MemoryEmbeddingVector = z.infer<typeof MemoryEmbeddingVectorSchema>;

// =============================================================================
// Base AgentMemory Schema
// =============================================================================

/**
 * Agent Memory object schema
 */
export const AgentMemoryObjectSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().default(AGENT_MEMORY_SCHEMA_VERSION),
  content: z.string().min(1, 'Memory content is required'),
  type: z.enum(MEMORY_TYPES),
  source: MemorySourceSchema,
  embedding: MemoryEmbeddingVectorSchema.nullable().optional(),
  embeddingMetadata: EmbeddingMetadataSchema.nullable().optional(),
  metadata: MemoryMetadataSchema.default({}),
  accessCount: z.number().int().default(0),
  accessedAt: z.date().nullable().optional(),
  verified: z.boolean().default(false),
  verifiedBy: z.string().nullable().optional(),
  verifiedAt: z.date().nullable().optional(),
  siteId: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  createdAt: z.date(),
  expiresAt: z.date().nullable().optional(),
});

/**
 * Agent Memory schema with validation rules
 */
export const AgentMemoryBaseSchema = AgentMemoryObjectSchema.refine(
  (data) => {
    // If verified, must have verifiedBy and verifiedAt
    if (data.verified) {
      return data.verifiedBy !== null && data.verifiedAt !== null;
    }
    return true;
  },
  {
    message: 'Verified memories must have verifiedBy and verifiedAt',
    path: ['verified'],
  },
).refine(
  (data) => {
    // If expiresAt exists, it must be in the future
    if (data.expiresAt) {
      return data.expiresAt > new Date();
    }
    return true;
  },
  {
    message: 'Memory expiration must be in the future',
    path: ['expiresAt'],
  },
);

export const AgentMemorySchema = AgentMemoryBaseSchema;

// =============================================================================
// Insert Schema
// =============================================================================

/**
 * Schema for creating new agent memories
 */
export const AgentMemoryInsertSchema = AgentMemoryObjectSchema.omit({
  createdAt: true,
  accessCount: true,
  accessedAt: true,
}).extend({
  createdAt: z.date().optional(),
  accessCount: z.number().int().optional(),
  accessedAt: z.date().nullable().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type AgentMemory = z.infer<typeof AgentMemorySchema>;
export type AgentMemoryInsert = z.infer<typeof AgentMemoryInsertSchema>;

// =============================================================================
// Memory Type Helpers
// =============================================================================

/**
 * Check if memory is a fact
 */
export function isFactMemory(memory: AgentMemory): boolean {
  return memory.type === 'fact';
}

/**
 * Check if memory is a preference
 */
export function isPreferenceMemory(memory: AgentMemory): boolean {
  return memory.type === 'preference';
}

/**
 * Check if memory is a decision
 */
export function isDecisionMemory(memory: AgentMemory): boolean {
  return memory.type === 'decision';
}

/**
 * Check if memory is feedback
 */
export function isFeedbackMemory(memory: AgentMemory): boolean {
  return memory.type === 'feedback';
}

/**
 * Check if memory is a correction
 */
export function isCorrectionMemory(memory: AgentMemory): boolean {
  return memory.type === 'correction';
}

/**
 * Check if memory is a warning
 */
export function isWarningMemory(memory: AgentMemory): boolean {
  return memory.type === 'warning';
}

// =============================================================================
// Verification Helpers
// =============================================================================

/**
 * Check if memory is verified
 */
export function isVerified(memory: AgentMemory): boolean {
  return memory.verified === true;
}

/**
 * Check if memory needs verification
 */
export function needsVerification(memory: AgentMemory): boolean {
  return !memory.verified && (memory.type === 'fact' || memory.type === 'correction');
}

/**
 * Create verification update
 */
export function createVerification(verifiedBy: string): Partial<AgentMemory> {
  return {
    verified: true,
    verifiedBy,
    verifiedAt: new Date(),
  };
}

/**
 * Revoke verification
 */
export function revokeVerification(): Partial<AgentMemory> {
  return {
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
  };
}

// =============================================================================
// Expiration Helpers
// =============================================================================

/**
 * Check if memory is expired
 */
export function isExpired(memory: AgentMemory): boolean {
  if (!memory.expiresAt) return false;
  return memory.expiresAt <= new Date();
}

/**
 * Check if memory is permanent (no expiration)
 */
export function isPermanent(memory: AgentMemory): boolean {
  return memory.expiresAt === null || memory.expiresAt === undefined;
}

/**
 * Calculate time until expiration in milliseconds
 */
export function getTimeUntilExpiration(memory: AgentMemory): number | null {
  if (!memory.expiresAt) return null;
  const now = Date.now();
  const expiresAt = memory.expiresAt.getTime();
  return Math.max(0, expiresAt - now);
}

/**
 * Check if memory is near expiration (< 24 hours)
 */
export function isNearExpiration(memory: AgentMemory, thresholdHours = 24): boolean {
  const timeRemaining = getTimeUntilExpiration(memory);
  if (timeRemaining === null) return false;
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  return timeRemaining > 0 && timeRemaining < thresholdMs;
}

/**
 * Create expiration date from duration in days
 */
export function createExpirationDate(daysFromNow: number): Date {
  const now = new Date();
  return new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
}

// =============================================================================
// Access Tracking Helpers
// =============================================================================

/**
 * Check if memory is frequently accessed
 */
export function isFrequentlyAccessed(memory: AgentMemory): boolean {
  return memory.accessCount >= ACCESS_THRESHOLDS.FREQUENTLY_ACCESSED;
}

/**
 * Check if memory is rarely accessed
 */
export function isRarelyAccessed(memory: AgentMemory): boolean {
  return memory.accessCount <= ACCESS_THRESHOLDS.RARELY_ACCESSED;
}

/**
 * Check if memory is stale (not accessed recently)
 */
export function isStale(
  memory: AgentMemory,
  thresholdDays = ACCESS_THRESHOLDS.STALE_DAYS,
): boolean {
  if (!memory.accessedAt) return true;
  const daysSinceAccess = (Date.now() - memory.accessedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceAccess > thresholdDays;
}

/**
 * Increment access count and update timestamp
 */
export function recordAccess(): Partial<AgentMemory> {
  return {
    accessCount: undefined, // Will be incremented by DB
    accessedAt: new Date(),
  };
}

/**
 * Get access frequency category
 */
export function getAccessFrequency(memory: AgentMemory): 'high' | 'medium' | 'low' {
  if (memory.accessCount >= ACCESS_THRESHOLDS.FREQUENTLY_ACCESSED) return 'high';
  if (memory.accessCount <= ACCESS_THRESHOLDS.RARELY_ACCESSED) return 'low';
  return 'medium';
}

// =============================================================================
// Importance Helpers
// =============================================================================

/**
 * Get memory importance from metadata
 */
export function getImportance(memory: AgentMemory): number {
  return memory.metadata?.importance ?? IMPORTANCE_LEVELS.MEDIUM;
}

/**
 * Check if memory is critical importance
 */
export function isCriticalImportance(memory: AgentMemory): boolean {
  return getImportance(memory) >= IMPORTANCE_LEVELS.CRITICAL;
}

/**
 * Get importance category
 */
export function getImportanceCategory(memory: AgentMemory): 'critical' | 'high' | 'medium' | 'low' {
  const importance = getImportance(memory);
  if (importance >= IMPORTANCE_LEVELS.CRITICAL) return 'critical';
  if (importance >= IMPORTANCE_LEVELS.HIGH) return 'high';
  if (importance >= IMPORTANCE_LEVELS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Calculate composite relevance score
 */
export function calculateRelevanceScore(memory: AgentMemory): number {
  const importance = getImportance(memory);
  const accessFactor = Math.min(memory.accessCount / 100, 1.0) * 0.3;
  const verificationBonus = memory.verified ? 0.2 : 0;
  const stalePenalty = isStale(memory) ? -0.2 : 0;

  return Math.max(0, Math.min(1, importance + accessFactor + verificationBonus + stalePenalty));
}

// =============================================================================
// Embedding Validation
// =============================================================================

/**
 * Check if memory has valid embedding
 */
export function hasValidEmbedding(memory: AgentMemory): boolean {
  if (!memory.embedding) return false;
  return (
    memory.embedding.length === MEMORY_EMBEDDING_CONFIG.DIMENSIONS &&
    memory.embedding.every(
      (val) => val >= MEMORY_EMBEDDING_CONFIG.MIN_VALUE && val <= MEMORY_EMBEDDING_CONFIG.MAX_VALUE,
    )
  );
}

/**
 * Check if memory has embedding metadata
 */
export function hasEmbeddingMetadata(memory: AgentMemory): boolean {
  return memory.embeddingMetadata !== null && memory.embeddingMetadata !== undefined;
}

// =============================================================================
// Scope Helpers
// =============================================================================

/**
 * Check if memory is scoped to a site
 */
export function isSiteScoped(memory: AgentMemory): boolean {
  return memory.siteId !== null && memory.siteId !== undefined;
}

/**
 * Check if memory is scoped to an agent
 */
export function isAgentScoped(memory: AgentMemory): boolean {
  return memory.agentId !== null && memory.agentId !== undefined;
}

/**
 * Check if memory is global (not scoped)
 */
export function isGlobalMemory(memory: AgentMemory): boolean {
  return !(isSiteScoped(memory) || isAgentScoped(memory));
}

// =============================================================================
// Memory Creation
// =============================================================================

/**
 * Create agent memory insert data
 */
export function createAgentMemoryInsert(
  content: string,
  type: MemoryType,
  source: MemorySource,
  options?: {
    id?: string;
    embedding?: number[];
    embeddingMetadata?: EmbeddingMetadata;
    metadata?: MemoryMetadata;
    siteId?: string;
    agentId?: string;
    expiresAt?: Date;
  },
): AgentMemoryInsert {
  const now = new Date();

  return {
    id: options?.id ?? crypto.randomUUID(),
    version: AGENT_MEMORY_SCHEMA_VERSION,
    content,
    type,
    source,
    embedding: options?.embedding ?? null,
    embeddingMetadata: options?.embeddingMetadata ?? null,
    metadata: options?.metadata ?? {},
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
    siteId: options?.siteId ?? null,
    agentId: options?.agentId ?? null,
    createdAt: now,
    expiresAt: options?.expiresAt ?? null,
  };
}

/**
 * Update memory with new data
 */
export function updateAgentMemory(updates: {
  content?: string;
  metadata?: MemoryMetadata;
  embedding?: number[] | null;
  embeddingMetadata?: EmbeddingMetadata | null;
  expiresAt?: Date | null;
}): Partial<AgentMemory> {
  const result: Partial<AgentMemory> = {};

  if (updates.content !== undefined) {
    result.content = updates.content;
  }

  if (updates.metadata !== undefined) {
    result.metadata = updates.metadata;
  }

  if (updates.embedding !== undefined) {
    result.embedding = updates.embedding;
  }

  if (updates.embeddingMetadata !== undefined) {
    result.embeddingMetadata = updates.embeddingMetadata;
  }

  if (updates.expiresAt !== undefined) {
    result.expiresAt = updates.expiresAt;
  }

  return result;
}

// =============================================================================
// Extended Views with Computed Fields
// =============================================================================

/**
 * Agent memory with computed fields for UI display
 */
export interface AgentMemoryWithComputed extends AgentMemory {
  _computed: {
    isExpired: boolean;
    isPermanent: boolean;
    isVerified: boolean;
    needsVerification: boolean;
    hasEmbedding: boolean;
    embeddingValid: boolean;
    accessFrequency: 'high' | 'medium' | 'low';
    isStale: boolean;
    importance: number;
    importanceCategory: 'critical' | 'high' | 'medium' | 'low';
    relevanceScore: number;
    timeUntilExpiration: number | null;
    isSiteScoped: boolean;
    isAgentScoped: boolean;
    isGlobal: boolean;
  };
}

/**
 * Convert agent memory to format with computed fields
 */
export function agentMemoryToHuman(memory: AgentMemory): AgentMemoryWithComputed {
  return {
    ...memory,
    _computed: {
      isExpired: isExpired(memory),
      isPermanent: isPermanent(memory),
      isVerified: isVerified(memory),
      needsVerification: needsVerification(memory),
      hasEmbedding: memory.embedding !== null && memory.embedding !== undefined,
      embeddingValid: hasValidEmbedding(memory),
      accessFrequency: getAccessFrequency(memory),
      isStale: isStale(memory),
      importance: getImportance(memory),
      importanceCategory: getImportanceCategory(memory),
      relevanceScore: calculateRelevanceScore(memory),
      timeUntilExpiration: getTimeUntilExpiration(memory),
      isSiteScoped: isSiteScoped(memory),
      isAgentScoped: isAgentScoped(memory),
      isGlobal: isGlobalMemory(memory),
    },
  };
}

/**
 * Agent memory with metadata for agent/API consumption
 */
export interface AgentMemoryAgent extends AgentMemory {
  agentMetadata: {
    expired: boolean;
    permanent: boolean;
    verified: boolean;
    embeddingPresent: boolean;
    embeddingDimensions: number | null;
    accessCount: number;
    lastAccessed: Date | null;
    relevanceScore: number;
    scope: 'site' | 'agent' | 'global';
  };
}

/**
 * Convert agent memory to agent-compatible format
 */
export function agentMemoryToAgent(memory: AgentMemory): AgentMemoryAgent {
  let scope: 'site' | 'agent' | 'global';
  if (isSiteScoped(memory)) scope = 'site';
  else if (isAgentScoped(memory)) scope = 'agent';
  else scope = 'global';

  return {
    ...memory,
    agentMetadata: {
      expired: isExpired(memory),
      permanent: isPermanent(memory),
      verified: isVerified(memory),
      embeddingPresent: memory.embedding !== null && memory.embedding !== undefined,
      embeddingDimensions: memory.embedding?.length ?? null,
      accessCount: memory.accessCount,
      lastAccessed: memory.accessedAt ?? null,
      relevanceScore: calculateRelevanceScore(memory),
      scope,
    },
  };
}

/**
 * Zod schema for agent memory with computed fields
 */
export const AgentMemoryWithComputedSchema = AgentMemorySchema.and(
  z.object({
    _computed: z.object({
      isExpired: z.boolean(),
      isPermanent: z.boolean(),
      isVerified: z.boolean(),
      needsVerification: z.boolean(),
      hasEmbedding: z.boolean(),
      embeddingValid: z.boolean(),
      accessFrequency: z.enum(['high', 'medium', 'low']),
      isStale: z.boolean(),
      importance: z.number(),
      importanceCategory: z.enum(['critical', 'high', 'medium', 'low']),
      relevanceScore: z.number(),
      timeUntilExpiration: z.number().nullable(),
      isSiteScoped: z.boolean(),
      isAgentScoped: z.boolean(),
      isGlobal: z.boolean(),
    }),
  }),
);

/**
 * Zod schema for agent memory with agent metadata
 */
export const AgentMemoryAgentSchema = AgentMemorySchema.and(
  z.object({
    agentMetadata: z.object({
      expired: z.boolean(),
      permanent: z.boolean(),
      verified: z.boolean(),
      embeddingPresent: z.boolean(),
      embeddingDimensions: z.number().int().nullable(),
      accessCount: z.number().int(),
      lastAccessed: z.date().nullable(),
      relevanceScore: z.number(),
      scope: z.enum(['site', 'agent', 'global']),
    }),
  }),
);
