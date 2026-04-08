/**
 * Skill Specification Template
 *
 * Zod-validated schema for agent skills. Every skill must declare its
 * inputs/outputs, required permissions, security constraints, and include
 * at least one test case. This ensures quality and security before any
 * skill is activated in production.
 */

import { z } from 'zod';

// ─── Skill Permissions ──────────────────────────────────────────────────────

export const SkillPermissionsSchema = z.object({
  /** Tools this skill requires to function */
  requiredTools: z.array(z.string().min(1)),
  /** Memory access needed */
  requiredMemoryAccess: z.array(z.enum(['working', 'episodic', 'semantic'])).default([]),
  /** Whether this skill needs network access */
  networkRequired: z.boolean().default(false),
  /** Estimated token cost per invocation (for budgeting) */
  estimatedTokenCost: z.number().int().positive().optional(),
});

export type SkillPermissions = z.infer<typeof SkillPermissionsSchema>;

// ─── Skill Security ─────────────────────────────────────────────────────────

export const SkillSecuritySchema = z.object({
  /** Sanitize all inputs before processing */
  sanitizeInput: z.boolean().default(true),
  /** Sanitize all outputs before returning */
  sanitizeOutput: z.boolean().default(true),
  /** Maximum execution time in milliseconds */
  maxExecutionTimeMs: z.number().int().positive().default(30_000),
  /** Whether this skill can be retried on failure */
  retryable: z.boolean().default(true),
  /** Maximum retry attempts */
  maxRetries: z.number().int().min(0).default(3),
  /** Whether this skill handles PII */
  handlesPII: z.boolean().default(false),
  /** Data retention policy for skill outputs */
  dataRetention: z.enum(['none', 'session', 'persistent']).default('session'),
});

export type SkillSecurity = z.infer<typeof SkillSecuritySchema>;

// ─── Test Case Schema ───────────────────────────────────────────────────────

export const SkillTestCaseSchema = z.object({
  /** What this test verifies */
  description: z.string().min(1),
  /** Input parameters */
  input: z.record(z.string(), z.unknown()),
  /** Expected output (for assertion) */
  expectedOutput: z.record(z.string(), z.unknown()).optional(),
  /** Whether this test case should pass or fail */
  shouldPass: z.boolean().default(true),
});

export type SkillTestCase = z.infer<typeof SkillTestCaseSchema>;

// ─── Full Skill Specification ───────────────────────────────────────────────

export const SkillSpecSchema = z.object({
  /** Unique skill identifier */
  id: z.string().min(1).max(100),
  /** Human-readable skill name */
  name: z.string().min(1).max(100),
  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver (e.g., 1.0.0)'),
  /** What this skill does */
  description: z.string().min(10).max(500),
  /** Detailed instructions for how to use this skill */
  usage: z.string().min(10).optional(),

  /** Input parameter schema (JSON Schema-compatible) */
  inputSchema: z.record(z.string(), z.unknown()),
  /** Output schema (JSON Schema-compatible) */
  outputSchema: z.record(z.string(), z.unknown()),

  /** Permission requirements */
  permissions: SkillPermissionsSchema,
  /** Security constraints */
  security: SkillSecuritySchema,

  /** Test cases — at least one required */
  testCases: z.array(SkillTestCaseSchema).min(1, 'At least one test case is required'),

  /** Who created this skill */
  author: z.string().min(1),
  /** License for this skill */
  license: z.string().default('MIT'),
  /** Category for skill catalog */
  category: z.string().min(1),
  /** Tags for search/filtering */
  tags: z.array(z.string()).default([]),
  /** When this spec was created */
  createdAt: z.date(),
  /** When this spec was last updated */
  updatedAt: z.date(),
});

export type SkillSpec = z.infer<typeof SkillSpecSchema>;

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate a skill specification.
 * Returns the validated spec or throws with detailed error messages.
 */
export function validateSkillSpec(input: unknown): SkillSpec {
  return SkillSpecSchema.parse(input);
}

/**
 * Safely validate a skill specification.
 */
export function safeValidateSkillSpec(
  input: unknown,
): { success: true; data: SkillSpec } | { success: false; errors: string[] } {
  const result = SkillSpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Create a skill spec with sensible defaults.
 */
export function createSkillSpec(
  partial: Pick<
    SkillSpec,
    | 'id'
    | 'name'
    | 'version'
    | 'description'
    | 'author'
    | 'category'
    | 'inputSchema'
    | 'outputSchema'
    | 'testCases'
  > &
    Partial<SkillSpec>,
): SkillSpec {
  const now = new Date();
  return SkillSpecSchema.parse({
    permissions: { requiredTools: [] },
    security: {},
    license: 'MIT',
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}
