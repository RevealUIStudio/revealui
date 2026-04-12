/**
 * Prompt Specification Template
 *
 * Zod-validated schema for prompt templates. Every prompt must declare
 * its variables, guardrails, security constraints, and include at least
 * one example. This prevents prompt injection, enforces output quality,
 * and ensures all prompts are documented and testable.
 */

import { z } from 'zod';

// ─── Prompt Variable Schema ─────────────────────────────────────────────────

export const PromptVariableSchema = z.object({
  /** Variable name (used in template as {{name}}) */
  name: z.string().min(1).max(50),
  /** Variable type for validation */
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  /** Whether this variable is required */
  required: z.boolean().default(true),
  /** What this variable represents */
  description: z.string().min(1),
  /** Default value if not provided */
  defaultValue: z.unknown().optional(),
  /** Maximum length for string variables */
  maxLength: z.number().int().positive().optional(),
  /** Regex pattern the value must match (strings only) */
  validationPattern: z.string().optional(),
});

export type PromptVariable = z.infer<typeof PromptVariableSchema>;

// ─── Prompt Guardrails ──────────────────────────────────────────────────────

export const PromptGuardrailsSchema = z.object({
  /** Maximum tokens in the rendered prompt (input) */
  maxInputTokens: z.number().int().positive().default(4096),
  /** Maximum tokens in the LLM response (output) */
  maxOutputTokens: z.number().int().positive().default(4096),
  /** Strings/patterns that MUST NOT appear in the prompt or output */
  prohibitedContent: z.array(z.string()).default([]),
  /** Strings that MUST appear in the rendered prompt */
  requiredContent: z.array(z.string()).default([]),
  /** LLM temperature setting */
  temperature: z.number().min(0).max(2).default(0.7),
  /** LLM top-p setting */
  topP: z.number().min(0).max(1).optional(),
  /** Stop sequences */
  stopSequences: z.array(z.string()).default([]),
});

export type PromptGuardrails = z.infer<typeof PromptGuardrailsSchema>;

// ─── Prompt Security ────────────────────────────────────────────────────────

export const PromptSecuritySchema = z.object({
  /** Whether the prompt output may contain executable code */
  allowCodeExecution: z.boolean().default(false),
  /** Whether the prompt may reference external URLs */
  allowExternalUrls: z.boolean().default(false),
  /** How PII in variables is handled */
  piiHandling: z.enum(['none', 'mask', 'redact']).default('none'),
  /** Enable prompt injection protection (escaping, sandboxing) */
  injectionProtection: z.boolean().default(true),
  /** Whether variable values are sanitized before template interpolation */
  sanitizeVariables: z.boolean().default(true),
  /** Maximum number of times this prompt can be called per minute */
  rateLimitPerMinute: z.number().int().positive().optional(),
});

export type PromptSecurity = z.infer<typeof PromptSecuritySchema>;

// ─── Prompt Example Schema ──────────────────────────────────────────────────

export const PromptExampleSchema = z.object({
  /** What this example demonstrates */
  description: z.string().optional(),
  /** Input variable values */
  input: z.record(z.string(), z.unknown()),
  /** Expected output (for testing and documentation) */
  expectedOutput: z.string(),
});

export type PromptExample = z.infer<typeof PromptExampleSchema>;

// ─── Full Prompt Specification ──────────────────────────────────────────────

export const PromptSpecSchema = z.object({
  /** Unique prompt identifier */
  id: z.string().min(1).max(100),
  /** Human-readable prompt name */
  name: z.string().min(1).max(100),
  /** Semantic version */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver (e.g., 1.0.0)'),
  /** What this prompt template does */
  description: z.string().min(10).max(500),

  /** The prompt template string (variables as {{name}}) */
  template: z.string().min(10),
  /** Declared variables used in the template */
  variables: z.array(PromptVariableSchema).default([]),

  /** Behavioral guardrails */
  guardrails: PromptGuardrailsSchema,
  /** Security constraints */
  security: PromptSecuritySchema,

  /** Examples  -  at least one required for documentation and testing */
  examples: z.array(PromptExampleSchema).min(1, 'At least one example is required'),

  /** Who created this prompt */
  author: z.string().min(1),
  /** Category (e.g., 'summarization', 'code-generation', 'analysis') */
  category: z.string().min(1),
  /** Tags for search/filtering */
  tags: z.array(z.string()).default([]),
  /** When this spec was created */
  createdAt: z.date(),
  /** When this spec was last updated */
  updatedAt: z.date(),
});

