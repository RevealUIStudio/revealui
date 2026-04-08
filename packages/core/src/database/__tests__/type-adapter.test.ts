/**
 * Tests for Database Type Adapter
 *
 * Validates the conversion functions between database rows,
 * RevealUI document types, and contract-validated entities.
 */

import { createContract } from '@revealui/contracts/foundation';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  createTableAdapter,
  dbRowToContract,
  dbRowToRevealUIDoc,
  revealUIDocToDbInsert,
} from '../type-adapter.js';

// ---------------------------------------------------------------------------
// Test interfaces — realistic shapes that mirror actual DB rows / documents
// ---------------------------------------------------------------------------

interface UserDbRow {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

interface UserDocument {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

interface UserInsert {
  email: string;
  name?: string | null;
  role?: 'admin' | 'editor' | 'viewer';
}

interface PostDbRow {
  id: number;
  title: string;
  body: string;
  published: boolean;
  author_id: string;
  tags: string[];
  created_at: string;
  updated_at: string | null;
}

interface PostDocument {
  id: number;
  title: string;
  body: string;
  published: boolean;
  author_id: string;
  tags: string[];
  created_at: string;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const userRow: UserDbRow = {
  id: 'usr_abc123',
  email: 'alice@example.com',
  name: 'Alice',
  role: 'admin',
  created_at: '2025-01-15T10:30:00.000Z',
  updated_at: '2025-06-01T14:00:00.000Z',
  metadata: { theme: 'dark', locale: 'en-US' },
};

const postRow: PostDbRow = {
  id: 42,
  title: 'Getting Started with RevealUI',
  body: 'RevealUI is an open-source business runtime.',
  published: true,
  author_id: 'usr_abc123',
  tags: ['tutorial', 'revealui'],
  created_at: '2025-03-10T08:00:00.000Z',
  updated_at: null,
};

// ---------------------------------------------------------------------------
// Zod schemas + contracts for validation tests
// ---------------------------------------------------------------------------

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(['admin', 'editor', 'viewer']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

const userContract = createContract({
  name: 'TestUser',
  version: '1.0.0',
  schema: userSchema,
});

const strictSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

const strictContract = createContract({
  name: 'StrictUser',
  version: '1.0.0',
  schema: strictSchema,
});

// ---------------------------------------------------------------------------
// dbRowToRevealUIDoc
// ---------------------------------------------------------------------------

describe('dbRowToRevealUIDoc', () => {
  it('converts a full database row to the target document type', () => {
    const doc = dbRowToRevealUIDoc<UserDocument, UserDbRow>(userRow);

    expect(doc.id).toBe('usr_abc123');
    expect(doc.email).toBe('alice@example.com');
    expect(doc.name).toBe('Alice');
    expect(doc.role).toBe('admin');
    expect(doc.created_at).toBe('2025-01-15T10:30:00.000Z');
    expect(doc.metadata).toEqual({ theme: 'dark', locale: 'en-US' });
  });

  it('preserves null fields', () => {
    const rowWithNulls: UserDbRow = { ...userRow, name: null, metadata: null };
    const doc = dbRowToRevealUIDoc<UserDocument, UserDbRow>(rowWithNulls);

    expect(doc.name).toBeNull();
    expect(doc.metadata).toBeNull();
  });

  it('preserves undefined fields on partial rows', () => {
    // Simulates a SELECT that returns a subset of columns
    const partial = { id: 'usr_abc123', email: 'alice@example.com' };
    const doc = dbRowToRevealUIDoc<Partial<UserDocument>, typeof partial>(partial);

    expect(doc.id).toBe('usr_abc123');
    expect(doc.name).toBeUndefined();
  });

  it('passes through extra fields that exist on the DB row but not on the target type', () => {
    const rowWithExtras = { ...userRow, internal_flag: true, _version: 7 };
    const doc = dbRowToRevealUIDoc<UserDocument, typeof rowWithExtras>(rowWithExtras);

    // The cast does not strip properties — extras remain at runtime
    expect((doc as Record<string, unknown>).internal_flag).toBe(true);
    expect((doc as Record<string, unknown>)._version).toBe(7);
  });

  it('handles Date objects in date fields', () => {
    const rowWithDate = { ...postRow, created_at: new Date('2025-03-10T08:00:00.000Z') };
    const doc = dbRowToRevealUIDoc<PostDocument, typeof rowWithDate>({ ...rowWithDate });

    // The cast preserves the actual runtime type — a Date object, not a string
    expect(doc.created_at).toBeInstanceOf(Date);
  });

  it('handles empty objects', () => {
    const empty = {};
    const doc = dbRowToRevealUIDoc<Record<string, never>, typeof empty>(empty);

    expect(doc).toEqual({});
  });

  it('handles rows with array fields', () => {
    const doc = dbRowToRevealUIDoc<PostDocument, PostDbRow>(postRow);

    expect(doc.tags).toEqual(['tutorial', 'revealui']);
    expect(Array.isArray(doc.tags)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// revealUIDocToDbInsert
// ---------------------------------------------------------------------------

describe('revealUIDocToDbInsert', () => {
  it('converts a document to a database insert type', () => {
    const doc: UserDocument = { ...userRow };
    const insert = revealUIDocToDbInsert<UserDocument, UserInsert>(doc);

    // All original properties survive the cast
    expect(insert.email).toBe('alice@example.com');
  });

  it('preserves all fields even if the insert type is narrower', () => {
    const doc: UserDocument = { ...userRow };
    const insert = revealUIDocToDbInsert<UserDocument, UserInsert>(doc);

    // Runtime object still has all fields from the source doc
    expect((insert as Record<string, unknown>).id).toBe('usr_abc123');
    expect((insert as Record<string, unknown>).created_at).toBe('2025-01-15T10:30:00.000Z');
  });

  it('works with partial documents', () => {
    const partial = { email: 'bob@example.com', role: 'viewer' as const };
    const insert = revealUIDocToDbInsert<typeof partial, UserInsert>(partial);

    expect(insert.email).toBe('bob@example.com');
    expect(insert.role).toBe('viewer');
  });

  it('handles null and undefined values', () => {
    const doc = { email: 'test@example.com', name: null, role: undefined };
    const insert = revealUIDocToDbInsert<typeof doc, UserInsert>(doc);

    expect(insert.name).toBeNull();
    expect(insert.role).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Identity property: dbRowToRevealUIDoc <-> revealUIDocToDbInsert
// ---------------------------------------------------------------------------

describe('identity property (round-trip)', () => {
  it('converting to doc and back preserves all data for a user row', () => {
    const doc = dbRowToRevealUIDoc<UserDocument, UserDbRow>(userRow);
    const backToRow = revealUIDocToDbInsert<UserDocument, UserDbRow>(doc);

    expect(backToRow).toEqual(userRow);
  });

  it('converting to doc and back preserves all data for a post row', () => {
    const doc = dbRowToRevealUIDoc<PostDocument, PostDbRow>(postRow);
    const backToRow = revealUIDocToDbInsert<PostDocument, PostDbRow>(doc);

    expect(backToRow).toEqual(postRow);
  });

  it('round-trip preserves nested objects', () => {
    const row: UserDbRow = {
      ...userRow,
      metadata: { nested: { deep: true }, list: [1, 2, 3] },
    };
    const doc = dbRowToRevealUIDoc<UserDocument, UserDbRow>(row);
    const backToRow = revealUIDocToDbInsert<UserDocument, UserDbRow>(doc);

    expect(backToRow).toEqual(row);
    expect((backToRow.metadata as Record<string, unknown>).nested).toEqual({ deep: true });
  });
});

// ---------------------------------------------------------------------------
// dbRowToContract
// ---------------------------------------------------------------------------

describe('dbRowToContract', () => {
  it('validates and returns a conforming row', () => {
    const result = dbRowToContract(userContract, userRow);

    expect(result.id).toBe('usr_abc123');
    expect(result.email).toBe('alice@example.com');
    expect(result.role).toBe('admin');
  });

  it('throws on invalid data', () => {
    const badRow = { ...userRow, email: 'not-an-email' };

    expect(() => dbRowToContract(userContract, badRow)).toThrow();
  });

  it('throws when required fields are missing', () => {
    const incomplete = { id: 'usr_abc123' };

    expect(() => dbRowToContract(userContract, incomplete)).toThrow();
  });

  it('strips extra fields when schema does not allow passthrough', () => {
    // Zod .object() strips unknown keys by default
    const rowWithExtras = { id: 'usr_1', email: 'a@b.com', bonus: 'gone' };
    const result = dbRowToContract(strictContract, rowWithExtras);

    expect(result.id).toBe('usr_1');
    expect(result.email).toBe('a@b.com');
    expect((result as Record<string, unknown>).bonus).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createTableAdapter
// ---------------------------------------------------------------------------

// Minimal DatabaseLike type for testing
interface TestDatabase {
  public: {
    Tables: {
      users: {
        Row: UserDbRow;
        Insert: UserInsert;
        Update: Partial<UserDbRow>;
      };
      posts: {
        Row: PostDbRow;
        Insert: Omit<PostDbRow, 'id'>;
        Update: Partial<PostDbRow>;
      };
    };
  };
}

describe('createTableAdapter', () => {
  describe('without contract (pass-through mode)', () => {
    const adapter = createTableAdapter<TestDatabase, 'users'>();

    it('toContract returns the row unchanged', () => {
      const result = adapter.toContract(userRow);

      expect(result).toBe(userRow); // Same reference — no cloning
      expect(result.id).toBe('usr_abc123');
    });

    it('toInsert converts row type to insert type', () => {
      const insert = adapter.toInsert(userRow);

      expect(insert.email).toBe('alice@example.com');
    });

    it('toUpdate converts partial row to update type', () => {
      const update = adapter.toUpdate({ name: 'Bob', role: 'editor' });

      expect(update.name).toBe('Bob');
      expect(update.role).toBe('editor');
    });

    it('toUpdate works with empty partial', () => {
      const update = adapter.toUpdate({});

      expect(update).toEqual({});
    });
  });

  describe('with contract (validation mode)', () => {
    // The contract's parse validates the shape at runtime
    const userRowContract = createContract({
      name: 'UserRow',
      version: '1.0.0',
      schema: z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string().nullable(),
        role: z.enum(['admin', 'editor', 'viewer']),
        created_at: z.string().datetime(),
        updated_at: z.string().datetime(),
        metadata: z.record(z.string(), z.unknown()).nullable(),
      }),
    });

    const adapter = createTableAdapter<TestDatabase, 'users'>(userRowContract);

    it('toContract validates and returns a conforming row', () => {
      const result = adapter.toContract(userRow);

      expect(result.id).toBe('usr_abc123');
      expect(result.email).toBe('alice@example.com');
    });

    it('toContract throws on invalid data', () => {
      const badRow: UserDbRow = { ...userRow, email: 'invalid' };

      expect(() => adapter.toContract(badRow)).toThrow();
    });

    it('toInsert still works as pass-through cast', () => {
      const insert = adapter.toInsert(userRow);

      expect(insert.email).toBe('alice@example.com');
    });

    it('toUpdate still works as pass-through cast', () => {
      const update = adapter.toUpdate({ name: 'Updated' });

      expect(update.name).toBe('Updated');
    });
  });

  describe('with post table', () => {
    const adapter = createTableAdapter<TestDatabase, 'posts'>();

    it('toContract returns post row unchanged', () => {
      const result = adapter.toContract(postRow);

      expect(result.title).toBe('Getting Started with RevealUI');
      expect(result.tags).toEqual(['tutorial', 'revealui']);
      expect(result.updated_at).toBeNull();
    });

    it('toInsert handles the post shape', () => {
      const insert = adapter.toInsert(postRow);

      expect(insert.title).toBe('Getting Started with RevealUI');
      expect(insert.published).toBe(true);
    });

    it('toUpdate with a single field', () => {
      const update = adapter.toUpdate({ published: false });

      expect(update.published).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Date handling edge cases
// ---------------------------------------------------------------------------

describe('date handling', () => {
  it('preserves ISO string dates through round-trip', () => {
    const isoDate = '2025-06-15T12:00:00.000Z';
    const row: PostDbRow = { ...postRow, created_at: isoDate };
    const doc = dbRowToRevealUIDoc<PostDocument, PostDbRow>(row);

    expect(doc.created_at).toBe(isoDate);
    expect(typeof doc.created_at).toBe('string');
  });

  it('preserves Date objects through cast (no automatic serialization)', () => {
    const dateObj = new Date('2025-06-15T12:00:00.000Z');
    const row = { ...postRow, created_at: dateObj };
    const doc = dbRowToRevealUIDoc<PostDocument, typeof row>(row);

    // The cast does not convert — the runtime value is still a Date
    expect(doc.created_at).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Missing fields (sparse rows)
// ---------------------------------------------------------------------------

describe('missing fields', () => {
  it('dbRowToRevealUIDoc works with a row that has fewer fields than the target type', () => {
    const sparse = { id: 'usr_sparse', email: 'sparse@example.com' };
    const doc = dbRowToRevealUIDoc<UserDocument, typeof sparse>(sparse);

    expect(doc.id).toBe('usr_sparse');
    expect(doc.email).toBe('sparse@example.com');
    // Fields not present on the source are undefined at runtime
    expect((doc as Record<string, unknown>).name).toBeUndefined();
    expect((doc as Record<string, unknown>).role).toBeUndefined();
  });

  it('revealUIDocToDbInsert works with a sparse document', () => {
    const sparse = { email: 'minimal@example.com' };
    const insert = revealUIDocToDbInsert<typeof sparse, UserInsert>(sparse);

    expect(insert.email).toBe('minimal@example.com');
    expect(insert.name).toBeUndefined();
  });
});
