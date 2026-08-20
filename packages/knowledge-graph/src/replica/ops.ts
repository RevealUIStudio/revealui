/**
 * KgOp parse/validate for the graph.* replica apply path.
 *
 * Remote ops are untrusted JSON. Reject anything that is not a complete
 * convergent primitive before applyOps runs. No authored regex — UUID shape
 * is checked by hyphen-split lengths + a hex charset walk.
 */

import { z } from 'zod';
import { EDGE_RELATIONS, NODE_KINDS } from '../ontology/index.js';
import { EPISODE_TYPES, type KgOp } from '../types.js';

const HEX = new Set('0123456789abcdef');

function isUuid(value: string): boolean {
  const parts = value.split('-');
  if (parts.length !== 5) return false;
  if (
    parts[0]?.length !== 8 ||
    parts[1]?.length !== 4 ||
    parts[2]?.length !== 4 ||
    parts[3]?.length !== 4 ||
    parts[4]?.length !== 12
  ) {
    return false;
  }
  for (const ch of value) {
    if (ch === '-') continue;
    if (!HEX.has(ch)) return false;
  }
  return true;
}

function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

const uuidSchema = z.string().refine(isUuid, { message: 'expected content-addressed UUID' });
const isoSchema = z.string().refine(isIsoTimestamp, { message: 'expected ISO-8601 timestamp' });
const jsonObject = z.record(z.string(), z.unknown());

const episodeRow = z.object({
  id: uuidSchema,
  episode_type: z.enum(EPISODE_TYPES),
  source: z.string().min(1),
  site_id: z.string().min(1),
  content: z.string().nullable(),
  content_ref: jsonObject,
  reference_time: isoSchema,
});

const nodeRow = z.object({
  id: uuidSchema,
  kind: z.enum(NODE_KINDS),
  name: z.string().min(1),
  natural_key: z.string().min(1),
  repo: z.string().nullable(),
  summary: z.string().nullable(),
  search_text: z.string(),
  attributes: jsonObject,
  first_seen_at: isoSchema,
  last_confirmed_at: isoSchema,
  deleted_at: isoSchema.nullable(),
});

const edgeRow = z.object({
  id: uuidSchema,
  source_id: uuidSchema,
  target_id: uuidSchema,
  relation: z.enum(EDGE_RELATIONS),
  fact: z.string().min(1),
  repo: z.string().nullable(),
  attributes: jsonObject,
  valid_at: isoSchema,
  invalid_at: isoSchema.nullable(),
  expired_at: isoSchema.nullable(),
});

const kgOpSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('episode'), id: uuidSchema, row: episodeRow }),
  z.object({ t: z.literal('node'), id: uuidSchema, row: nodeRow }),
  z.object({ t: z.literal('edge'), id: uuidSchema, row: edgeRow, episodeIds: z.array(uuidSchema) }),
  z.object({ t: z.literal('invalidate'), edgeId: uuidSchema, invalidAt: isoSchema }),
  z.object({ t: z.literal('expire'), edgeId: uuidSchema, expiredAt: isoSchema }),
  z.object({ t: z.literal('alias'), alias: z.string().min(1), nodeId: uuidSchema }),
]);

export function parseKgOp(value: unknown): KgOp {
  const parsed = kgOpSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`invalid KgOp: ${parsed.error.issues[0]?.message ?? 'failed validation'}`);
  }
  return parsed.data;
}

export function parseKgOps(value: unknown): KgOp[] {
  if (!Array.isArray(value)) {
    throw new Error('graph.apply ops must be an array');
  }
  return value.map((item, index) => {
    try {
      return parseKgOp(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`ops[${index}]: ${message}`);
    }
  });
}
