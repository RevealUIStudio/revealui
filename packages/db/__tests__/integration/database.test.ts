/**
 * Database Integration Tests
 *
 * Real PGlite integration tests for CRUD operations, transactions,
 * constraints, and error handling. Uses @electric-sql/pglite for
 * an in-memory PostgreSQL-compatible database  -  no external connection required.
 */

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// PGlite instance shared across this test suite
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();

  // Create tables that mirror the core schema used in tests
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'user',
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT,
      author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'draft',
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}, 30_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  // Clean tables in dependency order before each test
  await db.query('DELETE FROM posts');
  await db.query('DELETE FROM users');
});

// ---------------------------------------------------------------------------
// CRUD  -  Create
// ---------------------------------------------------------------------------

describe('CRUD  -  Create', () => {
  it('inserts a new user and returns it', async () => {
    const result = await db.query<{ id: string; email: string; name: string }>(
      `INSERT INTO users (id, email, name) VALUES ($1, $2, $3) RETURNING id, email, name`,
      ['u1', 'alice@example.com', 'Alice'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe('u1');
    expect(result.rows[0].email).toBe('alice@example.com');
    expect(result.rows[0].name).toBe('Alice');
  });

  it('inserts multiple users in bulk', async () => {
    await db.query(
      `INSERT INTO users (id, email, name) VALUES
        ($1, $2, $3),
        ($4, $5, $6),
        ($7, $8, $9)`,
      [
        'u1',
        'alice@example.com',
        'Alice',
        'u2',
        'bob@example.com',
        'Bob',
        'u3',
        'carol@example.com',
        'Carol',
      ],
    );

    const result = await db.query<{ id: string }>('SELECT id FROM users ORDER BY id');
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('inserts a post linked to an existing user', async () => {
    await db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
      'u1',
      'alice@example.com',
      'Alice',
    ]);

    const result = await db.query<{ id: string; title: string; author_id: string }>(
      `INSERT INTO posts (id, title, content, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, author_id`,
      ['p1', 'Hello World', 'First post body', 'u1'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('Hello World');
    expect(result.rows[0].author_id).toBe('u1');
  });
});

// ---------------------------------------------------------------------------
// CRUD  -  Read
// ---------------------------------------------------------------------------

describe('CRUD  -  Read', () => {
  beforeEach(async () => {
    await db.query(
      `INSERT INTO users (id, email, name, role, status) VALUES
        ($1, $2, $3, $4, $5),
        ($6, $7, $8, $9, $10),
        ($11, $12, $13, $14, $15)`,
      [
        'u1',
        'alice@example.com',
        'Alice',
        'admin',
        'active',
        'u2',
        'bob@example.com',
        'Bob',
        'user',
        'active',
        'u3',
        'carol@example.com',
        'Carol',
        'user',
        'inactive',
      ],
    );
  });

  it('queries a single record by id', async () => {
    const result = await db.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE id = $1',
      ['u1'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].email).toBe('alice@example.com');
  });

  it('queries all records', async () => {
    const result = await db.query<{ id: string }>('SELECT id FROM users');
    expect(result.rows).toHaveLength(3);
  });

  it('queries with a WHERE filter', async () => {
    const result = await db.query<{ id: string; status: string }>(
      'SELECT id, status FROM users WHERE status = $1',
      ['active'],
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((r) => r.status === 'active')).toBe(true);
  });

  it('queries with pagination (LIMIT + OFFSET)', async () => {
    const page1 = await db.query<{ id: string }>(
      'SELECT id FROM users ORDER BY id LIMIT 2 OFFSET 0',
    );
    const page2 = await db.query<{ id: string }>(
      'SELECT id FROM users ORDER BY id LIMIT 2 OFFSET 2',
    );

    expect(page1.rows).toHaveLength(2);
    expect(page2.rows).toHaveLength(1);
    // Pages should be disjoint
    const page1Ids = new Set(page1.rows.map((r) => r.id));
    expect(page2.rows.some((r) => page1Ids.has(r.id))).toBe(false);
  });

  it('queries with ORDER BY descending', async () => {
    const result = await db.query<{ id: string }>('SELECT id FROM users ORDER BY id DESC');
    expect(result.rows.map((r) => r.id)).toEqual(['u3', 'u2', 'u1']);
  });

  it('queries with a JOIN across tables', async () => {
    await db.query(`INSERT INTO posts (id, title, author_id) VALUES ($1, $2, $3), ($4, $5, $6)`, [
      'p1',
      'Post by Alice',
      'u1',
      'p2',
      'Post by Bob',
      'u2',
    ]);

    const result = await db.query<{ post_title: string; author_name: string }>(
      `SELECT p.title AS post_title, u.name AS author_name
         FROM posts p
         JOIN users u ON u.id = p.author_id
        ORDER BY p.id`,
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ post_title: 'Post by Alice', author_name: 'Alice' });
    expect(result.rows[1]).toMatchObject({ post_title: 'Post by Bob', author_name: 'Bob' });
  });
});

// ---------------------------------------------------------------------------
// CRUD  -  Update
// ---------------------------------------------------------------------------

describe('CRUD  -  Update', () => {
  beforeEach(async () => {
    await db.query('INSERT INTO users (id, email, name, status) VALUES ($1, $2, $3, $4)', [
      'u1',
      'alice@example.com',
      'Alice',
      'active',
    ]);
    await db.query('INSERT INTO users (id, email, name, status) VALUES ($1, $2, $3, $4)', [
      'u2',
      'bob@example.com',
      'Bob',
      'active',
    ]);
  });

  it('updates a single record and reflects the change on read', async () => {
    await db.query('UPDATE users SET name = $1 WHERE id = $2', ['Alice Updated', 'u1']);

    const result = await db.query<{ name: string }>('SELECT name FROM users WHERE id = $1', ['u1']);
    expect(result.rows[0].name).toBe('Alice Updated');
  });

  it('updates multiple records matching a condition', async () => {
    await db.query('UPDATE users SET status = $1 WHERE status = $2', ['inactive', 'active']);

    const active = await db.query<{ id: string }>("SELECT id FROM users WHERE status = 'active'");
    const inactive = await db.query<{ id: string }>(
      "SELECT id FROM users WHERE status = 'inactive'",
    );

    expect(active.rows).toHaveLength(0);
    expect(inactive.rows).toHaveLength(2);
  });

  it('returns updated records via RETURNING', async () => {
    const result = await db.query<{ id: string; name: string }>(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name',
      ['Alice v2', 'u1'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Alice v2');
  });
});

// ---------------------------------------------------------------------------
// CRUD  -  Delete
// ---------------------------------------------------------------------------

describe('CRUD  -  Delete', () => {
  beforeEach(async () => {
    await db.query('INSERT INTO users (id, email, name, status) VALUES ($1, $2, $3, $4)', [
      'u1',
      'alice@example.com',
      'Alice',
      'active',
    ]);
    await db.query('INSERT INTO users (id, email, name, status) VALUES ($1, $2, $3, $4)', [
      'u2',
      'bob@example.com',
      'Bob',
      'inactive',
    ]);
    await db.query('INSERT INTO users (id, email, name, status) VALUES ($1, $2, $3, $4)', [
      'u3',
      'carol@example.com',
      'Carol',
      'inactive',
    ]);
  });

  it('deletes a single record by id', async () => {
    await db.query('DELETE FROM users WHERE id = $1', ['u1']);

    const result = await db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', ['u1']);
    expect(result.rows).toHaveLength(0);
  });

  it('deletes multiple records matching a condition', async () => {
    await db.query("DELETE FROM users WHERE status = 'inactive'");

    const remaining = await db.query<{ id: string }>('SELECT id FROM users');
    expect(remaining.rows).toHaveLength(1);
    expect(remaining.rows[0].id).toBe('u1');
  });

  it('cascades deletes to child records', async () => {
    await db.query('INSERT INTO posts (id, title, author_id) VALUES ($1, $2, $3)', [
      'p1',
      'Alice post',
      'u1',
    ]);

    await db.query('DELETE FROM users WHERE id = $1', ['u1']);

    const posts = await db.query<{ id: string }>('SELECT id FROM posts WHERE id = $1', ['p1']);
    expect(posts.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Constraint Validation
// ---------------------------------------------------------------------------

describe('Constraint Validation', () => {
  it('enforces UNIQUE constraint on email', async () => {
    await db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
      'u1',
      'duplicate@example.com',
      'First',
    ]);

    await expect(
      db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
        'u2',
        'duplicate@example.com',
        'Second',
      ]),
    ).rejects.toThrow();
  });

  it('enforces NOT NULL constraint on email', async () => {
    await expect(
      db.query('INSERT INTO users (id, name) VALUES ($1, $2)', ['u1', 'Alice']),
    ).rejects.toThrow();
  });

  it('enforces NOT NULL constraint on name', async () => {
    await expect(
      db.query('INSERT INTO users (id, email) VALUES ($1, $2)', ['u1', 'alice@example.com']),
    ).rejects.toThrow();
  });

  it('enforces FOREIGN KEY constraint on posts.author_id', async () => {
    await expect(
      db.query('INSERT INTO posts (id, title, author_id) VALUES ($1, $2, $3)', [
        'p1',
        'Orphan post',
        'nonexistent-user',
      ]),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Transaction Management
// ---------------------------------------------------------------------------

describe('Transaction Management', () => {
  it('commits a successful transaction', async () => {
    await db.query('BEGIN');
    await db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
      'u1',
      'tx-user@example.com',
      'Tx User',
    ]);
    await db.query('COMMIT');

    const result = await db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', ['u1']);
    expect(result.rows).toHaveLength(1);
  });

  it('rolls back a failed transaction  -  leaves no trace', async () => {
    await db.query('BEGIN');
    await db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
      'u99',
      'rollback@example.com',
      'Rollback User',
    ]);
    await db.query('ROLLBACK');

    const result = await db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', ['u99']);
    expect(result.rows).toHaveLength(0);
  });

  it('rolls back entire transaction on mid-flight constraint error', async () => {
    // Insert a user first so we can hit a UNIQUE violation inside the transaction
    await db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
      'u1',
      'existing@example.com',
      'Existing',
    ]);

    // Now try to insert two rows where the second violates the unique constraint
    await db.query('BEGIN');
    await db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
      'u2',
      'new@example.com',
      'New',
    ]);

    await expect(
      // Duplicate of u1's email  -  should throw and abort the transaction
      db.query('INSERT INTO users (id, email, name) VALUES ($1, $2, $3)', [
        'u3',
        'existing@example.com',
        'Conflict',
      ]),
    ).rejects.toThrow();

    // PGlite aborts the transaction on error; ROLLBACK cleans up the aborted state
    await db.query('ROLLBACK');

    // u2 must not exist since the transaction was rolled back
    const u2 = await db.query<{ id: string }>('SELECT id FROM users WHERE id = $1', ['u2']);
    expect(u2.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Bulk Operations & Data Integrity
// ---------------------------------------------------------------------------

describe('Bulk Operations', () => {
  it('inserts 100 rows and retrieves all of them', async () => {
    // Build a single parameterised INSERT for 100 users
    const values: string[] = [];
    const params: string[] = [];

    for (let i = 1; i <= 100; i++) {
      values.push(`($${(i - 1) * 3 + 1}, $${(i - 1) * 3 + 2}, $${(i - 1) * 3 + 3})`);
      params.push(`u${i}`, `user${i}@example.com`, `User ${i}`);
    }

    await db.query(`INSERT INTO users (id, email, name) VALUES ${values.join(', ')}`, params);

    const result = await db.query<{ id: string }>('SELECT id FROM users');
    expect(result.rows).toHaveLength(100);
  });

  it('returns correct COUNT after batch insert', async () => {
    await db.query(`INSERT INTO users (id, email, name) VALUES ($1, $2, $3), ($4, $5, $6)`, [
      'u1',
      'a@example.com',
      'A',
      'u2',
      'b@example.com',
      'B',
    ]);

    const result = await db.query<{ cnt: string }>('SELECT COUNT(*) AS cnt FROM users');
    expect(Number(result.rows[0].cnt)).toBe(2);
  });
});
