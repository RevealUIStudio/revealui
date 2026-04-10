/**
 * Schema Validation Tests
 *
 * Verifies that critical Drizzle ORM table definitions have the expected
 * columns, constraints, foreign keys, and NOT NULL requirements.
 * These tests use Drizzle's table metadata directly — no database connection needed.
 */

import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { media, posts } from '../../schema/admin.js';
import { licenses } from '../../schema/licenses.js';
import { marketplaceServers, marketplaceTransactions } from '../../schema/marketplace.js';
import { pageRevisions, pages } from '../../schema/pages.js';
import { siteCollaborators, sites } from '../../schema/sites.js';
import { sessions, users } from '../../schema/users.js';

// ============================================================================
// Helper to extract foreign key info from Drizzle table config
// ============================================================================

interface ForeignKeyInfo {
  columnsFrom: string[];
  tableTo: string;
}

function getForeignKeys(table: Parameters<typeof getTableConfig>[0]): ForeignKeyInfo[] {
  const config = getTableConfig(table);
  return config.foreignKeys.map((fk) => {
    const ref = fk.reference();
    return {
      columnsFrom: ref.columns.map((c) => c.name),
      tableTo: getTableName(ref.foreignTable),
    };
  });
}

function getColumnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

function isNotNull(table: Parameters<typeof getTableColumns>[0], columnName: string): boolean {
  const columns = getTableColumns(table);
  const entry = Object.entries(columns).find(([_, col]) => col.name === columnName);
  return entry ? entry[1].notNull : false;
}

function hasUniqueConstraint(
  table: Parameters<typeof getTableConfig>[0],
  columnName: string,
): boolean {
  const columns = getTableColumns(table);
  const entry = Object.entries(columns).find(([_, col]) => col.name === columnName);
  if (entry?.[1].isUnique) return true;

  // Also check table-level unique constraints
  const config = getTableConfig(table);
  return config.uniqueConstraints.some((uc) => uc.columns.some((c) => c.name === columnName));
}

// ============================================================================
// Users Table
// ============================================================================

describe('users table', () => {
  it('has table name "users"', () => {
    expect(getTableName(users)).toBe('users');
  });

  it('has required columns', () => {
    const cols = getColumnNames(users);
    expect(cols).toContain('id');
    expect(cols).toContain('name');
    expect(cols).toContain('email');
    expect(cols).toContain('password');
    expect(cols).toContain('role');
    expect(cols).toContain('status');
    expect(cols).toContain('type');
    expect(cols).toContain('created_at');
    expect(cols).toContain('updated_at');
  });

  it('has id as primary key', () => {
    const columns = getTableColumns(users);
    expect(columns.id.primary).toBe(true);
  });

  it('enforces NOT NULL on critical columns', () => {
    expect(isNotNull(users, 'id')).toBe(true);
    expect(isNotNull(users, 'name')).toBe(true);
    expect(isNotNull(users, 'role')).toBe(true);
    expect(isNotNull(users, 'status')).toBe(true);
    expect(isNotNull(users, 'type')).toBe(true);
    expect(isNotNull(users, 'created_at')).toBe(true);
    expect(isNotNull(users, 'updated_at')).toBe(true);
  });

  it('allows nullable email (for OAuth-only users)', () => {
    expect(isNotNull(users, 'email')).toBe(false);
  });

  it('allows nullable password (for OAuth-only users)', () => {
    expect(isNotNull(users, 'password')).toBe(false);
  });

  it('has agent-specific nullable fields', () => {
    const cols = getColumnNames(users);
    expect(cols).toContain('agent_model');
    expect(cols).toContain('agent_capabilities');
    expect(isNotNull(users, 'agent_model')).toBe(false);
  });

  it('has Stripe customer ID field', () => {
    const cols = getColumnNames(users);
    expect(cols).toContain('stripe_customer_id');
  });
});

// ============================================================================
// Sessions Table
// ============================================================================

describe('sessions table', () => {
  it('has table name "sessions"', () => {
    expect(getTableName(sessions)).toBe('sessions');
  });

  it('has required columns', () => {
    const cols = getColumnNames(sessions);
    expect(cols).toContain('id');
    expect(cols).toContain('user_id');
    expect(cols).toContain('token_hash');
    expect(cols).toContain('expires_at');
    expect(cols).toContain('created_at');
  });

  it('has foreign key to users table', () => {
    const fks = getForeignKeys(sessions);
    const userFk = fks.find((fk) => fk.tableTo === 'users');
    expect(userFk).toBeDefined();
    expect(userFk?.columnsFrom).toContain('user_id');
  });

  it('enforces NOT NULL on user_id and token_hash', () => {
    expect(isNotNull(sessions, 'user_id')).toBe(true);
    expect(isNotNull(sessions, 'token_hash')).toBe(true);
    expect(isNotNull(sessions, 'expires_at')).toBe(true);
  });

  it('allows nullable user_agent and ip_address', () => {
    expect(isNotNull(sessions, 'user_agent')).toBe(false);
    expect(isNotNull(sessions, 'ip_address')).toBe(false);
  });
});

