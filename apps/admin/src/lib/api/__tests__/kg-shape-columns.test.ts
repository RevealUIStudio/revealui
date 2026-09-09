/**
 * Fleet KG Electric shape column allowlists.
 *
 * Hosted Electric rejects generated `search` tsvector columns
 * (`errors.columns`). The proxy must request an explicit `columns=` list
 * that includes primary keys and omits `search` (and `embedding`).
 */

import { describe, expect, it } from 'vitest';
import {
  KG_EDGE_SHAPE_COLUMNS,
  KG_NODE_SHAPE_COLUMNS,
  KG_SHAPE_NEVER_SYNC_COLUMNS,
  setElectricShapeColumns,
} from '../kg-shape-columns';

describe('KG Electric shape columns', () => {
  it('includes node and edge primary keys', () => {
    expect(KG_NODE_SHAPE_COLUMNS).toContain('id');
    expect(KG_EDGE_SHAPE_COLUMNS).toContain('id');
  });

  it('omits generated search and class-3 embedding from both tables', () => {
    expect(KG_SHAPE_NEVER_SYNC_COLUMNS).toEqual(['search', 'embedding']);

    for (const column of KG_SHAPE_NEVER_SYNC_COLUMNS) {
      expect(KG_NODE_SHAPE_COLUMNS).not.toContain(column);
      expect(KG_EDGE_SHAPE_COLUMNS).not.toContain(column);
    }
  });

  it('includes the canvas and list columns the explorer reads', () => {
    expect(KG_NODE_SHAPE_COLUMNS).toEqual(
      expect.arrayContaining([
        'id',
        'kind',
        'name',
        'natural_key',
        'repo',
        'summary',
        'attributes',
        'first_seen_at',
        'last_confirmed_at',
      ]),
    );
    expect(KG_EDGE_SHAPE_COLUMNS).toEqual(
      expect.arrayContaining([
        'id',
        'source_id',
        'target_id',
        'relation',
        'fact',
        'repo',
        'attributes',
        'valid_at',
        'invalid_at',
        'expired_at',
        'created_at',
      ]),
    );
  });

  it('writes a comma-separated columns param without search', () => {
    const url = new URL('http://localhost:5133/v1/shape');
    setElectricShapeColumns(url, KG_NODE_SHAPE_COLUMNS);

    const columns = url.searchParams.get('columns')?.split(',') ?? [];
    expect(columns).toContain('id');
    expect(columns).not.toContain('search');
    expect(columns).not.toContain('embedding');
  });

  it('writes edge columns the same way', () => {
    const url = new URL('http://localhost:5133/v1/shape');
    setElectricShapeColumns(url, KG_EDGE_SHAPE_COLUMNS);

    const columns = url.searchParams.get('columns')?.split(',') ?? [];
    expect(columns).toContain('id');
    expect(columns).toContain('source_id');
    expect(columns).not.toContain('search');
    expect(columns).not.toContain('embedding');
  });
});
