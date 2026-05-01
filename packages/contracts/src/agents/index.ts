/**
 * Agent Schemas
 *
 * Schemas for AI agent context, memory, and collaboration.
 * These enable the "translator" functionality of RevealUI -
 * letting agents reason about and modify the same state humans interact with.
 *
 * IMPORTANT: These schemas define the DATA STRUCTURES for agent interactions.
 * The actual agent runtime is implemented in @revealui/ai package.
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';
import { type Embedding, EmbeddingSchema } from '../representation/index.js';

// =============================================================================
// Schema Versions
// =============================================================================

export const AGENT_SCHEMA_VERSION = 1;

// =============================================================================
// Agent Context
// =============================================================================

/**
 * Context shared across agent sessions.
 * Stored in ElectricSQL for CRDT sync.
 */
export const AgentContextSchema = z.object({
  /** Unique context ID (sessionId:agentId) */
  id: z.string(),

  /** Schema version */
  version: z.number().int().default(AGENT_SCHEMA_VERSION),

  /** Session this context belongs to */
  sessionId: z.string(),

  /** Agent that owns this context */
  agentId: z.string(),

  /** The context data (JSONB) - structured for the specific agent */
  context: z.record(z.string(), z.unknown()),

  /** Context priority (higher = more important) */
  priority: z.number().min(0).max(1).default(0.5),

  /** When this context expires (for temporary context) */
  expiresAt: z.string().datetime().optional(),

  /** When this context was created */
  createdAt: z.string().datetime(),

  /** When this context was last updated */
  updatedAt: z.string().datetime(),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;

// =============================================================================
// Memory Type
// =============================================================================

export const MemoryTypeSchema = z.enum([
  'fact', // A learned fact
  'preference', // User preference
  'decision', // A decision that was made
  'feedback', // User feedback
  'example', // An example to learn from
  'correction', // A correction to previous behavior
  'skill', // A learned skill or pattern
  'warning', // Something to avoid
]);

export type MemoryType = z.infer<typeof MemoryTypeSchema>;

// =============================================================================
// Memory Source
// =============================================================================

export const MemorySourceSchema = z.object({
  /** Where this memory came from */
  type: z.enum(['user', 'agent', 'system', 'external']),

  /** ID of the source (user ID, agent ID, etc.) */
  id: z.string(),

  /** Context in which it was created */
  context: z.string().optional(),

  /** Confidence in this source (0-1) */
  confidence: z.number().min(0).max(1).default(1),
});

export type MemorySource = z.infer<typeof MemorySourceSchema>;

// =============================================================================
// Agent Memory
// =============================================================================

/**
 * Long-term memory entry for semantic retrieval.
 * Stored in Postgres with pgvector for similarity search.
 */
export const AgentMemorySchema = z.object({
  /** Memory ID */
  id: z.string(),

  /** Schema version */
  version: z.number().int().default(AGENT_SCHEMA_VERSION),

  /** The content of this memory */
  content: z.string().min(1).max(10000),

  /** Memory type for categorization */
  type: MemoryTypeSchema,

  /** Source of this memory */
  source: MemorySourceSchema,

  /** Embedding for semantic search - PROPERLY VALIDATED */
  embedding: EmbeddingSchema.optional(),

  /** Metadata for filtering/retrieval */
  metadata: z.object({
    /** Related site ID */
    siteId: z.string().optional(),
    /** Related page ID */
    pageId: z.string().optional(),
    /** Related block ID */
    blockId: z.string().optional(),
    /** Tags for categorization */
    tags: z.array(z.string()).optional(),
    /** Importance score (0-1) */
    importance: z.number().min(0).max(1).default(0.5),
    /** Expiration time (for temporary memories) */
    expiresAt: z.string().datetime().optional(),
    /** Agent ID for filtering memories by agent */
    agentId: z.string().optional(),
    /** Session ID for associating memories with specific sessions */
    sessionId: z.string().optional(),
    /** Custom metadata */
    custom: z.record(z.string(), z.unknown()).optional(),
  }),

  /** Creation timestamp */
  createdAt: z.string().datetime(),

  /** Last access timestamp (for relevance decay) */
  accessedAt: z.string().datetime(),

  /** Access count (for popularity) */
  accessCount: z.number().int().default(0),

  /** Whether this memory has been verified by a human */
  verified: z.boolean().default(false),
});

export type AgentMemory = z.infer<typeof AgentMemorySchema>;

/**
 * Agent Memory Contract
 *
 * Validates agent memory data with all required fields
 */
export const AgentMemoryContract = createContract({
  name: 'AgentMemory',
  version: '1',
  description: 'Validates agent memory data',
  schema: AgentMemorySchema,
});

// =============================================================================
// Agent Action Record
// =============================================================================

/**
 * A recorded action taken by an agent
 */
export const AgentActionRecordSchema = z.object({
  /** Action ID */
  id: z.string(),

  /** Schema version */
  version: z.number().int().default(AGENT_SCHEMA_VERSION),

  /** Agent that took this action */
  agentId: z.string(),

  /** Session in which action was taken */
  sessionId: z.string(),

  /** Type of action */
  action: z.string(),

  /** Parameters passed to the action */
  params: z.record(z.string(), z.unknown()),

  /** Result of the action */
  result: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    errorCode: z.string().optional(),
  }),

  /** Human intent that triggered this action */
  intent: z
    .object({
      raw: z.string(),
      classified: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),

  /** Affected entities */
  affectedEntities: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
        change: z.enum(['created', 'updated', 'deleted']),
      }),
    )
    .optional(),

  /** Duration in milliseconds */
  durationMs: z.number().int().nonnegative(),

  /** Timestamp */
  timestamp: z.string().datetime(),
});