// ============================================================================
// Posts Table
// ============================================================================

describe('posts table', () => {
  it('has table name "posts"', () => {
    expect(getTableName(posts)).toBe('posts');
  });

  it('has required columns', () => {
    const cols = getColumnNames(posts);
    expect(cols).toContain('id');
    expect(cols).toContain('title');
    expect(cols).toContain('slug');
    expect(cols).toContain('content');
    expect(cols).toContain('author_id');
    expect(cols).toContain('status');
  });

  it('has unique constraint on slug', () => {
    expect(hasUniqueConstraint(posts, 'slug')).toBe(true);
  });

  it('enforces NOT NULL on title and slug', () => {
    expect(isNotNull(posts, 'title')).toBe(true);
    expect(isNotNull(posts, 'slug')).toBe(true);
    expect(isNotNull(posts, 'status')).toBe(true);
  });

  it('has foreign key to users for author', () => {
    const fks = getForeignKeys(posts);
    const authorFk = fks.find((fk) => fk.columnsFrom.includes('author_id'));
    expect(authorFk).toBeDefined();
    expect(authorFk?.tableTo).toBe('users');
  });

  it('allows nullable content and excerpt', () => {
    expect(isNotNull(posts, 'content')).toBe(false);
    expect(isNotNull(posts, 'excerpt')).toBe(false);
  });
});

// ============================================================================
// Sites Table
// ============================================================================

describe('sites table', () => {
  it('has table name "sites"', () => {
    expect(getTableName(sites)).toBe('sites');
  });

  it('has foreign key to users for owner', () => {
    const fks = getForeignKeys(sites);
    const ownerFk = fks.find((fk) => fk.columnsFrom.includes('owner_id'));
    expect(ownerFk).toBeDefined();
    expect(ownerFk?.tableTo).toBe('users');
  });

  it('enforces NOT NULL on owner_id, name, and slug', () => {
    expect(isNotNull(sites, 'owner_id')).toBe(true);
    expect(isNotNull(sites, 'name')).toBe(true);
    expect(isNotNull(sites, 'slug')).toBe(true);
  });

  it('has status field with default', () => {
    const columns = getTableColumns(sites);
    expect(columns.status).toBeDefined();
    expect(isNotNull(sites, 'status')).toBe(true);
  });
});

// ============================================================================
// Site Collaborators Table
// ============================================================================

describe('siteCollaborators table', () => {
  it('has table name "site_collaborators"', () => {
    expect(getTableName(siteCollaborators)).toBe('site_collaborators');
  });

  it('has foreign keys to both sites and users', () => {
    const fks = getForeignKeys(siteCollaborators);
    const siteFk = fks.find((fk) => fk.columnsFrom.includes('site_id'));
    const userFk = fks.find((fk) => fk.columnsFrom.includes('user_id'));
    expect(siteFk).toBeDefined();
    expect(siteFk?.tableTo).toBe('sites');
    expect(userFk).toBeDefined();
    expect(userFk?.tableTo).toBe('users');
  });

  it('has added_by foreign key to users', () => {
    const fks = getForeignKeys(siteCollaborators);
    const addedByFk = fks.find((fk) => fk.columnsFrom.includes('added_by'));
    expect(addedByFk).toBeDefined();
    expect(addedByFk?.tableTo).toBe('users');
  });

  it('enforces NOT NULL on site_id, user_id, and role', () => {
    expect(isNotNull(siteCollaborators, 'site_id')).toBe(true);
    expect(isNotNull(siteCollaborators, 'user_id')).toBe(true);
    expect(isNotNull(siteCollaborators, 'role')).toBe(true);
  });
});

// ============================================================================
// Pages Table
// ============================================================================

describe('pages table', () => {
  it('has table name "pages"', () => {
    expect(getTableName(pages)).toBe('pages');
  });

  it('has foreign key to sites', () => {
    const fks = getForeignKeys(pages);
    const siteFk = fks.find((fk) => fk.columnsFrom.includes('site_id'));
    expect(siteFk).toBeDefined();
    expect(siteFk?.tableTo).toBe('sites');
  });

  it('enforces NOT NULL on title, slug, path, site_id', () => {
    expect(isNotNull(pages, 'title')).toBe(true);
    expect(isNotNull(pages, 'slug')).toBe(true);
    expect(isNotNull(pages, 'path')).toBe(true);
    expect(isNotNull(pages, 'site_id')).toBe(true);
  });

  it('allows nullable parent_id for root pages', () => {
    expect(isNotNull(pages, 'parent_id')).toBe(false);
  });
});

