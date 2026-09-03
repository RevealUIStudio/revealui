import type { KgEdgeRecord } from '@revealui/sync';
import { describe, expect, it } from 'vitest';
import { isEdgeLiveAt } from './is-edge-live';

function edge(partial: Partial<KgEdgeRecord> & Pick<KgEdgeRecord, 'id'>): KgEdgeRecord {
  return {
    source_id: 'a',
    target_id: 'b',
    relation: 'depends-on',
    fact: 'a depends on b',
    repo: 'revealui',
    attributes: {},
    embedding: null,
    valid_at: '2026-01-01T00:00:00.000Z',
    invalid_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    expired_at: null,
    ...partial,
  };
}

describe('isEdgeLiveAt', () => {
  it('treats a null invalid_at as current when no point-in-time is set', () => {
    expect(isEdgeLiveAt(edge({ id: 'e1' }), null)).toBe(true);
  });

  it('hides invalidated edges from the current view', () => {
    expect(isEdgeLiveAt(edge({ id: 'e1', invalid_at: '2026-06-01T00:00:00.000Z' }), null)).toBe(
      false,
    );
  });

  it('includes an edge that was live at the requested instant', () => {
    const e = edge({
      id: 'e1',
      valid_at: '2026-01-01T00:00:00.000Z',
      invalid_at: '2026-06-01T00:00:00.000Z',
    });
    expect(isEdgeLiveAt(e, new Date('2026-03-01T00:00:00.000Z'))).toBe(true);
  });

  it('excludes an edge not yet valid, or already invalid, at the requested instant', () => {
    const e = edge({
      id: 'e1',
      valid_at: '2026-01-01T00:00:00.000Z',
      invalid_at: '2026-06-01T00:00:00.000Z',
    });
    expect(isEdgeLiveAt(e, new Date('2025-12-01T00:00:00.000Z'))).toBe(false);
    expect(isEdgeLiveAt(e, new Date('2026-06-01T00:00:00.000Z'))).toBe(false);
  });
});
