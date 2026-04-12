/**
 * Security Rule Schemas
 *
 * Declarative schemas for code-pattern security detection rules.
 * Rules define what to look for and why; detection logic lives in
 * @revealui/scripts/analyzers.
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';

// =============================================================================
// Enums
// =============================================================================

export const SecuritySeveritySchema = z.enum(['error', 'warning', 'info']);
export type SecuritySeverity = z.infer<typeof SecuritySeveritySchema>;

export const SecurityCategorySchema = z.enum([
  'injection',
  'race-condition',
  'denial-of-service',
  'auth',
  'api',
]);
export type SecurityCategory = z.infer<typeof SecurityCategorySchema>;

// =============================================================================
// Issue Location
// =============================================================================

export const IssueLocationSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  snippet: z.string().max(200),
});
export type IssueLocation = z.infer<typeof IssueLocationSchema>;

// =============================================================================
// Security Rule
// =============================================================================

export const SecurityRuleSchema = z.object({
  /** Unique rule identifier (kebab-case) */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** Human-readable title */
  title: z.string().min(5).max(100),
  /** What this rule detects and why it matters */
  description: z.string().min(10).max(500),
  /** Severity level */
  severity: SecuritySeveritySchema,
  /** Security category */
  category: SecurityCategorySchema,
  /** CWE ID if applicable */
  cwe: z
    .string()
    .regex(/^CWE-\d+$/)
    .optional(),
  /** How to fix the issue */
  remediation: z.string().max(500).optional(),
});
export type SecurityRule = z.infer<typeof SecurityRuleSchema>;

// =============================================================================
// Security Finding (rule + location)
// =============================================================================

export const SecurityFindingSchema = z.object({
  rule: SecurityRuleSchema,
  location: IssueLocationSchema,
});
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

// =============================================================================
// Contracts
// =============================================================================

export const SecurityRuleContract = createContract({
  name: 'SecurityRule',
  version: '1',
  description: 'Defines a code-pattern security detection rule',
  schema: SecurityRuleSchema,
});

export const SecurityFindingContract = createContract({
  name: 'SecurityFinding',
  version: '1',
  description: 'A security finding: a rule violation at a specific location',
  schema: SecurityFindingSchema,
});
