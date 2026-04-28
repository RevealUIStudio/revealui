/**
 * A2A (Agent-to-Agent) Protocol Contracts
 *
 * Implements the Google A2A specification as Zod schemas, bound to RevealUI's
 * existing AgentDefinition and ToolDefinition contracts. This enables RevealUI
 * agents to interoperate with any A2A-compatible orchestrator (LangGraph,
 * Google ADK, Vertex AI, etc.).
 *
 * Spec: https://google.github.io/A2A
 *
 * Binding:
 *   AgentDefinition → A2AAgentCard
 *   ToolDefinition  → A2ASkill
 */

import { z } from 'zod/v4';
import type { AgentDefinition, ToolDefinition } from '../agents/index.js';

// =============================================================================
// Agent Card  -  discovery document served at /.well-known/agent.json
// =============================================================================

/**
 * A skill exposed by an A2A agent (maps from ToolDefinition)
 */
export const A2ASkillSchema = z.object({
  /** Unique skill identifier (maps from ToolDefinition.name) */
  id: z.string(),

  /** Human-readable name */
  name: z.string(),

  /** Description of what this skill does */
  description: z.string(),

  /** Categorisation tags */
  tags: z.array(z.string()).optional(),

  /** Example prompts that invoke this skill */
  examples: z.array(z.string()).optional(),

  /** Supported input modalities */
  inputModes: z.array(z.string()).default(['text']),

  /** Supported output modalities */
  outputModes: z.array(z.string()).default(['text']),
});

export type A2ASkill = z.infer<typeof A2ASkillSchema>;

/**
 * Agent capabilities flags
 */
export const A2ACapabilitiesSchema = z.object({
  /** Whether the agent supports SSE streaming via tasks/sendSubscribe */
  streaming: z.boolean().default(false),

  /** Whether the agent can push notifications to a webhook */
  pushNotifications: z.boolean().default(false),

  /** Whether the agent includes full task history in responses */
  stateTransitionHistory: z.boolean().default(false),
});

export type A2ACapabilities = z.infer<typeof A2ACapabilitiesSchema>;

/**
 * Provider information
 */
export const A2AProviderSchema = z.object({
  organization: z.string(),
  url: z.string().url().optional(),
});

export type A2AProvider = z.infer<typeof A2AProviderSchema>;

/**
 * Authentication configuration
 */
export const A2AAuthSchema = z.object({
  /** Supported auth schemes */
  schemes: z.array(z.enum(['Bearer', 'ApiKey', 'OAuth2', 'None'])).default(['Bearer']),

  /** Optional credentials hint (never put actual secrets here) */
  credentials: z.string().nullable().default(null),
});

export type A2AAuth = z.infer<typeof A2AAuthSchema>;

/**
 * A2A Agent Card  -  the full discovery document.
 * Served at /.well-known/agent.json (platform) or
 * /.well-known/agents/:id/agent.json (per-agent).
 */
export const A2AAgentCardSchema = z.object({
  /** Agent display name */
  name: z.string(),

  /** Human-readable description */
  description: z.string(),

  /** The A2A task endpoint URL */
  url: z.string().url(),

  /** Agent Card URL (self-reference) */
  documentationUrl: z.string().url().optional(),

  /** Provider / publisher info */
  provider: A2AProviderSchema.optional(),

  /** Semver version string */
  version: z.string().default('1.0.0'),

  /** Protocol capabilities */
  capabilities: A2ACapabilitiesSchema,

  /** Authentication requirements */
  authentication: A2AAuthSchema,

  /** Accepted input modalities */
  defaultInputModes: z.array(z.string()).default(['text']),

  /** Produced output modalities */
  defaultOutputModes: z.array(z.string()).default(['text']),

  /** Skills this agent exposes */
  skills: z.array(A2ASkillSchema),
});

export type A2AAgentCard = z.infer<typeof A2AAgentCardSchema>;

// =============================================================================
// Task & Message  -  runtime protocol types
// =============================================================================

/**
 * Text part of a message
 */
export const A2ATextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/**
 * Structured data part of a message
 */
export const A2ADataPartSchema = z.object({
  type: z.literal('data'),
  data: z.record(z.string(), z.unknown()),
  mimeType: z.string().optional(),
});

/**
 * File/binary part of a message
 */
export const A2AFilePartSchema = z.object({
  type: z.literal('file'),
  mimeType: z.string(),
  /** Base64-encoded file data */
  data: z.string(),
  /** Optional filename hint */
  name: z.string().optional(),
});

/** Discriminated union of all part types */
export const A2APartSchema = z.discriminatedUnion('type', [
  A2ATextPartSchema,
  A2ADataPartSchema,
  A2AFilePartSchema,
]);

export type A2APart = z.infer<typeof A2APartSchema>;

/**
 * A single message in a task conversation
 */
