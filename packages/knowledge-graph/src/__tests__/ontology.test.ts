import { describe, expect, it } from 'vitest';
import {
  EDGE_RELATIONS,
  isEdgeRelation,
  isNodeKind,
  LEARNED_KIND,
  LEARNED_RELATION,
  NODE_KINDS,
  nodeKindJsonSchema,
  validateNodeAttributes,
} from '../ontology/index.js';

describe('ontology enums', () => {
  it('include the prescribed core kinds and relations', () => {
    for (const k of ['repo', 'package', 'file', 'symbol', 'db-table', 'gap', 'secret-path']) {
      expect(NODE_KINDS).toContain(k);
    }
    for (const r of ['contains', 'exports', 'depends-on', 'supersedes', 'blocks']) {
      expect(EDGE_RELATIONS).toContain(r);
    }
    expect(LEARNED_KIND).toBe('concept');
    expect(LEARNED_RELATION).toBe('relates-to');
  });

  it('guards membership', () => {
    expect(isNodeKind('package')).toBe(true);
    expect(isNodeKind('nonsense')).toBe(false);
    expect(isEdgeRelation('imports')).toBe(true);
    expect(isEdgeRelation('nonsense')).toBe(false);
  });
});

describe('validateNodeAttributes', () => {
  it('accepts well-formed attributes and passes through extras', () => {
    const result = validateNodeAttributes('gap', { status: 'open', priority: 'P1', extra: 1 });
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe('open');
  });

  it('rejects the wrong type for a known field', () => {
    const result = validateNodeAttributes('package', { private: 'yes' });
    expect(result.ok).toBe(false);
  });

  it('produces a JSON schema for structured-output extraction', () => {
    expect(nodeKindJsonSchema('symbol')).toHaveProperty('type');
  });
});
