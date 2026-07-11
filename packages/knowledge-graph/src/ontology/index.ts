/**
 * Ontology — prescribed node kinds, edge relations, and Zod attribute schemas.
 *
 * The prescribed kinds/relations are enum-checked in the DB (see the migration's
 * CHECK constraints for episodes; node/edge kind+relation validation happens
 * here at ingest). Learned entities that fit no prescribed kind land as
 * `concept` / `relates-to` with a `proposedKind` attribute (spec §5), so
 * recurring learned types can be promoted in a later migration.
 *
 * Each node-kind attribute schema (a) validates the `attributes` jsonb and
 * (b) is convertible to JSON Schema to drive local structured-output extraction
 * in P3 (`nodeKindJsonSchema`).
 */

import { z } from 'zod';

// =============================================================================
// Node kinds
// =============================================================================

export const NODE_KINDS = [
  'repo',
  'package',
  'app',
  'file',
  'symbol',
  'dependency',
  'db-table',
  'route',
  'mcp-tool',
  'hook',
  'rule',
  'skill',
  'gap',
  'lane',
  'adr',
  'agent',
  'secret-path',
  'workflow',
  'concept',
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];
export const nodeKindSchema = z.enum(NODE_KINDS);

const NODE_KIND_SET: ReadonlySet<string> = new Set(NODE_KINDS);
export function isNodeKind(value: string): value is NodeKind {
  return NODE_KIND_SET.has(value);
}

// =============================================================================
// Edge relations
// =============================================================================

export const EDGE_RELATIONS = [
  'contains',
  'exports',
  'imports',
  'depends-on',
  'documents',
  'decides',
  'tracks',
  'implements',
  'supersedes',
  'blocks',
  'guards',
  'invokes',
  'stores-in',
  'syncs',
  'mentions',
  'discovered',
  'relates-to',
] as const;

export type EdgeRelation = (typeof EDGE_RELATIONS)[number];
export const edgeRelationSchema = z.enum(EDGE_RELATIONS);

const EDGE_RELATION_SET: ReadonlySet<string> = new Set(EDGE_RELATIONS);
export function isEdgeRelation(value: string): value is EdgeRelation {
  return EDGE_RELATION_SET.has(value);
}

/** The single learned-fallback relation; recurring learned types get promoted later. */
export const LEARNED_RELATION: EdgeRelation = 'relates-to';
/** The single learned-fallback node kind. */
export const LEARNED_KIND: NodeKind = 'concept';

// =============================================================================
// Per-kind attribute schemas
// =============================================================================

/** Attributes common to every node kind; each kind extends this. */
const baseAttributes = z
  .object({
    /** For learned `concept` nodes: the kind an LLM proposed but that is not yet prescribed. */
    proposedKind: z.string().optional(),
  })
  .passthrough();

const pathAttributes = baseAttributes.extend({
  path: z.string().optional(),
});

/**
 * Attribute schema per node kind. Kept permissive (`passthrough`) in P1 —
 * deterministic extractors populate a stable subset; validation guards against
 * gross type errors without rejecting extra keys.
 */
export const nodeAttributeSchemas: Record<NodeKind, z.ZodType> = {
  repo: baseAttributes.extend({ visibility: z.string().optional() }),
  package: baseAttributes.extend({
    version: z.string().optional(),
    private: z.boolean().optional(),
    license: z.string().optional(),
  }),
  app: baseAttributes.extend({ framework: z.string().optional() }),
  file: pathAttributes.extend({ language: z.string().optional() }),
  symbol: pathAttributes.extend({
    symbolKind: z.string().optional(),
    exported: z.boolean().optional(),
  }),
  dependency: baseAttributes.extend({
    version: z.string().optional(),
    scope: z.string().optional(),
  }),
  'db-table': baseAttributes.extend({ tableName: z.string().optional() }),
  route: pathAttributes.extend({
    method: z.string().optional(),
    routeType: z.string().optional(),
  }),
  'mcp-tool': baseAttributes,
  hook: pathAttributes,
  rule: pathAttributes,
  skill: pathAttributes,
  gap: baseAttributes.extend({
    status: z.string().optional(),
    priority: z.string().optional(),
    owner: z.string().optional(),
  }),
  lane: baseAttributes.extend({ state: z.string().optional() }),
  adr: pathAttributes.extend({ date: z.string().optional() }),
  agent: baseAttributes,
  'secret-path': baseAttributes, // NEVER a value, only the path (secrets.md)
  workflow: pathAttributes,
  concept: baseAttributes,
};

export interface AttributeValidation {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/** Validate a node's attributes against its kind schema. */
export function validateNodeAttributes(
  kind: NodeKind,
  attributes: Record<string, unknown> | undefined,
): AttributeValidation {
  const schema = nodeAttributeSchemas[kind];
  const result = schema.safeParse(attributes ?? {});
  if (result.success) return { ok: true, data: result.data as Record<string, unknown> };
  return { ok: false, error: result.error.message };
}

/** JSON Schema for a node kind's attributes (P3 structured-output extraction). */
export function nodeKindJsonSchema(kind: NodeKind): Record<string, unknown> {
  return z.toJSONSchema(nodeAttributeSchemas[kind]) as Record<string, unknown>;
}