export const A2AMessageSchema = z.object({
  /** Who authored this message */
  role: z.enum(['user', 'agent']),
  /** Content parts */
  parts: z.array(A2APartSchema),
  /** Optional message-level metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

/**
 * Task lifecycle states
 *
 * - `submitted`        — task created, not yet started
 * - `pending-payment`  — task created, waiting for a valid x402 proof-of-
 *                       payment header before transitioning to `working`.
 *                       Emitted when the agent's `AgentDefinition.pricing`
 *                       is set and no proof was supplied. RevealUI
 *                       extension; not in the upstream Google A2A spec.
 *                       See GAP-149 in revealui-jv for the wiring plan;
 *                       PR 1 (schema-only) introduces the state, PR 2
 *                       wires the handler to emit + accept it.
 * - `working`          — actively running
 * - `input-required`   — waiting for user input
 * - terminal: `completed` | `canceled` | `failed` | `unknown`
 */
export const A2ATaskStateSchema = z.enum([
  'submitted',
  'pending-payment',
  'working',
  'input-required',
  'completed',
  'canceled',
  'failed',
  'unknown',
]);

export type A2ATaskState = z.infer<typeof A2ATaskStateSchema>;

/**
 * Task status snapshot
 */
export const A2ATaskStatusSchema = z.object({
  state: A2ATaskStateSchema,
  message: A2AMessageSchema.optional(),
  timestamp: z.string().datetime(),
});

export type A2ATaskStatus = z.infer<typeof A2ATaskStatusSchema>;

/**
 * An artifact produced by a task
 */
export const A2AArtifactSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(A2APartSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
  index: z.number().int().default(0),
  append: z.boolean().optional(),
  lastChunk: z.boolean().optional(),
});

export type A2AArtifact = z.infer<typeof A2AArtifactSchema>;

/**
 * A complete A2A Task entity
 */
export const A2ATaskSchema = z.object({
  /** Server-assigned task ID */
  id: z.string(),

  /** Optional session ID for grouping related tasks */
  sessionId: z.string().optional(),

  /** Current task status */
  status: A2ATaskStatusSchema,

  /** Produced artifacts (available when state=completed) */
  artifacts: z.array(A2AArtifactSchema).optional(),

  /** Full message history (when stateTransitionHistory=true) */
  history: z.array(A2AMessageSchema).optional(),

  /** Arbitrary task-level metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type A2ATask = z.infer<typeof A2ATaskSchema>;

// =============================================================================
// JSON-RPC 2.0 envelope
// =============================================================================

export const A2AJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type A2AJsonRpcRequest = z.infer<typeof A2AJsonRpcRequestSchema>;

export const A2AJsonRpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

export const A2AJsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: A2AJsonRpcErrorSchema.optional(),
});

export type A2AJsonRpcResponse = z.infer<typeof A2AJsonRpcResponseSchema>;

// =============================================================================
// tasks/send params
// =============================================================================

export const A2ASendTaskParamsSchema = z.object({
  /** Optional task ID (server generates one if omitted) */
  id: z.string().optional(),

  /** Optional session ID */
  sessionId: z.string().optional(),

  /** The initial user message */
  message: A2AMessageSchema,

  /** Arbitrary caller metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type A2ASendTaskParams = z.infer<typeof A2ASendTaskParamsSchema>;

// =============================================================================
// Mapper functions  -  bind A2A spec to RevealUI contracts
// =============================================================================

/**
 * Convert a RevealUI ToolDefinition to an A2A Skill.
 * ToolDefinition.name → Skill.id
 * ToolDefinition.examples[].description → Skill.examples
 */
export function toolDefinitionToSkill(tool: ToolDefinition): A2ASkill {
  return {
    id: tool.name,
    name: tool.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim(),
    description: tool.description,
    tags: tool.requiredCapabilities ?? [],
    examples: tool.examples?.map((e) => e.description ?? JSON.stringify(e.input)).filter(Boolean),
    inputModes: ['text'],
    outputModes: ['text'],
  };
}

/**
 * Convert a RevealUI AgentDefinition to an A2A Agent Card.
 *
 * @param def - The AgentDefinition from @revealui/contracts
 * @param baseUrl - The public base URL of the A2A endpoint (e.g. https://api.revealui.com)
 */
export function agentDefinitionToCard(def: AgentDefinition, baseUrl: string): A2AAgentCard {
  const url = baseUrl.replace(/\/$/, '');
  return {
    name: def.name,
    description: def.description,
    url: `${url}/a2a`,
    documentationUrl: `${url}/docs`,
    provider: {
      organization: 'RevealUI Studio',
      url: 'https://revealui.com',
    },
    version: String(def.version),
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    authentication: {
      schemes: ['Bearer'],
      credentials: null,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    skills: def.tools.map(toolDefinitionToSkill),
  };
}