export type AgentActionRecord = z.infer<typeof AgentActionRecordSchema>;

// =============================================================================
// Conversation Message
// =============================================================================

/**
 * A message in an agent conversation
 */
export const ConversationMessageSchema = z.object({
  /** Message ID */
  id: z.string(),

  /** Role of the sender */
  role: z.enum(['user', 'assistant', 'system', 'tool']),

  /** Message content */
  content: z.string(),

  /** Structured data (for tool calls, etc.) */
  data: z
    .object({
      toolCall: z
        .object({
          name: z.string(),
          params: z.record(z.string(), z.unknown()),
        })
        .optional(),
      toolResult: z
        .object({
          name: z.string(),
          result: z.unknown(),
        })
        .optional(),
      attachments: z
        .array(
          z.object({
            type: z.enum(['image', 'file', 'link']),
            url: z.string(),
            name: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),

  /** Message metadata */
  metadata: z
    .object({
      tokens: z.number().int().optional(),
      model: z.string().optional(),
      latencyMs: z.number().int().optional(),
    })
    .optional(),

  /** Timestamp */
  timestamp: z.string().datetime(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// =============================================================================
// Conversation
// =============================================================================

/**
 * A conversation thread
 */
export const ConversationSchema = z.object({
  /** Conversation ID */
  id: z.string(),

  /** Schema version */
  version: z.number().int().default(AGENT_SCHEMA_VERSION),

  /** Session this conversation belongs to */
  sessionId: z.string(),

  /** User involved in this conversation */
  userId: z.string(),

  /** Agent involved in this conversation */
  agentId: z.string(),

  /** Messages in order */
  messages: z.array(ConversationMessageSchema),

  /** Conversation status */
  status: z.enum(['active', 'paused', 'completed', 'error']).default('active'),

  /** Conversation metadata */
  metadata: z
    .object({
      /** Related site */
      siteId: z.string().optional(),
      /** Related page */
      pageId: z.string().optional(),
      /** Topic/purpose of conversation */
      topic: z.string().optional(),
      /** Summary of conversation */
      summary: z.string().optional(),
      /** Total tokens used */
      totalTokens: z.number().int().optional(),
    })
    .optional(),

  /** Timestamps */
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

// =============================================================================
// Intent Classification
// =============================================================================

/**
 * Intent types that can be classified
 */
export const IntentTypeSchema = z.enum([
  'create', // Create something new
  'edit', // Modify existing
  'delete', // Remove something
  'query', // Ask a question
  'navigate', // Go somewhere
  'style', // Change appearance
  'configure', // Change settings
  'publish', // Make public
  'undo', // Revert action
  'redo', // Redo action
  'help', // Get assistance
  'confirm', // Confirm an action
  'cancel', // Cancel an action
  'unknown', // Could not classify
]);

export type IntentType = z.infer<typeof IntentTypeSchema>;

/**
 * Classified user intent
 */
export const IntentSchema = z.object({
  /** Raw input from user */
  raw: z.string(),

  /** Classified intent type */
  type: IntentTypeSchema,

  /** Specific action within the type */
  action: z.string().optional(),

  /** Extracted entities */
  entities: z
    .array(
      z.object({
        type: z.string(),
        value: z.string(),
        confidence: z.number().min(0).max(1),
        span: z
          .object({
            start: z.number().int(),
            end: z.number().int(),
          })
          .optional(),
      }),
    )
    .optional(),

  /** Overall confidence score */
  confidence: z.number().min(0).max(1),

  /** Alternative interpretations */
  alternatives: z
    .array(
      z.object({
        type: IntentTypeSchema,
        action: z.string().optional(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional(),

  /** Whether this requires confirmation */
  requiresConfirmation: z.boolean().default(false),
});

export type Intent = z.infer<typeof IntentSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Parameter definition for a tool
 * Note: Uses explicit interface to handle recursive type (items, properties)
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean | undefined;
  enum?: string[] | undefined;
  default?: unknown;
  minimum?: number | undefined;
  maximum?: number | undefined;
  pattern?: string | undefined;
  items?: ToolParameter | undefined;
  properties?: Record<string, ToolParameter> | undefined;
}

export const ToolParameterSchema: z.ZodType<ToolParameter> = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string(),
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  default: z.unknown().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  pattern: z.string().optional(),
  items: z.lazy((): z.ZodType<ToolParameter> => ToolParameterSchema).optional(),
  properties: z
    .lazy((): z.ZodType<Record<string, ToolParameter>> => z.record(z.string(), ToolParameterSchema))
    .optional(),
});

/**
 * Definition of a tool an agent can use
 */
export const ToolDefinitionSchema = z.object({
  /** Tool name */
  name: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),

  /** Human-readable description */
  description: z.string().min(10).max(500),

  /** Parameter schema */
  parameters: z.record(z.string(), ToolParameterSchema),

  /** Return type description */
  returns: z
    .object({
      type: z.string(),
      description: z.string(),
    })
    .optional(),

  /** Usage examples */
  examples: z
    .array(
      z.object({
        input: z.record(z.string(), z.unknown()),
        output: z.unknown(),
        description: z.string().optional(),
      }),
    )
    .optional(),

  /** Required capabilities */
  requiredCapabilities: z.array(z.string()).optional(),

  /** Whether this tool is destructive */
  destructive: z.boolean().default(false),

  /** Rate limit (calls per minute) */
  rateLimit: z.number().int().positive().optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// =============================================================================
// Agent Definition
// =============================================================================

/**
 * Definition of an AI agent
 */
export const AgentDefinitionSchema = z.object({
  /** Agent ID */
  id: z.string(),

  /** Schema version */
  version: z.number().int().default(AGENT_SCHEMA_VERSION),

  /** Agent name */
  name: z.string(),

  /** Agent description */
  description: z.string(),

  /** AI model to use */
  model: z.string(),

  /** System prompt */
  systemPrompt: z.string(),

  /** Available tools */
  tools: z.array(ToolDefinitionSchema),

  /** Agent capabilities */
  capabilities: z.array(z.string()),

  /** Temperature for generation */
  temperature: z.number().min(0).max(2).default(0.7),

  /** Max tokens per response */
  maxTokens: z.number().int().positive().default(4096),

  /** Whether this agent can call other agents */
  canDelegateToAgents: z.array(z.string()).optional(),

  /** Rate limits */
  rateLimits: z
    .object({
      requestsPerMinute: z.number().int().positive().optional(),
      tokensPerMinute: z.number().int().positive().optional(),
    })
    .optional(),

  /**
   * Per-call pricing for x402-gated invocations. When set, the A2A handler
   * emits a `pending-payment` task state on the first call without a valid
   * `X-PAYMENT-PAYLOAD` header; the requester pays via x402 and re-submits
   * with proof. Absent/null = the agent does not charge per call (license
   * tier and quota apply instead). See GAP-149.
   *
   * String values to avoid float precision loss; consumers convert to
   * atomic units (USDC = 6 decimals, RVUI = 6 decimals) at the x402
   * emission boundary in `apps/server/src/middleware/x402.ts`.
   */
  pricing: z
    .object({
      /** USDC dollar amount per task invocation (e.g. "0.05"). */
      usdc: z.string(),

      /**
       * Optional RVUI dollar-equivalent price per task invocation. When
       * set, x402 emission advertises RVUI as an alternative settlement
       * currency. Subject to the `RVUI_PAYMENTS_ENABLED` env flag plus
       * the multi-sig + vesting unlock per the project_revealcoin_pre_
       * launch_gates posture; in pre-launch this stays unset in prod and
       * is exercised only on devnet/staging.
       */
      rvui: z.string().optional(),
    })
    .optional(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// =============================================================================
// Memory Item (for ElectricSQL sync)
// =============================================================================

/**
 * Memory item for real-time sync via ElectricSQL
 * Used for working memory and episodic memory sync
 */
export interface MemoryItem {
  id: string;
  userId: string;
  agentId: string;
  content: string;
  context: Record<string, unknown>;
  importance: number;
  createdAt: Date;
  expiresAt?: Date;
}

// =============================================================================
// Agent State
// =============================================================================

/**
 * Complete agent state for a session
 */
export const AgentStateSchema = z.object({
  /** Agent definition */
  agent: AgentDefinitionSchema,

  /** Current context */
  context: AgentContextSchema,

  /** Current conversation */
  conversation: ConversationSchema.optional(),

  /** Recent memories (for context window) */
  recentMemories: z.array(AgentMemorySchema).optional(),

  /** Active entities being worked on */
  focus: z
    .object({
      siteId: z.string().optional(),
      pageId: z.string().optional(),
      blockId: z.string().optional(),
      selection: z.array(z.string()).optional(),
    })
    .optional(),

  /** Current task (if any) */
  currentTask: z
    .object({
      id: z.string(),
      description: z.string(),
      status: z.enum(['pending', 'running', 'completed', 'failed']),
      progress: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new agent context
 */
export function createAgentContext(
  sessionId: string,
  agentId: string,
  context: Record<string, unknown> = {},
): AgentContext {
  const now = new Date().toISOString();
  return {
    id: `${sessionId}:${agentId}`,
    version: AGENT_SCHEMA_VERSION,
    sessionId,
    agentId,
    context,
    priority: 0.5,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a new agent memory
 */
export function createAgentMemory(
  id: string,
  content: string,
  type: MemoryType,
  source: MemorySource,
  metadata?: AgentMemory['metadata'],
  embedding?: Embedding,
): AgentMemory {
  const now = new Date().toISOString();
  return {
    id,
    version: AGENT_SCHEMA_VERSION,
    content,
    type,
    source,
    embedding,
    metadata: metadata || { importance: 0.5 },
    createdAt: now,
    accessedAt: now,
    accessCount: 0,
    verified: false,
  };
}

/**
 * Creates a new conversation
 */
export function createConversation(
  id: string,
  sessionId: string,
  userId: string,
  agentId: string,
  metadata?: Conversation['metadata'],
): Conversation {
  const now = new Date().toISOString();
  return {
    id,
    version: AGENT_SCHEMA_VERSION,
    sessionId,
    userId,
    agentId,
    messages: [],
    status: 'active',
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a conversation message
 */
export function createMessage(
  id: string,
  role: ConversationMessage['role'],
  content: string,
  data?: ConversationMessage['data'],
): ConversationMessage {
  return {
    id,
    role,
    content,
    data,
    timestamp: new Date().toISOString(),
  };
}
