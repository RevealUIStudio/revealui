import { describe, expect, it, vi } from 'vitest';
import type { QueryableDatabaseAdapter, RevealCollectionConfig } from '../../../types/index.js';
import { find } from '../find.js';
import { findByID } from '../findById.js';

const config: RevealCollectionConfig = { slug: 'documents', fields: [] };

describe.each(['find', 'findByID'])('%s document decoding boundary', (operation) => {
  it.each(['[123]', '{"id":"nested"}'])(
    'preserves JSON-looking database identity %s',
    async (id) => {
      const query = vi.fn<QueryableDatabaseAdapter['query']>();
      if (operation === 'find') {
        query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      }
      query.mockResolvedValueOnce({ rows: [{ id, _json: '{"tags":["legacy"]}' }] });
      if (operation === 'find') {
        expect((await find(config, { query }, {})).docs).toEqual([{ id, tags: ['legacy'] }]);
      } else {
        expect(await findByID(config, { query }, { id })).toEqual({ id, tags: ['legacy'] });
      }
    },
  );

  it.each([{ id: 'other' }, '{"id":"other"}'])(
    'rejects extension identity collisions',
    async (_json) => {
      const query = vi.fn<QueryableDatabaseAdapter['query']>();
      if (operation === 'find') {
        query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      }
      query.mockResolvedValueOnce({ rows: [{ id: 'stored', _json }] });
      const result =
        operation === 'find'
          ? find(config, { query }, {})
          : findByID(config, { query }, { id: 'stored' });
      await expect(result).rejects.toThrow();
    },
  );

  it.each(['{broken', '[]', 'null'])(
    'rejects malformed required JSON %s without returning partial data',
    async (_json) => {
      const query = vi.fn<QueryableDatabaseAdapter['query']>();
      if (operation === 'find') {
        query.mockResolvedValueOnce({ rows: [{ total: '2' }] });
        query.mockResolvedValueOnce({
          rows: [
            { id: 'valid', _json: '{}' },
            { id: 'broken', _json },
          ],
        });
      } else {
        query.mockResolvedValueOnce({ rows: [{ id: 'broken', title: 'partial', _json }] });
      }
      const result =
        operation === 'find'
          ? find(config, { query }, {})
          : findByID(config, { query }, { id: 'broken' });
      await expect(result).rejects.toThrow();
    },
  );
});

it('preserves pagination totals from count rows without document identity', async () => {
  const query = vi.fn<QueryableDatabaseAdapter['query']>();
  query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
  query.mockResolvedValueOnce({
    rows: [
      { id: 0, _json: { tags: ['first'] } },
      { id: 'two', meta: '{"legacy":true}' },
    ],
  });
  const result = await find(config, { query }, { limit: 2, page: 2 });
  expect(result).toMatchObject({
    docs: [
      { id: 0, tags: ['first'] },
      { id: 'two', meta: { legacy: true } },
    ],
    totalDocs: 5,
    totalPages: 3,
    pagingCounter: 3,
    hasNextPage: true,
    hasPrevPage: true,
  });
  expect(query).toHaveBeenNthCalledWith(1, 'SELECT COUNT(*) as total FROM "documents"', []);
});
