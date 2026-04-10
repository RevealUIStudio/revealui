/**
 * Database Edge Case Tests
 *
 * Validates edge-case behavior for the core schema tables:
 * unique constraint violations, foreign key cascades, soft delete semantics,
 * NOT NULL enforcement, default values, and composite indexes.
 *
 * Uses PGlite (in-memory PostgreSQL) — no external connection required.
 */

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let db: PGlite;

// ---------------------------------------------------------------------------
// Setup — create production-equivalent tables
// ---------------------------------------------------------------------------

beforeAll(async () => {
  db = new PGlite();

  // Users table (matches packages/db/src/schema/users.ts)
  await db.query(`
    CREATE TABLE users (
      id                TEXT PRIMARY KEY,
      schema_version    TEXT NOT NULL DEFAULT '1',
      type              TEXT NOT NULL DEFAULT 'human',
      name              TEXT NOT NULL,
      email             TEXT,
      avatar_url        TEXT,
      password          TEXT,
      role              TEXT NOT NULL DEFAULT 'viewer',
      status            TEXT NOT NULL DEFAULT 'active',
      agent_model       TEXT,
      agent_capabilities JSONB,
      agent_config      JSONB,
      email_verified    BOOLEAN NOT NULL DEFAULT false,
      email_verification_token TEXT,
      email_verification_token_expires_at TIMESTAMPTZ,
      email_verified_at TIMESTAMPTZ,
      tos_accepted_at   TIMESTAMPTZ,
      tos_version       TEXT,
      stripe_customer_id TEXT,
      mfa_enabled       BOOLEAN NOT NULL DEFAULT false,
      mfa_secret        TEXT,
      mfa_backup_codes  JSONB,
      mfa_verified_at   TIMESTAMPTZ,
      ssh_key_fingerprint TEXT,
      preferences       JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at    TIMESTAMPTZ,
      deleted_at        TIMESTAMPTZ,
      _json             JSONB DEFAULT '{}'
    )
  `);

  // Unique index on email (matches schema: unconditional unique — not a partial index)
  await db.query('CREATE UNIQUE INDEX users_email_idx ON users (email)');

  // Sessions table (matches packages/db/src/schema/users.ts)
  await db.query(`
    CREATE TABLE sessions (
      id               TEXT PRIMARY KEY,
      schema_version   TEXT NOT NULL DEFAULT '1',
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash       TEXT NOT NULL,
      user_agent       TEXT,
      ip_address       TEXT,
      persistent       BOOLEAN DEFAULT false,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at       TIMESTAMPTZ NOT NULL
    )
  `);

  // Sites table (matches packages/db/src/schema/sites.ts)
  await db.query(`
    CREATE TABLE sites (
      id             TEXT PRIMARY KEY,
      schema_version TEXT NOT NULL DEFAULT '1',
      owner_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      slug           TEXT NOT NULL UNIQUE,
      description    TEXT,
      status         TEXT NOT NULL DEFAULT 'draft',
      theme          JSONB,
      settings       JSONB,
      page_count     INTEGER DEFAULT 0,
      favicon        TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at   TIMESTAMPTZ,
      deleted_at     TIMESTAMPTZ
    )
  `);

  // Site collaborators table (matches packages/db/src/schema/sites.ts)
  await db.query(`
    CREATE TABLE site_collaborators (
      id        TEXT PRIMARY KEY,
      site_id   TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role      TEXT NOT NULL DEFAULT 'viewer',
      added_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
      added_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pages table (matches packages/db/src/schema/pages.ts)
  await db.query(`
    CREATE TABLE pages (
      id             TEXT PRIMARY KEY,
      schema_version TEXT NOT NULL DEFAULT '1',
      site_id        TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      parent_id      TEXT REFERENCES pages(id) ON DELETE CASCADE,
      template_id    TEXT,
      title          TEXT NOT NULL,
      slug           TEXT NOT NULL,
      path           TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'draft',
      blocks         JSONB DEFAULT '[]',
      seo            JSONB,
      block_count    INTEGER DEFAULT 0,
      word_count     INTEGER DEFAULT 0,
      lock           JSONB,
      scheduled_at   TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at   TIMESTAMPTZ
    )
  `);

  // Composite unique index on pages (slug, site_id) — matches schema
  await db.query('CREATE UNIQUE INDEX pages_slug_site_id_idx ON pages (slug, site_id)');

  // Posts table (matches packages/db/src/schema/admin.ts)
  await db.query(`
    CREATE TABLE posts (
      id                TEXT PRIMARY KEY,
      schema_version    TEXT NOT NULL DEFAULT '1',
      title             TEXT NOT NULL,
      slug              TEXT NOT NULL UNIQUE,
      excerpt           TEXT,
      content           JSONB,
      featured_image_id TEXT,
      author_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
      status            TEXT NOT NULL DEFAULT 'draft',
      published         BOOLEAN DEFAULT false,
      meta              JSONB,
      categories        JSONB DEFAULT '[]',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at      TIMESTAMPTZ
    )
  `);
}, 30_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  // Clean in reverse dependency order
  await db.query('DELETE FROM posts');
  await db.query('DELETE FROM pages');
  await db.query('DELETE FROM site_collaborators');
  await db.query('DELETE FROM sites');
  await db.query('DELETE FROM sessions');
  await db.query('DELETE FROM users');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertUser(
  id = 'u1',
  email: string | null = 'alice@test.com',
  name = 'Alice',
): Promise<void> {
  if (email !== null) {
    await db.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [id, name, email]);
  } else {
    await db.query('INSERT INTO users (id, name) VALUES ($1, $2)', [id, name]);
  }
}

async function insertSite(id = 's1', slug = 'my-site', ownerId = 'u1'): Promise<void> {
  await db.query('INSERT INTO sites (id, name, slug, owner_id) VALUES ($1, $2, $3, $4)', [
    id,
    `Site ${id}`,
    slug,
    ownerId,
  ]);
}

async function insertPage(id = 'p1', slug = 'home', siteId = 's1', title = 'Home'): Promise<void> {
  await db.query('INSERT INTO pages (id, site_id, title, slug, path) VALUES ($1, $2, $3, $4, $5)', [
    id,
    siteId,
    title,
    slug,
    `/${slug}`,
  ]);
}

// =============================================================================
// 1. Unique Constraint Violations
// =============================================================================

describe('Unique constraint violations', () => {
  it('rejects duplicate email on users', async () => {
    await insertUser('u1', 'same@test.com');

    await expect(insertUser('u2', 'same@test.com', 'Bob')).rejects.toThrow(/unique|duplicate/i);
  });

  it('allows multiple users with NULL email (NULL != NULL in SQL)', async () => {
    await insertUser('u1', null, 'OAuth User 1');
    await insertUser('u2', null, 'OAuth User 2');

    const result = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE email IS NULL ORDER BY id',
    );
    expect(result.rows).toHaveLength(2);
  });

  it('rejects duplicate slug on sites', async () => {
    await insertUser();
    await insertSite('s1', 'my-site');

    await expect(insertSite('s2', 'my-site')).rejects.toThrow(/unique|duplicate/i);
  });

  it('rejects duplicate (slug, siteId) on pages', async () => {
    await insertUser();
    await insertSite();
    await insertPage('p1', 'about', 's1');

    await expect(insertPage('p2', 'about', 's1', 'About Us')).rejects.toThrow(/unique|duplicate/i);
  });

  it('rejects duplicate slug on posts', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO posts (id, title, slug, author_id) VALUES ('post1', 'First', 'hello-world', 'u1')",
    );

    await expect(
      db.query(
        "INSERT INTO posts (id, title, slug, author_id) VALUES ('post2', 'Second', 'hello-world', 'u1')",
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});

// =============================================================================
// 2. Foreign Key Cascades
// =============================================================================

describe('Foreign key cascades', () => {
  describe('delete user -> sessions cascade deleted', () => {
    it('removes all sessions when user is deleted', async () => {
      await insertUser();
      await db.query(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'u1', 'hash1', NOW() + INTERVAL '1 hour')",
      );
      await db.query(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s2', 'u1', 'hash2', NOW() + INTERVAL '2 hours')",
      );

      await db.query("DELETE FROM users WHERE id = 'u1'");

      const result = await db.query('SELECT COUNT(*) as c FROM sessions');
      expect(Number(result.rows[0]?.c)).toBe(0);
    });
  });

  describe('delete site -> pages cascade deleted', () => {
    it('removes all pages when site is deleted', async () => {
      await insertUser();
      await insertSite();
      await insertPage('p1', 'home', 's1');
      await insertPage('p2', 'about', 's1');
      await insertPage('p3', 'contact', 's1');

      await db.query("DELETE FROM sites WHERE id = 's1'");

      const result = await db.query('SELECT COUNT(*) as c FROM pages');
      expect(Number(result.rows[0]?.c)).toBe(0);
    });

    it('cascades through parent page hierarchy (nested pages)', async () => {
      await insertUser();
      await insertSite();
      await insertPage('p1', 'docs', 's1', 'Docs');
      await db.query(
        "INSERT INTO pages (id, site_id, parent_id, title, slug, path) VALUES ('p2', 's1', 'p1', 'Getting Started', 'getting-started', '/docs/getting-started')",
      );

      // Deleting the site removes parent AND child
      await db.query("DELETE FROM sites WHERE id = 's1'");

      const result = await db.query('SELECT COUNT(*) as c FROM pages');
      expect(Number(result.rows[0]?.c)).toBe(0);
    });
  });

  describe('delete site -> collaborators cascade deleted', () => {
    it('removes all collaborators when site is deleted', async () => {
      await insertUser('u1', 'alice@test.com', 'Alice');
      await insertUser('u2', 'bob@test.com', 'Bob');
      await insertSite();
      await db.query(
        "INSERT INTO site_collaborators (id, site_id, user_id, role, added_by) VALUES ('sc1', 's1', 'u2', 'editor', 'u1')",
      );

      await db.query("DELETE FROM sites WHERE id = 's1'");

      const result = await db.query('SELECT COUNT(*) as c FROM site_collaborators');
      expect(Number(result.rows[0]?.c)).toBe(0);
    });
  });

  describe('delete user -> cascades to owned sites and their dependents', () => {
    it('removes user, their sites, pages, and collaborators', async () => {
      await insertUser('u1', 'alice@test.com', 'Alice');
      await insertUser('u2', 'bob@test.com', 'Bob');
      await insertSite('s1', 'alice-site', 'u1');
      await insertPage('p1', 'home', 's1');
      await db.query(
        "INSERT INTO site_collaborators (id, site_id, user_id, role) VALUES ('sc1', 's1', 'u2', 'viewer')",
      );

      // Deleting the owner cascades through sites -> pages + collaborators
      await db.query("DELETE FROM users WHERE id = 'u1'");

      const sites = await db.query('SELECT COUNT(*) as c FROM sites');
      const pages = await db.query('SELECT COUNT(*) as c FROM pages');
      const collabs = await db.query('SELECT COUNT(*) as c FROM site_collaborators');

      expect(Number(sites.rows[0]?.c)).toBe(0);
      expect(Number(pages.rows[0]?.c)).toBe(0);
      expect(Number(collabs.rows[0]?.c)).toBe(0);
    });
  });

  describe('posts.author_id uses SET NULL on delete', () => {
    it('sets author_id to NULL when author is deleted (not cascade)', async () => {
      await insertUser();
      await db.query(
        "INSERT INTO posts (id, title, slug, author_id) VALUES ('post1', 'My Post', 'my-post', 'u1')",
      );

      await db.query("DELETE FROM users WHERE id = 'u1'");

      // Post still exists, but author_id is NULL
      const result = await db.query<{ id: string; author_id: string | null }>(
        "SELECT id, author_id FROM posts WHERE id = 'post1'",
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.author_id).toBeNull();
    });
  });

  describe('site_collaborators.added_by uses SET NULL on delete', () => {
    it('sets added_by to NULL when the adding user is deleted', async () => {
      await insertUser('u1', 'alice@test.com', 'Alice');
      await insertUser('u2', 'bob@test.com', 'Bob');
      await insertUser('u3', 'carol@test.com', 'Carol');
      await insertSite('s1', 'team-site', 'u3'); // u3 owns the site
      await db.query(
        "INSERT INTO site_collaborators (id, site_id, user_id, role, added_by) VALUES ('sc1', 's1', 'u2', 'editor', 'u1')",
      );

      // Delete the user who added the collaborator (u1)
      await db.query("DELETE FROM users WHERE id = 'u1'");

      const result = await db.query<{ added_by: string | null }>(
        "SELECT added_by FROM site_collaborators WHERE id = 'sc1'",
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.added_by).toBeNull();
    });
  });

  describe('parent page cascade', () => {
    it('deletes child pages when parent page is deleted', async () => {
      await insertUser();
      await insertSite();
      await insertPage('p1', 'docs', 's1', 'Docs');
      await db.query(
        "INSERT INTO pages (id, site_id, parent_id, title, slug, path) VALUES ('p2', 's1', 'p1', 'Intro', 'intro', '/docs/intro')",
      );
      await db.query(
        "INSERT INTO pages (id, site_id, parent_id, title, slug, path) VALUES ('p3', 's1', 'p1', 'API', 'api', '/docs/api')",
      );

      await db.query("DELETE FROM pages WHERE id = 'p1'");

      const result = await db.query('SELECT COUNT(*) as c FROM pages');
      expect(Number(result.rows[0]?.c)).toBe(0);
    });
  });
});

// =============================================================================
// 3. Soft Delete Semantics
// =============================================================================

describe('Soft delete semantics', () => {
  it('soft-deleted users still occupy the email unique slot (schema behavior)', async () => {
    await insertUser('u1', 'alice@test.com');

    // Soft-delete the user
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = 'u1'");

    // Attempting to create a new user with the same email should fail
    // because the unique index is unconditional (no WHERE deleted_at IS NULL)
    await expect(insertUser('u2', 'alice@test.com', 'Alice 2')).rejects.toThrow(
      /unique|duplicate/i,
    );
  });

  it('soft-deleted user is still queryable (not physically removed)', async () => {
    await insertUser();
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = 'u1'");

    const result = await db.query<{ id: string; deleted_at: Date }>(
      "SELECT id, deleted_at FROM users WHERE id = 'u1'",
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.deleted_at).toBeInstanceOf(Date);
  });

  it('application-level query excludes soft-deleted users', async () => {
    await insertUser('u1', 'alice@test.com', 'Alice');
    await insertUser('u2', 'bob@test.com', 'Bob');
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = 'u1'");

    // Simulating the application-level query pattern: WHERE deleted_at IS NULL
    const active = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE deleted_at IS NULL ORDER BY id',
    );
    expect(active.rows).toHaveLength(1);
    expect(active.rows[0]?.id).toBe('u2');
  });

  it('soft-deleted site retains its slug uniqueness', async () => {
    await insertUser();
    await insertSite('s1', 'my-site');
    await db.query("UPDATE sites SET deleted_at = NOW() WHERE id = 's1'");

    // Same slug should fail — unique constraint is unconditional
    await expect(insertSite('s2', 'my-site')).rejects.toThrow(/unique|duplicate/i);
  });

  it('can restore a soft-deleted user by clearing deleted_at', async () => {
    await insertUser();
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = 'u1'");

    // Restore
    await db.query("UPDATE users SET deleted_at = NULL WHERE id = 'u1'");

    const result = await db.query<{ deleted_at: Date | null }>(
      "SELECT deleted_at FROM users WHERE id = 'u1'",
    );
    expect(result.rows[0]?.deleted_at).toBeNull();
  });
});

// =============================================================================
// 4. NOT NULL Violations
// =============================================================================

describe('NOT NULL violations', () => {
  describe('users table', () => {
    it('rejects user without name', async () => {
      await expect(
        db.query("INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')"),
      ).rejects.toThrow(/null/i);
    });

    it('allows user without email (OAuth-only)', async () => {
      await db.query("INSERT INTO users (id, name) VALUES ('u1', 'OAuth User')");
      const result = await db.query<{ email: string | null }>(
        "SELECT email FROM users WHERE id = 'u1'",
      );
      expect(result.rows[0]?.email).toBeNull();
    });
  });

  describe('sites table', () => {
    it('rejects site without name', async () => {
      await insertUser();
      await expect(
        db.query("INSERT INTO sites (id, slug, owner_id) VALUES ('s1', 'my-site', 'u1')"),
      ).rejects.toThrow(/null/i);
    });

    it('rejects site without slug', async () => {
      await insertUser();
      await expect(
        db.query("INSERT INTO sites (id, name, owner_id) VALUES ('s1', 'My Site', 'u1')"),
      ).rejects.toThrow(/null/i);
    });

    it('rejects site without owner_id', async () => {
      await expect(
        db.query("INSERT INTO sites (id, name, slug) VALUES ('s1', 'My Site', 'my-site')"),
      ).rejects.toThrow(/null/i);
    });
  });

  describe('pages table', () => {
    it('rejects page without title', async () => {
      await insertUser();
      await insertSite();
      await expect(
        db.query(
          "INSERT INTO pages (id, site_id, slug, path) VALUES ('p1', 's1', 'home', '/home')",
        ),
      ).rejects.toThrow(/null/i);
    });

    it('rejects page without slug', async () => {
      await insertUser();
      await insertSite();
      await expect(
        db.query(
          "INSERT INTO pages (id, site_id, title, path) VALUES ('p1', 's1', 'Home', '/home')",
        ),
      ).rejects.toThrow(/null/i);
    });

    it('rejects page without path', async () => {
      await insertUser();
      await insertSite();
      await expect(
        db.query(
          "INSERT INTO pages (id, site_id, title, slug) VALUES ('p1', 's1', 'Home', 'home')",
        ),
      ).rejects.toThrow(/null/i);
    });

    it('rejects page without site_id', async () => {
      await expect(
        db.query(
          "INSERT INTO pages (id, title, slug, path) VALUES ('p1', 'Home', 'home', '/home')",
        ),
      ).rejects.toThrow(/null/i);
    });
  });

  describe('posts table', () => {
    it('rejects post without title', async () => {
      await expect(
        db.query("INSERT INTO posts (id, slug) VALUES ('p1', 'my-post')"),
      ).rejects.toThrow(/null/i);
    });

    it('rejects post without slug', async () => {
      await expect(
        db.query("INSERT INTO posts (id, title) VALUES ('p1', 'My Post')"),
      ).rejects.toThrow(/null/i);
    });
  });

  describe('sessions table', () => {
    it('rejects session without token_hash', async () => {
      await insertUser();
      await expect(
        db.query(
          "INSERT INTO sessions (id, user_id, expires_at) VALUES ('s1', 'u1', NOW() + INTERVAL '1 hour')",
        ),
      ).rejects.toThrow(/null/i);
    });

    it('rejects session without expires_at', async () => {
      await insertUser();
      await expect(
        db.query("INSERT INTO sessions (id, user_id, token_hash) VALUES ('s1', 'u1', 'hash')"),
      ).rejects.toThrow(/null/i);
    });
  });
});

// =============================================================================
// 5. Default Values
// =============================================================================

describe('Default values', () => {
  it('users.status defaults to "active"', async () => {
    await insertUser();
    const result = await db.query<{ status: string }>("SELECT status FROM users WHERE id = 'u1'");
    expect(result.rows[0]?.status).toBe('active');
  });

  it('users.role defaults to "viewer"', async () => {
    await insertUser();
    const result = await db.query<{ role: string }>("SELECT role FROM users WHERE id = 'u1'");
    expect(result.rows[0]?.role).toBe('viewer');
  });

  it('users.type defaults to "human"', async () => {
    await insertUser();
    const result = await db.query<{ type: string }>("SELECT type FROM users WHERE id = 'u1'");
    expect(result.rows[0]?.type).toBe('human');
  });

  it('sites.status defaults to "draft"', async () => {
    await insertUser();
    await insertSite();
    const result = await db.query<{ status: string }>("SELECT status FROM sites WHERE id = 's1'");
    expect(result.rows[0]?.status).toBe('draft');
  });

  it('pages.status defaults to "draft"', async () => {
    await insertUser();
    await insertSite();
    await insertPage();
    const result = await db.query<{ status: string }>("SELECT status FROM pages WHERE id = 'p1'");
    expect(result.rows[0]?.status).toBe('draft');
  });

  it('posts.status defaults to "draft"', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO posts (id, title, slug, author_id) VALUES ('post1', 'Test', 'test', 'u1')",
    );
    const result = await db.query<{ status: string }>(
      "SELECT status FROM posts WHERE id = 'post1'",
    );
    expect(result.rows[0]?.status).toBe('draft');
  });

  it('posts.published defaults to false', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO posts (id, title, slug, author_id) VALUES ('post1', 'Test', 'test', 'u1')",
    );
    const result = await db.query<{ published: boolean }>(
      "SELECT published FROM posts WHERE id = 'post1'",
    );
    expect(result.rows[0]?.published).toBe(false);
  });

  it('users.created_at defaults to now', async () => {
    const before = new Date();
    await insertUser();
    const after = new Date();

    const result = await db.query<{ created_at: Date }>(
      "SELECT created_at FROM users WHERE id = 'u1'",
    );
    const createdAt = result.rows[0]?.created_at;
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(createdAt!.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('sites.created_at defaults to now', async () => {
    await insertUser();
    const before = new Date();
    await insertSite();
    const after = new Date();

    const result = await db.query<{ created_at: Date }>(
      "SELECT created_at FROM sites WHERE id = 's1'",
    );
    const createdAt = result.rows[0]?.created_at;
    expect(createdAt).toBeInstanceOf(Date);
    expect(createdAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(createdAt!.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('pages.blocks defaults to empty array', async () => {
    await insertUser();
    await insertSite();
    await insertPage();

    const result = await db.query<{ blocks: unknown[] }>(
      "SELECT blocks FROM pages WHERE id = 'p1'",
    );
    expect(result.rows[0]?.blocks).toEqual([]);
  });

  it('users.schema_version defaults to "1"', async () => {
    await insertUser();
    const result = await db.query<{ schema_version: string }>(
      "SELECT schema_version FROM users WHERE id = 'u1'",
    );
    expect(result.rows[0]?.schema_version).toBe('1');
  });

  it('users.email_verified defaults to false', async () => {
    await insertUser();
    const result = await db.query<{ email_verified: boolean }>(
      "SELECT email_verified FROM users WHERE id = 'u1'",
    );
    expect(result.rows[0]?.email_verified).toBe(false);
  });

  it('users.mfa_enabled defaults to false', async () => {
    await insertUser();
    const result = await db.query<{ mfa_enabled: boolean }>(
      "SELECT mfa_enabled FROM users WHERE id = 'u1'",
    );
    expect(result.rows[0]?.mfa_enabled).toBe(false);
  });

  it('users.deleted_at defaults to NULL (not soft-deleted)', async () => {
    await insertUser();
    const result = await db.query<{ deleted_at: Date | null }>(
      "SELECT deleted_at FROM users WHERE id = 'u1'",
    );
    expect(result.rows[0]?.deleted_at).toBeNull();
  });

  it('site_collaborators.role defaults to "viewer"', async () => {
    await insertUser('u1', 'alice@test.com');
    await insertUser('u2', 'bob@test.com', 'Bob');
    await insertSite();
    await db.query(
      "INSERT INTO site_collaborators (id, site_id, user_id) VALUES ('sc1', 's1', 'u2')",
    );
    const result = await db.query<{ role: string }>(
      "SELECT role FROM site_collaborators WHERE id = 'sc1'",
    );
    expect(result.rows[0]?.role).toBe('viewer');
  });
});

// =============================================================================
// 6. Composite Indexes — pages (slug, siteId)
// =============================================================================

describe('Composite indexes — pages (slug, siteId)', () => {
  it('allows same slug on different sites', async () => {
    await insertUser();
    await insertSite('s1', 'site-one');
    await insertSite('s2', 'site-two');

    // Same slug "home" on two different sites should succeed
    await insertPage('p1', 'home', 's1', 'Home 1');
    await insertPage('p2', 'home', 's2', 'Home 2');

    const result = await db.query<{ id: string; site_id: string }>(
      "SELECT id, site_id FROM pages WHERE slug = 'home' ORDER BY id",
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.site_id).toBe('s1');
    expect(result.rows[1]?.site_id).toBe('s2');
  });

  it('rejects duplicate slug within the same site', async () => {
    await insertUser();
    await insertSite();
    await insertPage('p1', 'about', 's1');

    await expect(insertPage('p2', 'about', 's1', 'About v2')).rejects.toThrow(/unique|duplicate/i);
  });

  it('allows different slugs on the same site', async () => {
    await insertUser();
    await insertSite();
    await insertPage('p1', 'home', 's1');
    await insertPage('p2', 'about', 's1', 'About');
    await insertPage('p3', 'contact', 's1', 'Contact');

    const result = await db.query<{ slug: string }>(
      "SELECT slug FROM pages WHERE site_id = 's1' ORDER BY slug",
    );
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r.slug)).toEqual(['about', 'contact', 'home']);
  });
});

// =============================================================================
// 7. Foreign Key Rejection (referential integrity)
// =============================================================================

describe('Foreign key referential integrity', () => {
  it('rejects site with nonexistent owner_id', async () => {
    await expect(
      db.query(
        "INSERT INTO sites (id, name, slug, owner_id) VALUES ('s1', 'Ghost Site', 'ghost', 'nonexistent')",
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('rejects page with nonexistent site_id', async () => {
    await expect(
      db.query(
        "INSERT INTO pages (id, site_id, title, slug, path) VALUES ('p1', 'nonexistent', 'Home', 'home', '/')",
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('rejects session with nonexistent user_id', async () => {
    await expect(
      db.query(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'nonexistent', 'hash', NOW() + INTERVAL '1 hour')",
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('rejects site_collaborator with nonexistent site_id', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO site_collaborators (id, site_id, user_id) VALUES ('sc1', 'nonexistent', 'u1')",
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('rejects site_collaborator with nonexistent user_id', async () => {
    await insertUser();
    await insertSite();
    await expect(
      db.query(
        "INSERT INTO site_collaborators (id, site_id, user_id) VALUES ('sc1', 's1', 'nonexistent')",
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });
});