// ============================================================================
// Page Revisions Table
// ============================================================================

describe('pageRevisions table', () => {
  it('has table name "page_revisions"', () => {
    expect(getTableName(pageRevisions)).toBe('page_revisions');
  });

  it('has foreign key to pages', () => {
    const fks = getForeignKeys(pageRevisions);
    const pageFk = fks.find((fk) => fk.columnsFrom.includes('page_id'));
    expect(pageFk).toBeDefined();
    expect(pageFk?.tableTo).toBe('pages');
  });

  it('has foreign key to users for created_by', () => {
    const fks = getForeignKeys(pageRevisions);
    const userFk = fks.find((fk) => fk.columnsFrom.includes('created_by'));
    expect(userFk).toBeDefined();
    expect(userFk?.tableTo).toBe('users');
  });

  it('enforces NOT NULL on page_id and revision_number', () => {
    expect(isNotNull(pageRevisions, 'page_id')).toBe(true);
    expect(isNotNull(pageRevisions, 'revision_number')).toBe(true);
  });
});

// ============================================================================
// Media Table
// ============================================================================

describe('media table', () => {
  it('has table name "media"', () => {
    expect(getTableName(media)).toBe('media');
  });

  it('has required columns', () => {
    const cols = getColumnNames(media);
    expect(cols).toContain('id');
    expect(cols).toContain('filename');
    expect(cols).toContain('mime_type');
    expect(cols).toContain('url');
  });

  it('enforces NOT NULL on filename, mime_type, and url', () => {
    expect(isNotNull(media, 'filename')).toBe(true);
    expect(isNotNull(media, 'mime_type')).toBe(true);
    expect(isNotNull(media, 'url')).toBe(true);
  });

  it('has foreign key to users for uploaded_by', () => {
    const fks = getForeignKeys(media);
    const userFk = fks.find((fk) => fk.columnsFrom.includes('uploaded_by'));
    expect(userFk).toBeDefined();
    expect(userFk?.tableTo).toBe('users');
  });
});

// ============================================================================
// Licenses Table
// ============================================================================

describe('licenses table', () => {
  it('has table name "licenses"', () => {
    expect(getTableName(licenses)).toBe('licenses');
  });

  it('has foreign key to users', () => {
    const fks = getForeignKeys(licenses);
    const userFk = fks.find((fk) => fk.columnsFrom.includes('user_id'));
    expect(userFk).toBeDefined();
    expect(userFk?.tableTo).toBe('users');
  });

  it('enforces NOT NULL on user_id, license_key, tier, customer_id', () => {
    expect(isNotNull(licenses, 'user_id')).toBe(true);
    expect(isNotNull(licenses, 'license_key')).toBe(true);
    expect(isNotNull(licenses, 'tier')).toBe(true);
    expect(isNotNull(licenses, 'customer_id')).toBe(true);
  });

  it('allows nullable expires_at for perpetual licenses', () => {
    expect(isNotNull(licenses, 'expires_at')).toBe(false);
  });

  it('has subscription_id field (nullable)', () => {
    const cols = getColumnNames(licenses);
    expect(cols).toContain('subscription_id');
    expect(isNotNull(licenses, 'subscription_id')).toBe(false);
  });
});

// ============================================================================
// Marketplace Tables
// ============================================================================

describe('marketplaceServers table', () => {
  it('has table name "marketplace_servers"', () => {
    expect(getTableName(marketplaceServers)).toBe('marketplace_servers');
  });

  it('has foreign key to users for developer', () => {
    const fks = getForeignKeys(marketplaceServers);
    const devFk = fks.find((fk) => fk.columnsFrom.includes('developer_id'));
    expect(devFk).toBeDefined();
    expect(devFk?.tableTo).toBe('users');
  });

  it('enforces NOT NULL on name, description, url, developer_id', () => {
    expect(isNotNull(marketplaceServers, 'name')).toBe(true);
    expect(isNotNull(marketplaceServers, 'description')).toBe(true);
    expect(isNotNull(marketplaceServers, 'url')).toBe(true);
    expect(isNotNull(marketplaceServers, 'developer_id')).toBe(true);
  });
});

