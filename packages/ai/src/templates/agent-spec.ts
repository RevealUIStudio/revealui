/**
 * Agent Specification Template
 *
 * Zod-validated schema that every agent MUST satisfy before registration.
 * Encodes security constraints, permission boundaries, guardrails, and
 * quality requirements directly into the type system. Nothing can be
 * registered without passing validation.
 */

import { z } from 'zod';

// ─── Permission Schema ──────────────────────────────────────────────────────

export const AgentPermissionsSchema = z.object({
  /** Explicit whitelist of tool names this agent can use */
  allowedTools: z.array(z.string().min(1)),
  /** Explicit blacklist of tool names (overrides allowedTools) */
  deniedTools: z.array(z.string()).default([]),
  /** Maximum tool calls per single task execution */
  maxToolCallsPerTask: z.number().int().positive().default(50),
  /** Maximum LLM API calls per single task execution */
  maxLLMCallsPerTask: z.number().int().positive().default(20),
  /** Agent IDs this agent is allowed to delegate tasks to */
  canDelegateToAgents: z.array(z.string()).default([]),
  /** Memory types this agent can access */
  canAccessMemoryTypes: z.array(z.enum(['working', 'episodic', 'semantic'])).default([]),
  /** Maximum memory write operations per task */
  maxMemoryWritesPerTask: z.number().int().positive().default(100),
});

export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;

// ─── Security Schema ────────────────────────────────────────────────────────

export const AgentSecuritySchema = z.object({
  /** Actions that require explicit human approval before execution */
  requiresHumanApproval: z.array(z.string()).default([]),
  /** How this agent handles sensitive data */
  sensitiveDataHandling: z.enum(['none', 'read_only', 'full_access']).default('none'),
  /** Whether the agent can make external network requests */
  allowNetworkAccess: z.boolean().default(false),
  /** Whether the agent can read/write to the filesystem */
  allowFileSystemAccess: z.boolean().default(false),
  /** Whether the agent runs in a sandboxed environment */
  sandboxed: z.boolean().default(true),
  /** Maximum data the agent can exfiltrate per task (bytes, 0 = no limit) */
  maxOutputBytes: z.number().int().min(0).default(0),
});

export type AgentSecurity = z.infer<typeof AgentSecuritySchema>;

// ─── Guardrails Schema ──────────────────────────────────────────────────────

export const AgentGuardrailsSchema = z.object({
  /** Maximum tokens in any single LLM response */
  maxResponseTokens: z.number().int().positive().default(4096),
  /** Regex patterns that MUST NOT appear in agent output */
  prohibitedPatterns: z.array(z.string()).default([]),
  /** Required output format (if any) */
  requiredOutputFormat: z.enum(['text', 'json', 'structured']).optional(),
  /** Whether agent outputs must cite their data source */
  mustCiteSource: z.boolean().default(false),
  /** Whether the agent can modify its own specification (should almost always be false) */
  allowSelfModification: z.boolean().default(false),
  /** Maximum task execution time in milliseconds */
  maxExecutionTimeMs: z.number().int().positive().default(120_000),
  /** Maximum number of agentic loop iterations per task */
  maxIterations: z.number().int().positive().default(10),
});

export type AgentGuardrails = z.infer<typeof AgentGuardrailsSchema>;

// ─── Quality Schema ─────────────────────────────────────────────────────────

export const AgentQualitySchema = z.object({
  /** Minimum test coverage percentage required for this agent's code */
  minTestCoverage: z.number().min(0).max(100).optional(),
  /** Number of human reviewers required before changes to this spec */
  requiredReviewers: z.number().int().min(0).default(0),
  /** Whether changes to this spec require a changelog entry */
  changelogRequired: z.boolean().default(false),
});

export type AgentQuality = z.infer<typeof AgentQualitySchema>;

// ─── Full Agent Specification ───────────────────────────────────────────────

export const AgentSpecSchema = z.object({
  /** Unique agent identifier */
  id: z.string().min(1).max(100),
  /** Human-readable agent name */
  name: z.string().min(1).max(100),
  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver (e.g., 1.0.0)'),
  /** What this agent does */
  description: z.string().min(10).max(1000),
  /** System prompt / instructions for the agent */
  instructions: z.string().min(20),
  /** Permission boundaries */
  permissions: AgentPermissionsSchema,
  /** Security constraints */
  security: AgentSecuritySchema,
  /** Behavioral guardrails */
  guardrails: AgentGuardrailsSchema,
  /** Quality requirements */
  quality: AgentQualitySchema,
  /** Who owns this agent spec */
  owner: z.string().min(1),
  /** License tier required */
  tier: z.enum(['free', 'pro', 'enterprise']).default('pro'),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** When this spec was created */
  createdAt: z.date(),
  /** When this spec was last updated */
  updatedAt: z.date(),
});

export type AgentSpec = z.infer<typeof AgentSpecSchema>;

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an agent specification.
 * Returns the validated spec or throws with detailed error messages.
 */
export function validateAgentSpec(input: unknown): AgentSpec {
  return AgentSpecSchema.parse(input);
}

/**
 * Safely validate an agent specification.
 * Returns a result object with either the data or validation errors.
 */
export function safeValidateAgentSpec(
  input: unknown,
): { success: true; data: AgentSpec } | { success: false; errors: string[] } {
  const result = AgentSpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Create a minimal agent spec with sensible defaults.
 * Fills in security, permissions, guardrails, and quality with safe defaults.
 */
export function createAgentSpec(
  partial: Pick<AgentSpec, 'id' | 'name' | 'version' | 'description' | 'instructions' | 'owner'> &
    Partial<AgentSpec>,
): AgentSpec {
  const now = new Date();
  return AgentSpecSchema.parse({
    permissions: {},
    security: {},
    guardrails: {},
    quality: {},
    tags: [],
    tier: 'pro',
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}
