/**
 * Dual Representation Layer
 *
 * Every entity in RevealUI has two faces:
 * 1. Human: Visual, intuitive, natural language
 * 2. Agent: Structured, typed, optimized for reasoning
 *
 * This module provides the types and utilities for bridging both.
 *
 * IMPORTANT: Agent representations are metadata that describe how agents
 * should interact with entities. The actual enforcement happens in the
 * @revealui/actions and @revealui/ai packages at runtime.
 */

import { z } from 'zod/v4'

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Current schema version for the representation layer.
 * Increment when making breaking changes to schemas.
 */
export const REPRESENTATION_SCHEMA_VERSION = 1

// =============================================================================
// Embedding Configuration
// =============================================================================

/**
 * Supported embedding models and their dimensions.
 * Add new models as needed.
 */
export const EMBEDDING_DIMENSIONS = {
  'openai-text-embedding-3-small': 1536,
  'openai-text-embedding-3-large': 3072,
  'openai-text-embedding-ada-002': 1536,
  'cohere-embed-english-v3': 1024,
  'cohere-embed-multilingual-v3': 1024,
  'voyage-large-2': 1536,
  custom: 0, // Variable dimension, must be specified
} as const

export type EmbeddingModel = keyof typeof EMBEDDING_DIMENSIONS

/**
 * Default embedding model and dimension
 */
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = 'openai-text-embedding-3-small'
export const DEFAULT_EMBEDDING_DIMENSION = EMBEDDING_DIMENSIONS[DEFAULT_EMBEDDING_MODEL]

// =============================================================================
// Embedding Schema
// =============================================================================

/**
 * Embedding with model information for proper validation
 */
export const EmbeddingSchema = z
  .object({
    /** The embedding model used */
    model: z.string(),

    /** The embedding vector */
    vector: z.array(z.number()),

    /** Dimension of the vector (for validation) */
    dimension: z.number().int().positive(),

    /** When this embedding was generated */
    generatedAt: z.string().datetime(),
  })
  .refine((data) => data.vector.length === data.dimension, {
    message: 'Embedding vector length must match specified dimension',
  })

export type Embedding = z.infer<typeof EmbeddingSchema>

/**
 * Creates an embedding with validation
 */
