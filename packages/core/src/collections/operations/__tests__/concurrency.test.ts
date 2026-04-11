/**
 * Collection CRUD Concurrency Tests
 *
 * Tests concurrent create/update operations, JSON merge correctness,
 * and edge cases around field hooks under parallel execution.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealCreateOptions,
  RevealUpdateOptions,
} from '../../../types/index.js';
import { create } from '../create.js';
import { findByID } from '../findById.js';
import { update } from '../update.js';

// Mock findByID
vi.mock('../findById', () => ({
  findByID: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockImplementation((pw: string) => `$2b$10$hashed_${pw}`),
  },
}));

// Mock defaultLogger
vi.mock('../../../instance/logger', () => ({
  defaultLogger: { warn: vi.fn() },
}));

describe('Collection CRUD concurrency', () => {
  const mockConfig: RevealCollectionConfig = {
    slug: 'articles',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'body', type: 'richText' },
      { name: 'tags', type: 'array' },
      { name: 'email', type: 'email' },
      { name: 'password', type: 'password' },
    ],
  };

  const mockDb = { query: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Concurrent Creates ──────────────────────────────────────────────

  describe('concurrent creates', () => {
    it('generates unique IDs for simultaneous creates', async () => {
      const ids: string[] = [];

      vi.mocked(findByID).mockImplementation(async (_cfg, _db, opts: { id: string }) => {
        ids.push(opts.id);
        return { id: opts.id, title: 'Test' };
      });
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const creates = Array.from({ length: 10 }, (_, i) =>
        create(
          mockConfig,
          mockDb as never,
          {
            data: { title: `Doc ${i}` },
          } as RevealCreateOptions,
        ),
      );

      await Promise.all(creates);

      // All 10 IDs must be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);

      // All IDs should start with rvl_ prefix
      for (const id of ids) {
        expect(id).toMatch(/^rvl_/);
      }
    });

    it('each create invokes its own DB query', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'any',
        title: 'Test',
      } as never);
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const creates = Array.from({ length: 5 }, (_, i) =>
        create(
          mockConfig,
          mockDb as never,
          {
            data: { title: `Doc ${i}` },
          } as RevealCreateOptions,
        ),
      );

      await Promise.all(creates);

      // Each create fires 1 INSERT query
      expect(mockDb.query).toHaveBeenCalledTimes(5);
      for (const call of mockDb.query.mock.calls) {
        expect(call[0]).toContain('INSERT INTO');
      }
    });
  });

  // ─── Concurrent Updates ──────────────────────────────────────────────

  describe('concurrent updates', () => {
    it('each update fetches _json independently', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        title: 'Updated',
      } as never);

      // With Promise.all, SELECT _json and UPDATE queries interleave unpredictably.
      // Use mockImplementation that responds based on query type.
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT _json')) {
          return { rows: [{ _json: '{"tags":["a"]}' }] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      const updates = Array.from({ length: 3 }, (_, i) =>
        update(
          mockConfig,
          mockDb as never,
          {
            id: 'doc-1',
            data: { title: `Update ${i}` },
          } as RevealUpdateOptions,
        ),
      );

      await Promise.all(updates);

      // 3 updates × 2 queries each = 6 queries
      expect(mockDb.query).toHaveBeenCalledTimes(6);
    });

    it('concurrent updates to different documents do not interfere', async () => {
      const updatedDocs: string[] = [];

      vi.mocked(findByID).mockImplementation(async (_cfg, _db, opts: { id: string }) => {
        updatedDocs.push(opts.id);
        return { id: opts.id, title: 'Updated' };
      });

      // Use query-type-aware mock for concurrent interleaving
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT _json')) {
          return { rows: [{ _json: '{}' }] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      const updates = ['doc-a', 'doc-b', 'doc-c'].map((id) =>
        update(
          mockConfig,
          mockDb as never,
          {
            id,
            data: { title: 'New' },
          } as RevealUpdateOptions,
        ),
      );

      await Promise.all(updates);

      expect(updatedDocs).toContain('doc-a');
      expect(updatedDocs).toContain('doc-b');
      expect(updatedDocs).toContain('doc-c');
    });
  });

  // ─── JSON Merge Correctness ──────────────────────────────────────────

  describe('JSON merge on update', () => {
    it('preserves existing JSON fields not included in update', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        tags: ['new'],
        body: { content: 'existing body' },
      } as never);

      const existingJson = JSON.stringify({
        tags: ['old'],
        body: { content: 'existing body' },
      });

      // Use query-type-aware mock
      mockDb.query.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT _json')) {
          return { rows: [{ _json: existingJson }] } as DatabaseResult;
        }
        return { rows: [] } as DatabaseResult;
      });

      await update(
        mockConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { tags: ['new'] },
        } as RevealUpdateOptions,
      );

      // The UPDATE query's _json value should contain merged data
      const updateCall = mockDb.query.mock.calls[1];
      const updateValues = updateCall?.[1] as unknown[];
      // _json is the last non-id value
      const jsonValue = updateValues?.find((v) => typeof v === 'string' && v.includes('body'));
      expect(jsonValue).toBeDefined();
      const parsed = JSON.parse(jsonValue as string) as Record<string, unknown>;
      expect(parsed.body).toEqual({ content: 'existing body' });
      expect(parsed.tags).toEqual(['new']);
    });

    it('handles null existing _json gracefully', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        tags: ['first'],
      } as never);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ _json: null }],
        } as DatabaseResult)
        .mockResolvedValueOnce({ rows: [] } as DatabaseResult);

      const result = await update(
        mockConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { tags: ['first'] },
        } as RevealUpdateOptions,
      );

      expect(result).toBeDefined();
    });

    it('handles malformed existing _json string', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        tags: ['new'],
      } as never);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ _json: 'not valid json{' }],
        } as DatabaseResult)
        .mockResolvedValueOnce({ rows: [] } as DatabaseResult);

      // Should not throw  -  logs warning and continues with empty JSON
      const result = await update(
        mockConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { tags: ['new'] },
        } as RevealUpdateOptions,
      );

      expect(result).toBeDefined();
    });

    it('handles _json as pre-parsed object (PostgreSQL jsonb)', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'doc-1',
        tags: ['new'],
      } as never);

      // PostgreSQL jsonb driver may return already-parsed objects
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ _json: { tags: ['existing'] } }],
        } as DatabaseResult)
        .mockResolvedValueOnce({ rows: [] } as DatabaseResult);

      const result = await update(
        mockConfig,
        mockDb as never,
        {
          id: 'doc-1',
          data: { tags: ['new'] },
        } as RevealUpdateOptions,
      );

      expect(result).toBeDefined();
    });
  });

  // ─── Field Hook Ordering Under Concurrency ───────────────────────────

  describe('field hooks under concurrency', () => {
    it('beforeValidate hooks run before required field check for each concurrent create', async () => {
      const configWithHook: RevealCollectionConfig = {
        slug: 'posts',
        fields: [
          { name: 'title', type: 'text', required: true },
          {
            name: 'slug',
            type: 'text',
            required: true,
            hooks: {
              beforeValidate: [
                ({ value, data }: { value: unknown; data?: Record<string, unknown> }) => {
                  if (value) return value;
                  const title = data?.title;
                  return typeof title === 'string' ? title.replace(/ /g, '-').toLowerCase() : value;
                },
              ],
            },
          },
        ],
      };

      vi.mocked(findByID).mockImplementation(async (_cfg, _db, opts: { id: string }) => ({
        id: opts.id,
        title: 'Test',
        slug: 'test',
      }));
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      // All creates omit slug  -  hooks must generate it before required check
      const creates = ['Hello World', 'Another Post', 'Third One'].map((title) =>
        create(
          configWithHook,
          mockDb as never,
          {
            data: { title },
          } as RevealCreateOptions,
        ),
      );

      // Should not throw (hooks generate slug before required check)
      const results = await Promise.all(creates);
      expect(results).toHaveLength(3);
    });
  });

  // ─── Password Hashing ────────────────────────────────────────────────

  describe('password hashing during concurrent creates', () => {
    it('hashes each password independently', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'any',
        title: 'Test',
      } as never);
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const creates = ['pass1', 'pass2', 'pass3'].map((pw) =>
        create(
          mockConfig,
          mockDb as never,
          {
            data: { title: 'Test', password: pw },
          } as RevealCreateOptions,
        ),
      );

      await Promise.all(creates);

      // Each INSERT should contain a hashed password
      for (const call of mockDb.query.mock.calls) {
        const values = call[1] as unknown[];
        const hashedValue = values.find((v) => typeof v === 'string' && v.startsWith('$2b$10$'));
        expect(hashedValue).toBeDefined();
      }
    });

    it('does not re-hash already hashed passwords', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'any',
        title: 'Test',
      } as never);
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const alreadyHashed = '$2b$10$already.hashed.password.value';

      await create(
        mockConfig,
        mockDb as never,
        {
          data: { title: 'Test', password: alreadyHashed },
        } as RevealCreateOptions,
      );

      // The INSERT values should contain the original hash unchanged
      const values = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(values).toContain(alreadyHashed);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('create without db returns data with generated ID', async () => {
      const result = await create(mockConfig, null, {
        data: { title: 'No DB' },
      } as RevealCreateOptions);

      expect(result.id).toBeDefined();
      expect(result.title).toBe('No DB');
    });

    it('update without db returns data with provided ID', async () => {
      const result = await update(mockConfig, null, {
        id: 'keep-this',
        data: { title: 'No DB' },
      } as RevealUpdateOptions);

      expect(result.id).toBe('keep-this');
      expect(result.title).toBe('No DB');
    });

    it('update throws when document does not exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      await expect(
        update(
          mockConfig,
          mockDb as never,
          {
            id: 'ghost',
            data: { title: 'Nope' },
          } as RevealUpdateOptions,
        ),
      ).rejects.toThrow('Document with id ghost not found');
    });

    it('create with custom ID uses the provided ID', async () => {
      vi.mocked(findByID).mockResolvedValue({
        id: 'custom-id-123',
        title: 'Custom',
      } as never);
      mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult);

      const result = await create(
        mockConfig,
        mockDb as never,
        {
          data: { id: 'custom-id-123', title: 'Custom' },
        } as RevealCreateOptions,
      );

      expect(result.id).toBe('custom-id-123');
      const insertQuery = mockDb.query.mock.calls[0]?.[0] as string;
      expect(insertQuery).toContain('INSERT INTO');
      const insertValues = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(insertValues?.[0]).toBe('custom-id-123');
    });
  });
});
