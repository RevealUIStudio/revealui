/**
 * Regex AST Node Schemas
 *
 * Zod schemas modeling the `ret` v0.5.0 regex parser AST.
 * These define DATA SHAPES only; the `ret` parser is NOT imported here.
 * Used by @revealui/scripts analyzers for typed regex pattern analysis.
 *
 * Follows the same z.lazy() + explicit interface pattern as content/index.ts
 * for recursive types (Zod cannot infer recursive types from z.lazy).
 */

import { z } from 'zod/v4';

// =============================================================================
// Node Type Constants (mirrors ret's types enum)
// =============================================================================

export const RetNodeType = {
  ROOT: 0,
  GROUP: 1,
  POSITION: 2,
  SET: 3,
  RANGE: 4,
  REPETITION: 5,
  REFERENCE: 6,
  CHAR: 7,
} as const;

export type RetNodeTypeValue = (typeof RetNodeType)[keyof typeof RetNodeType];

// =============================================================================
// Leaf Nodes (no recursion)
// =============================================================================

export const RetCharSchema = z.object({
  type: z.literal(RetNodeType.CHAR),
  value: z.number(),
});
export type RetChar = z.infer<typeof RetCharSchema>;

export const RetRangeSchema = z.object({
  type: z.literal(RetNodeType.RANGE),
  from: z.number(),
  to: z.number(),
});
export type RetRange = z.infer<typeof RetRangeSchema>;

export const RetPositionSchema = z.object({
  type: z.literal(RetNodeType.POSITION),
  value: z.enum(['$', '^', 'b', 'B']),
});
export type RetPosition = z.infer<typeof RetPositionSchema>;

export const RetReferenceSchema = z.object({
  type: z.literal(RetNodeType.REFERENCE),
  value: z.number(),
});
export type RetReference = z.infer<typeof RetReferenceSchema>;

// =============================================================================
// Recursive Nodes (z.lazy + explicit interfaces)
// =============================================================================

/** All non-root token types */
export type RetToken =
  | RetChar
  | RetRange
  | RetPosition
  | RetReference
  | RetSet
  | RetRepetition
  | RetGroup;

/** Set members: Range, Char, or nested Set */
export type RetSetMember = RetRange | RetChar | RetSet;

export interface RetSet {
  type: typeof RetNodeType.SET;
  set: RetSetMember[];
  not: boolean;
}

export interface RetRepetition {
  type: typeof RetNodeType.REPETITION;
  min: number;
  /** Unbounded quantifiers (+, *) use Infinity */
  max: number;
  value: RetToken;
}

export interface RetGroup {
  type: typeof RetNodeType.GROUP;
  stack?: RetToken[];
  options?: RetToken[][];
  remember: boolean;
  followedBy?: boolean;
  notFollowedBy?: boolean;
  lookBehind?: boolean;
  name?: string;
}

export interface RetRoot {
  type: typeof RetNodeType.ROOT;
  stack?: RetToken[];
  options?: RetToken[][];
  flags?: string[];
}

/** Any regex AST node */
export type RetNode = RetRoot | RetToken;

// =============================================================================
// Recursive Schemas (z.lazy for self-referential types)
// =============================================================================

// Note: Recursive schemas use z.lazy() with ZodTypeAny return types.
// We don't annotate with z.ZodType<T> because Zod v4 can't prove the
// z.lazy() union matches the explicit interface (same pattern as content/index.ts).
// Type safety comes from the explicit interfaces above + casting in consumers.

const RetSetMemberSchema = z.union([
  RetRangeSchema,
  RetCharSchema,
  z.lazy((): z.ZodTypeAny => RetSetSchema),
]);

export const RetSetSchema = z.object({
  type: z.literal(RetNodeType.SET),
  set: z.array(RetSetMemberSchema),
  not: z.boolean(),
});

export const RetTokenSchema = z.union([
  RetCharSchema,
  RetRangeSchema,
  RetPositionSchema,
  RetReferenceSchema,
  z.lazy((): z.ZodTypeAny => RetSetSchema),
  z.lazy((): z.ZodTypeAny => RetRepetitionSchema),
  z.lazy((): z.ZodTypeAny => RetGroupSchema),
]);

// ret uses Infinity for unbounded quantifiers (+, *). Zod v4's z.number()
// rejects Infinity, so we use z.any() with a refinement for the max field.
const numericSchema = z.any().refine((v): v is number => typeof v === 'number');

export const RetRepetitionSchema = z.object({
  type: z.literal(RetNodeType.REPETITION),
  min: z.number(),
  max: numericSchema,
  value: RetTokenSchema,
});

export const RetGroupSchema = z.object({
  type: z.literal(RetNodeType.GROUP),
  stack: z.array(RetTokenSchema).optional(),
  options: z.array(z.array(RetTokenSchema)).optional(),
  remember: z.boolean(),
  followedBy: z.boolean().optional(),
  notFollowedBy: z.boolean().optional(),
  lookBehind: z.boolean().optional(),
  name: z.string().optional(),
});

export const RetRootSchema = z.object({
  type: z.literal(RetNodeType.ROOT),
  stack: z.array(RetTokenSchema).optional(),
  options: z.array(z.array(RetTokenSchema)).optional(),
  flags: z.array(z.string()).optional(),
});