describe('marketplaceTransactions table', () => {
  it('has table name "marketplace_transactions"', () => {
    expect(getTableName(marketplaceTransactions)).toBe('marketplace_transactions');
  });

  it('has foreign key to marketplace_servers', () => {
    const fks = getForeignKeys(marketplaceTransactions);
    const serverFk = fks.find((fk) => fk.columnsFrom.includes('server_id'));
    expect(serverFk).toBeDefined();
    expect(serverFk?.tableTo).toBe('marketplace_servers');
  });

  it('enforces NOT NULL on server_id and amount fields', () => {
    expect(isNotNull(marketplaceTransactions, 'server_id')).toBe(true);
    expect(isNotNull(marketplaceTransactions, 'amount_usdc')).toBe(true);
    expect(isNotNull(marketplaceTransactions, 'platform_fee_usdc')).toBe(true);
    expect(isNotNull(marketplaceTransactions, 'developer_amount_usdc')).toBe(true);
  });

  it('allows nullable caller_id (anonymous x402 payments)', () => {
    expect(isNotNull(marketplaceTransactions, 'caller_id')).toBe(false);
  });
});

// ============================================================================
// Cross-table relationship consistency
// ============================================================================

describe('cross-table relationships', () => {
  it('sessions.user_id references users.id', () => {
    const fks = getForeignKeys(sessions);
    const userFk = fks.find((fk) => fk.columnsFrom.includes('user_id'));
    expect(userFk?.tableTo).toBe('users');
  });

  it('sites.owner_id references users.id', () => {
    const fks = getForeignKeys(sites);
    const ownerFk = fks.find((fk) => fk.columnsFrom.includes('owner_id'));
    expect(ownerFk?.tableTo).toBe('users');
  });

  it('pages.site_id references sites.id', () => {
    const fks = getForeignKeys(pages);
    const siteFk = fks.find((fk) => fk.columnsFrom.includes('site_id'));
    expect(siteFk?.tableTo).toBe('sites');
  });

  it('pageRevisions.page_id references pages.id', () => {
    const fks = getForeignKeys(pageRevisions);
    const pageFk = fks.find((fk) => fk.columnsFrom.includes('page_id'));
    expect(pageFk?.tableTo).toBe('pages');
  });

  it('licenses.user_id references users.id', () => {
    const fks = getForeignKeys(licenses);
    const userFk = fks.find((fk) => fk.columnsFrom.includes('user_id'));
    expect(userFk?.tableTo).toBe('users');
  });

  it('posts.author_id references users.id', () => {
    const fks = getForeignKeys(posts);
    const authorFk = fks.find((fk) => fk.columnsFrom.includes('author_id'));
    expect(authorFk?.tableTo).toBe('users');
  });

  it('siteCollaborators references both sites and users', () => {
    const fks = getForeignKeys(siteCollaborators);
    const tableNames = fks.map((fk) => fk.tableTo);
    expect(tableNames).toContain('sites');
    expect(tableNames).toContain('users');
  });

  it('marketplace chain: transactions -> servers -> users', () => {
    const txFks = getForeignKeys(marketplaceTransactions);
    const serverFk = txFks.find((fk) => fk.columnsFrom.includes('server_id'));
    expect(serverFk?.tableTo).toBe('marketplace_servers');

    const serverFks = getForeignKeys(marketplaceServers);
    const devFk = serverFks.find((fk) => fk.columnsFrom.includes('developer_id'));
    expect(devFk?.tableTo).toBe('users');
  });
});

// ============================================================================
// Schema defaults
// ============================================================================

describe('schema defaults', () => {
  it('users.role defaults to "viewer"', () => {
    const columns = getTableColumns(users);
    expect(columns.role.default).toBe('viewer');
  });

  it('users.status defaults to "active"', () => {
    const columns = getTableColumns(users);
    expect(columns.status.default).toBe('active');
  });

  it('users.type defaults to "human"', () => {
    const columns = getTableColumns(users);
    expect(columns.type.default).toBe('human');
  });

  it('posts.status defaults to "draft"', () => {
    const columns = getTableColumns(posts);
    expect(columns.status.default).toBe('draft');
  });

  it('sites.status defaults to "draft"', () => {
    const columns = getTableColumns(sites);
    expect(columns.status.default).toBe('draft');
  });

  it('licenses.status defaults to "active"', () => {
    const columns = getTableColumns(licenses);
    expect(columns.status.default).toBe('active');
  });

  it('schemaVersion defaults to "1" on all versioned tables', () => {
    const tables = [users, sessions, posts, media, sites, pages];
    for (const table of tables) {
      const columns = getTableColumns(table);
      if ('schemaVersion' in columns) {
        expect(columns.schemaVersion.default).toBe('1');
      }
    }
  });
});