export type PromptSpec = z.infer<typeof PromptSpecSchema>;

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate a prompt specification.
 * Returns the validated spec or throws with detailed error messages.
 */
export function validatePromptSpec(input: unknown): PromptSpec {
  return PromptSpecSchema.parse(input);
}

/**
 * Safely validate a prompt specification.
 */
export function safeValidatePromptSpec(
  input: unknown,
): { success: true; data: PromptSpec } | { success: false; errors: string[] } {
  const result = PromptSpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

/**
 * Create a prompt spec with sensible defaults.
 */
export function createPromptSpec(
  partial: Pick<
    PromptSpec,
    'id' | 'name' | 'version' | 'description' | 'template' | 'author' | 'category' | 'examples'
  > &
    Partial<PromptSpec>,
): PromptSpec {
  const now = new Date();
  return PromptSpecSchema.parse({
    variables: [],
    guardrails: {},
    security: {},
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  });
}

// ─── Template Rendering ─────────────────────────────────────────────────────

/**
 * Render a prompt template with variable values.
 * Validates variables against the spec before rendering.
 * Applies injection protection if enabled.
 */
export function renderPromptTemplate(
  spec: PromptSpec,
  values: Record<string, unknown>,
): { success: true; rendered: string } | { success: false; errors: string[] } {
  const errors: string[] = [];

  // Validate required variables are present
  for (const variable of spec.variables) {
    if (variable.required && !(variable.name in values)) {
      if (variable.defaultValue === undefined) {
        errors.push(`Missing required variable: ${variable.name}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Build resolved values (with defaults)
  const resolved: Record<string, string> = {};
  for (const variable of spec.variables) {
    const value = values[variable.name] ?? variable.defaultValue;
    let stringValue = String(value ?? '');

    // Sanitize if injection protection is enabled
    if (spec.security.sanitizeVariables) {
      stringValue = sanitizeForTemplate(stringValue);
    }

    // Validate max length
    if (variable.maxLength && stringValue.length > variable.maxLength) {
      errors.push(
        `Variable "${variable.name}" exceeds max length (${stringValue.length} > ${variable.maxLength})`,
      );
    }

    // Validate pattern
    if (variable.validationPattern) {
      const regex = new RegExp(variable.validationPattern);
      if (!regex.test(stringValue)) {
        errors.push(
          `Variable "${variable.name}" does not match pattern: ${variable.validationPattern}`,
        );
      }
    }

    resolved[variable.name] = stringValue;
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Render template
  let rendered = spec.template;
  for (const [name, value] of Object.entries(resolved)) {
    rendered = rendered.replaceAll(`{{${name}}}`, value);
  }

  // Check prohibited content
  for (const pattern of spec.guardrails.prohibitedContent) {
    if (rendered.includes(pattern)) {
      errors.push(`Rendered prompt contains prohibited content: "${pattern}"`);
    }
  }

  // Check required content
  for (const required of spec.guardrails.requiredContent) {
    if (!rendered.includes(required)) {
      errors.push(`Rendered prompt missing required content: "${required}"`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, rendered };
}

/**
 * Basic sanitization to prevent prompt injection via variables.
 * Escapes common injection patterns.
 */
function sanitizeForTemplate(input: string): string {
  return input
    .replace(/\{\{/g, '{ {') // Prevent nested template injection
    .replace(/\}\}/g, '} }')
    .replace(/\n{3,}/g, '\n\n'); // Collapse excessive newlines
}