export function createEmbedding(
  vector: number[],
  model: string = DEFAULT_EMBEDDING_MODEL,
): Embedding {
  const dimension = vector.length

  // Validate against known models if model is known
  if (model in EMBEDDING_DIMENSIONS) {
    const expectedDimension = EMBEDDING_DIMENSIONS[model as EmbeddingModel]
    // 0 means custom/variable dimension, skip validation
    if (expectedDimension !== 0 && expectedDimension !== dimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${expectedDimension} for model ${model}, got ${dimension}`,
      )
    }
  }

  return {
    model,
    vector,
    dimension,
    generatedAt: new Date().toISOString(),
  }
}

// =============================================================================
// Human Representation
// =============================================================================

/**
 * How an entity appears to humans
 */
export const HumanRepresentationSchema = z.object({
  /** Display name shown in UI */
  label: z.string(),

  /** Natural language description */
  description: z.string().optional(),

  /** Icon identifier (for UI rendering) */
  icon: z.string().optional(),

  /** Color hint for visual distinction */
  color: z.string().optional(),

  /** Preview text (for search results, tooltips) */
  preview: z.string().optional(),

  /** Suggested actions in natural language */
  suggestions: z.array(z.string()).optional(),

  /** Help text for this entity */
  helpText: z.string().optional(),
})

export type HumanRepresentation = z.infer<typeof HumanRepresentationSchema>

// =============================================================================
// Agent Constraint
// =============================================================================

/**
 * A constraint that agents must respect
 */
export const AgentConstraintSchema = z.object({
  /** Constraint type */
  type: z.enum([
    'readonly', // Cannot modify
    'required', // Must have a value
    'immutable', // Cannot change after creation
    'range', // Value must be in range
    'pattern', // Value must match pattern
    'dependency', // Depends on another field
    'capability', // Requires agent capability
    'permission', // Requires user permission
    'custom', // Custom constraint logic
  ]),

  /** Field this constraint applies to (if applicable) */
  field: z.string().optional(),

  /** Constraint parameters */
  params: z.record(z.string(), z.unknown()),

  /** Human-readable explanation of the constraint */
  message: z.string().optional(),
})

export type AgentConstraint = z.infer<typeof AgentConstraintSchema>

// =============================================================================
// Agent Action
// =============================================================================

/**
 * An action that agents can perform on this entity
 */
export const AgentActionDefinitionSchema = z.object({
  /** Action name (machine-readable) */
  name: z.string(),

  /** Human-readable description */
  description: z.string(),

  /** Parameter definitions */
  params: z.record(
    z.string(),
    z.object({
      type: z.string(),
      required: z.boolean().optional(),
      description: z.string().optional(),
      default: z.unknown().optional(),
      enum: z.array(z.string()).optional(),
    }),
  ),

  /** Return type description */
  returns: z
    .object({
      type: z.string(),
      description: z.string().optional(),
    })
    .optional(),

  /** Required capabilities to perform this action */
  requiredCapabilities: z.array(z.string()).optional(),

  /** Side effects of this action */
  sideEffects: z.array(z.string()).optional(),

  /** Whether this action is destructive (defaults to false if not specified) */
  destructive: z.boolean().optional(),
})

export type AgentActionDefinition = z.infer<typeof AgentActionDefinitionSchema>

// =============================================================================
// Agent Relation
// =============================================================================

/**
 * A relationship to another entity
 */
export const AgentRelationSchema = z.object({
  /** Relationship type */
  type: z.enum([
    'parent', // This entity is a child of target
    'child', // This entity is a parent of target
    'sibling', // Same level as target
    'reference', // References target
    'dependency', // Depends on target
    'related', // Generally related
  ]),

  /** Target entity ID */
  targetId: z.string(),

  /** Target entity type */
  targetType: z.string(),

  /** Relationship weight (0-1, for relevance) */
  weight: z.number().min(0).max(1).default(1),

  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type AgentRelation = z.infer<typeof AgentRelationSchema>

// =============================================================================
// Agent Representation
// =============================================================================

/**
 * How an entity appears to AI agents.
 *
 * NOTE: This is metadata that describes how agents SHOULD interact.
 * Actual enforcement happens at runtime in @revealui/actions.
 */
export const AgentRepresentationSchema = z.object({
  /** Semantic type for agent reasoning */
  semanticType: z.string(),

  /** Semantic embedding (for similarity search) */
  embedding: EmbeddingSchema.optional(),

  /** Structured constraints the agent must respect */
  constraints: z.array(AgentConstraintSchema).optional(),

  /** Available actions the agent can take */
  actions: z.array(AgentActionDefinitionSchema).optional(),

  /** Relationships to other entities (for graph reasoning) */
  relations: z.array(AgentRelationSchema).optional(),

  /** Metadata for retrieval/search */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /** Keywords for search/matching */
  keywords: z.array(z.string()).optional(),

  /** Priority/importance score (0-1) */
  priority: z.number().min(0).max(1).optional(),
})

export type AgentRepresentation = z.infer<typeof AgentRepresentationSchema>

// =============================================================================
// Dual Entity
// =============================================================================

/**
 * Base schema for all RevealUI entities with dual representation
 */
export const DualEntitySchema = z.object({
  /** Unique identifier */
  id: z.string(),

  /** Schema version for migrations */
  version: z.number().int().default(REPRESENTATION_SCHEMA_VERSION),

  /** Human-facing representation */
  human: HumanRepresentationSchema,

  /** Agent-facing representation */
  agent: AgentRepresentationSchema,

  /** ISO timestamp of creation */
  createdAt: z.string().datetime(),

  /** ISO timestamp of last update */
  updatedAt: z.string().datetime(),
})

export type DualEntity = z.infer<typeof DualEntitySchema>

// =============================================================================
// Translation Utilities
// =============================================================================

/**
 * Generates a human representation from structured data
 */
export function toHumanRepresentation(data: {
  name?: string
  title?: string
  description?: string
  type?: string
  icon?: string
  color?: string
}): HumanRepresentation {
  return {
    label: data.name || data.title || 'Untitled',
    description: data.description,
    preview: data.description?.slice(0, 100),
    icon: data.icon,
    color: data.color,
  }
}

/**
 * Generates a basic agent representation
 */
export function toAgentRepresentation(
  semanticType: string,
  options?: Partial<Omit<AgentRepresentation, 'semanticType'>>,
): AgentRepresentation {
  return {
    semanticType,
    ...options,
  }
}

/**
 * Creates timestamps for new entities
 */
export function createTimestamps(): { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString()
  return { createdAt: now, updatedAt: now }
}

/**
 * Updates the updatedAt timestamp
 */
export function updateTimestamp(): { updatedAt: string } {
  return { updatedAt: new Date().toISOString() }
}

/**
 * Creates a new version of an entity (for versioned updates)
 */
export function incrementVersion(currentVersion: number): number {
  return currentVersion + 1
}
