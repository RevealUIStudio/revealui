/**
 * Database Schema Constraint Tests
 *
 * Validates that production schema tables enforce their constraints correctly:
 * foreign keys, unique constraints, NOT NULL, cascade deletes, defaults,
 * and composite unique indexes.
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

  // Users table (base table — most others reference this)
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
      ssh_key_fingerprint TEXT,
      preferences       JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active_at    TIMESTAMPTZ,
      _json             JSONB DEFAULT '{}'
    )
  `);

  // Sessions table
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

  // Licenses table
  await db.query(`
    CREATE TABLE licenses (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_key     TEXT NOT NULL,
      tier            TEXT NOT NULL,
      subscription_id TEXT,
      customer_id     TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at      TIMESTAMPTZ,
      perpetual       BOOLEAN NOT NULL DEFAULT false,
      support_expires_at TIMESTAMPTZ,
      github_username TEXT
    )
  `);

  // OAuth accounts table
  await db.query(`
    CREATE TABLE oauth_accounts (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider         TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_email   TEXT,
      provider_name    TEXT,
      provider_avatar_url TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_user_id)
    )
  `);

  // User API keys table
  await db.query(`
    CREATE TABLE user_api_keys (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider      TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      key_hint      TEXT,
      label         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at  TIMESTAMPTZ
    )
  `);

  // Tenant provider configs table
  await db.query(`
    CREATE TABLE tenant_provider_configs (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider   TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      model      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Password reset tokens table
  await db.query(`
    CREATE TABLE password_reset_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      token_salt TEXT NOT NULL DEFAULT '',
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Processed webhook events table
  await db.query(`
    CREATE TABLE processed_webhook_events (
      id           TEXT PRIMARY KEY,
      event_type   TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Rate limits table
  await db.query(`
    CREATE TABLE rate_limits (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      reset_at   TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Failed attempts table
  await db.query(`
    CREATE TABLE failed_attempts (
      email        TEXT PRIMARY KEY,
      count        INTEGER NOT NULL DEFAULT 0,
      lock_until   TIMESTAMPTZ,
      window_start TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}, 30_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  // Clean in reverse dependency order
  await db.query('DELETE FROM failed_attempts');
  await db.query('DELETE FROM rate_limits');
  await db.query('DELETE FROM processed_webhook_events');
  await db.query('DELETE FROM password_reset_tokens');
  await db.query('DELETE FROM tenant_provider_configs');
  await db.query('DELETE FROM user_api_keys');
  await db.query('DELETE FROM oauth_accounts');
  await db.query('DELETE FROM licenses');
  await db.query('DELETE FROM sessions');
  await db.query('DELETE FROM users');
});

// Helper: insert a test user
async function insertUser(id = 'u1', email = 'alice@test.com', name = 'Alice') {
  await db.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [id, name, email]);
}

// =============================================================================
// Users Table
// =============================================================================

describe('Users — constraints', () => {
  it('inserts a user with defaults', async () => {
    await insertUser();
    const result = await db.query<{
      role: string;
      status: string;
      type: string;
      email_verified: boolean;
    }>('SELECT role, status, type, email_verified FROM users WHERE id = $1', ['u1']);

    expect(result.rows[0]).toMatchObject({
      role: 'viewer',
      status: 'active',
      type: 'human',
      email_verified: false,
    });
  });

  it('requires name (NOT NULL)', async () => {
    await expect(
      db.query("INSERT INTO users (id, email) VALUES ('u1', 'a@b.com')"),
    ).rejects.toThrow(/null/);
  });

  it('allows nullable email (OAuth-only users)', async () => {
    await db.query("INSERT INTO users (id, name) VALUES ('u1', 'OAuth User')");
    const r = await db.query<{ email: string | null }>('SELECT email FROM users WHERE id = $1', [
      'u1',
    ]);
    expect(r.rows[0]?.email).toBeNull();
  });

  it('allows nullable password (OAuth-only users)', async () => {
    await insertUser();
    const r = await db.query<{ password: string | null }>(
      'SELECT password FROM users WHERE id = $1',
      ['u1'],
    );
    expect(r.rows[0]?.password).toBeNull();
  });

  it('sets created_at and updated_at timestamps automatically', async () => {
    await insertUser();
    const r = await db.query<{ created_at: Date; updated_at: Date }>(
      'SELECT created_at, updated_at FROM users WHERE id = $1',
      ['u1'],
    );
    expect(r.rows[0]?.created_at).toBeInstanceOf(Date);
    expect(r.rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it('stores JSONB preferences', async () => {
    await db.query("INSERT INTO users (id, name, preferences) VALUES ('u1', 'Alice', $1::jsonb)", [
      JSON.stringify({ theme: 'dark', language: 'en' }),
    ]);
    const r = await db.query<{ preferences: { theme: string } }>(
      'SELECT preferences FROM users WHERE id = $1',
      ['u1'],
    );
    expect(r.rows[0]?.preferences).toEqual({ theme: 'dark', language: 'en' });
  });

  it('stores agent capabilities as JSONB array', async () => {
    await db.query(
      "INSERT INTO users (id, name, type, agent_capabilities) VALUES ('a1', 'Agent', 'agent', $1::jsonb)",
      [JSON.stringify(['code-review', 'testing'])],
    );
    const r = await db.query<{ agent_capabilities: string[] }>(
      'SELECT agent_capabilities FROM users WHERE id = $1',
      ['a1'],
    );
    expect(r.rows[0]?.agent_capabilities).toEqual(['code-review', 'testing']);
  });
});

// =============================================================================
// Sessions Table
// =============================================================================

describe('Sessions — constraints', () => {
  it('requires a valid user_id (FK)', async () => {
    await expect(
      db.query(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'nonexistent', 'hash', NOW() + INTERVAL '1 hour')",
      ),
    ).rejects.toThrow(/foreign key|violates/);
  });

  it('cascades delete when user is deleted', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'u1', 'hash1', NOW() + INTERVAL '1 hour')",
    );
    await db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s2', 'u1', 'hash2', NOW() + INTERVAL '2 hours')",
    );

    await db.query("DELETE FROM users WHERE id = 'u1'");
    const r = await db.query("SELECT COUNT(*) as c FROM sessions WHERE user_id = 'u1'");
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('requires token_hash (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES ('s1', 'u1', NOW() + INTERVAL '1 hour')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('requires expires_at (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query("INSERT INTO sessions (id, user_id, token_hash) VALUES ('s1', 'u1', 'hash')"),
    ).rejects.toThrow(/null/);
  });

  it('defaults persistent to false', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'u1', 'hash', NOW() + INTERVAL '1 hour')",
    );
    const r = await db.query<{ persistent: boolean }>(
      "SELECT persistent FROM sessions WHERE id = 's1'",
    );
    expect(r.rows[0]?.persistent).toBe(false);
  });
});

// =============================================================================
// Licenses Table
// =============================================================================

describe('Licenses — constraints', () => {
  it('requires user_id FK', async () => {
    await expect(
      db.query(
        "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'nonexistent', 'key', 'pro', 'cus_1')",
      ),
    ).rejects.toThrow(/foreign key|violates/);
  });

  it('cascades delete when user is deleted', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt-key', 'pro', 'cus_1')",
    );
    await db.query("DELETE FROM users WHERE id = 'u1'");
    const r = await db.query('SELECT COUNT(*) as c FROM licenses');
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('requires license_key (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO licenses (id, user_id, tier, customer_id) VALUES ('l1', 'u1', 'pro', 'cus_1')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('requires tier (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO licenses (id, user_id, license_key, customer_id) VALUES ('l1', 'u1', 'jwt', 'cus_1')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('requires customer_id (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO licenses (id, user_id, license_key, tier) VALUES ('l1', 'u1', 'jwt', 'pro')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('defaults status to active', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt', 'pro', 'cus_1')",
    );
    const r = await db.query<{ status: string }>("SELECT status FROM licenses WHERE id = 'l1'");
    expect(r.rows[0]?.status).toBe('active');
  });

  it('defaults perpetual to false', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt', 'pro', 'cus_1')",
    );
    const r = await db.query<{ perpetual: boolean }>(
      "SELECT perpetual FROM licenses WHERE id = 'l1'",
    );
    expect(r.rows[0]?.perpetual).toBe(false);
  });

  it('allows nullable expires_at (perpetual licenses)', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id, perpetual) VALUES ('l1', 'u1', 'jwt', 'pro', 'cus_1', true)",
    );
    const r = await db.query<{ expires_at: Date | null }>(
      "SELECT expires_at FROM licenses WHERE id = 'l1'",
    );
    expect(r.rows[0]?.expires_at).toBeNull();
  });

  it('stores multiple licenses per user', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt1', 'pro', 'cus_1')",
    );
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l2', 'u1', 'jwt2', 'max', 'cus_1')",
    );
    const r = await db.query("SELECT COUNT(*) as c FROM licenses WHERE user_id = 'u1'");
    expect(Number(r.rows[0]?.c)).toBe(2);
  });
});

// =============================================================================
// OAuth Accounts Table
// =============================================================================

describe('OAuth Accounts — constraints', () => {
  it('enforces unique (provider, provider_user_id)', async () => {
    await insertUser();
    await insertUser('u2', 'bob@test.com', 'Bob');

    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa1', 'u1', 'github', 'gh-123')",
    );
    // Same provider + provider_user_id for different user should fail
    await expect(
      db.query(
        "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa2', 'u2', 'github', 'gh-123')",
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('allows same provider_user_id across different providers', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa1', 'u1', 'github', '123')",
    );
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa2', 'u1', 'google', '123')",
    );
    const r = await db.query("SELECT COUNT(*) as c FROM oauth_accounts WHERE user_id = 'u1'");
    expect(Number(r.rows[0]?.c)).toBe(2);
  });

  it('cascades delete when user is deleted', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa1', 'u1', 'github', 'gh-1')",
    );
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa2', 'u1', 'google', 'g-1')",
    );
    await db.query("DELETE FROM users WHERE id = 'u1'");
    const r = await db.query('SELECT COUNT(*) as c FROM oauth_accounts');
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('requires provider (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO oauth_accounts (id, user_id, provider_user_id) VALUES ('oa1', 'u1', 'gh-1')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('requires provider_user_id (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query("INSERT INTO oauth_accounts (id, user_id, provider) VALUES ('oa1', 'u1', 'github')"),
    ).rejects.toThrow(/null/);
  });

  it('allows multiple providers per user', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa1', 'u1', 'github', 'gh-1')",
    );
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa2', 'u1', 'google', 'g-1')",
    );
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa3', 'u1', 'vercel', 'v-1')",
    );
    const r = await db.query("SELECT COUNT(*) as c FROM oauth_accounts WHERE user_id = 'u1'");
    expect(Number(r.rows[0]?.c)).toBe(3);
  });
});

// =============================================================================
// User API Keys Table
// =============================================================================

describe('User API Keys — constraints', () => {
  it('requires user_id FK', async () => {
    await expect(
      db.query(
        "INSERT INTO user_api_keys (id, user_id, provider, encrypted_key) VALUES ('k1', 'nonexistent', 'ollama', 'enc-data')",
      ),
    ).rejects.toThrow(/foreign key|violates/);
  });

  it('cascades delete when user is deleted', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO user_api_keys (id, user_id, provider, encrypted_key) VALUES ('k1', 'u1', 'ollama', 'iv.tag.cipher')",
    );
    await db.query("DELETE FROM users WHERE id = 'u1'");
    const r = await db.query('SELECT COUNT(*) as c FROM user_api_keys');
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('requires encrypted_key (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query("INSERT INTO user_api_keys (id, user_id, provider) VALUES ('k1', 'u1', 'ollama')"),
    ).rejects.toThrow(/null/);
  });

  it('allows multiple keys per user per provider', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO user_api_keys (id, user_id, provider, encrypted_key, label) VALUES ('k1', 'u1', 'ollama', 'enc1', 'Work key')",
    );
    await db.query(
      "INSERT INTO user_api_keys (id, user_id, provider, encrypted_key, label) VALUES ('k2', 'u1', 'ollama', 'enc2', 'Personal key')",
    );
    const r = await db.query(
      "SELECT COUNT(*) as c FROM user_api_keys WHERE user_id = 'u1' AND provider = 'ollama'",
    );
    expect(Number(r.rows[0]?.c)).toBe(2);
  });

  it('allows nullable last_used_at', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO user_api_keys (id, user_id, provider, encrypted_key) VALUES ('k1', 'u1', 'vultr', 'enc')",
    );
    const r = await db.query<{ last_used_at: Date | null }>(
      "SELECT last_used_at FROM user_api_keys WHERE id = 'k1'",
    );
    expect(r.rows[0]?.last_used_at).toBeNull();
  });
});

// =============================================================================
// Tenant Provider Configs Table
// =============================================================================

describe('Tenant Provider Configs — constraints', () => {
  it('cascades delete when user is deleted', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO tenant_provider_configs (id, user_id, provider) VALUES ('tc1', 'u1', 'ollama')",
    );
    await db.query("DELETE FROM users WHERE id = 'u1'");
    const r = await db.query('SELECT COUNT(*) as c FROM tenant_provider_configs');
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('defaults is_default to false', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO tenant_provider_configs (id, user_id, provider) VALUES ('tc1', 'u1', 'vultr')",
    );
    const r = await db.query<{ is_default: boolean }>(
      "SELECT is_default FROM tenant_provider_configs WHERE id = 'tc1'",
    );
    expect(r.rows[0]?.is_default).toBe(false);
  });
});

// =============================================================================
// Password Reset Tokens Table
// =============================================================================

describe('Password Reset Tokens — constraints', () => {
  it('requires user_id FK', async () => {
    await expect(
      db.query(
        "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t1', 'nonexistent', 'hash1', NOW() + INTERVAL '1 hour')",
      ),
    ).rejects.toThrow(/foreign key|violates/);
  });

  it('enforces unique token_hash', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t1', 'u1', 'same-hash', NOW() + INTERVAL '1 hour')",
    );
    await expect(
      db.query(
        "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t2', 'u1', 'same-hash', NOW() + INTERVAL '2 hours')",
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('cascades delete when user is deleted', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t1', 'u1', 'hash1', NOW() + INTERVAL '1 hour')",
    );
    await db.query("DELETE FROM users WHERE id = 'u1'");
    const r = await db.query('SELECT COUNT(*) as c FROM password_reset_tokens');
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('requires expires_at (NOT NULL)', async () => {
    await insertUser();
    await expect(
      db.query(
        "INSERT INTO password_reset_tokens (id, user_id, token_hash) VALUES ('t1', 'u1', 'hash1')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('allows nullable used_at (unused token)', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t1', 'u1', 'hash1', NOW() + INTERVAL '1 hour')",
    );
    const r = await db.query<{ used_at: Date | null }>(
      "SELECT used_at FROM password_reset_tokens WHERE id = 't1'",
    );
    expect(r.rows[0]?.used_at).toBeNull();
  });

  it('defaults token_salt to empty string', async () => {
    await insertUser();
    await db.query(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t1', 'u1', 'hash1', NOW() + INTERVAL '1 hour')",
    );
    const r = await db.query<{ token_salt: string }>(
      "SELECT token_salt FROM password_reset_tokens WHERE id = 't1'",
    );
    expect(r.rows[0]?.token_salt).toBe('');
  });
});

// =============================================================================
// Processed Webhook Events Table
// =============================================================================

describe('Processed Webhook Events — constraints', () => {
  it('uses event ID as primary key (idempotency)', async () => {
    await db.query(
      "INSERT INTO processed_webhook_events (id, event_type) VALUES ('evt_123', 'checkout.session.completed')",
    );
    // Duplicate insert should fail
    await expect(
      db.query(
        "INSERT INTO processed_webhook_events (id, event_type) VALUES ('evt_123', 'checkout.session.completed')",
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('requires event_type (NOT NULL)', async () => {
    await expect(
      db.query("INSERT INTO processed_webhook_events (id) VALUES ('evt_1')"),
    ).rejects.toThrow(/null/);
  });

  it('sets processed_at automatically', async () => {
    await db.query(
      "INSERT INTO processed_webhook_events (id, event_type) VALUES ('evt_1', 'invoice.paid')",
    );
    const r = await db.query<{ processed_at: Date }>(
      "SELECT processed_at FROM processed_webhook_events WHERE id = 'evt_1'",
    );
    expect(r.rows[0]?.processed_at).toBeInstanceOf(Date);
  });

  it('stores different event types independently', async () => {
    await db.query(
      "INSERT INTO processed_webhook_events (id, event_type) VALUES ('evt_1', 'checkout.session.completed')",
    );
    await db.query(
      "INSERT INTO processed_webhook_events (id, event_type) VALUES ('evt_2', 'customer.subscription.deleted')",
    );
    await db.query(
      "INSERT INTO processed_webhook_events (id, event_type) VALUES ('evt_3', 'invoice.payment_failed')",
    );
    const r = await db.query('SELECT COUNT(*) as c FROM processed_webhook_events');
    expect(Number(r.rows[0]?.c)).toBe(3);
  });
});

// =============================================================================
// Rate Limits Table
// =============================================================================

describe('Rate Limits — constraints', () => {
  it('uses key as primary key', async () => {
    await db.query(
      "INSERT INTO rate_limits (key, value, reset_at) VALUES ('ip:1.2.3.4', '{\"count\":1}', NOW() + INTERVAL '1 minute')",
    );
    await expect(
      db.query(
        "INSERT INTO rate_limits (key, value, reset_at) VALUES ('ip:1.2.3.4', '{\"count\":2}', NOW() + INTERVAL '2 minutes')",
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('requires value (NOT NULL)', async () => {
    await expect(
      db.query(
        "INSERT INTO rate_limits (key, reset_at) VALUES ('ip:1.2.3.4', NOW() + INTERVAL '1 minute')",
      ),
    ).rejects.toThrow(/null/);
  });

  it('requires reset_at (NOT NULL)', async () => {
    await expect(
      db.query("INSERT INTO rate_limits (key, value) VALUES ('ip:1.2.3.4', '{\"count\":1}')"),
    ).rejects.toThrow(/null/);
  });

  it('supports upsert via ON CONFLICT', async () => {
    await db.query(
      "INSERT INTO rate_limits (key, value, reset_at) VALUES ('ip:1.2.3.4', '{\"count\":1}', NOW() + INTERVAL '1 minute')",
    );
    await db.query(
      "INSERT INTO rate_limits (key, value, reset_at) VALUES ('ip:1.2.3.4', '{\"count\":5}', NOW() + INTERVAL '2 minutes') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, reset_at = EXCLUDED.reset_at",
    );
    const r = await db.query<{ value: string }>(
      "SELECT value FROM rate_limits WHERE key = 'ip:1.2.3.4'",
    );
    expect(r.rows[0]?.value).toBe('{"count":5}');
  });
});

// =============================================================================
// Failed Attempts Table
// =============================================================================

describe('Failed Attempts — constraints', () => {
  it('uses email as primary key', async () => {
    await db.query(
      "INSERT INTO failed_attempts (email, window_start) VALUES ('alice@test.com', NOW())",
    );
    await expect(
      db.query(
        "INSERT INTO failed_attempts (email, window_start) VALUES ('alice@test.com', NOW())",
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('defaults count to 0', async () => {
    await db.query(
      "INSERT INTO failed_attempts (email, window_start) VALUES ('alice@test.com', NOW())",
    );
    const r = await db.query<{ count: number }>(
      "SELECT count FROM failed_attempts WHERE email = 'alice@test.com'",
    );
    expect(r.rows[0]?.count).toBe(0);
  });

  it('allows nullable lock_until (not locked)', async () => {
    await db.query(
      "INSERT INTO failed_attempts (email, window_start) VALUES ('alice@test.com', NOW())",
    );
    const r = await db.query<{ lock_until: Date | null }>(
      "SELECT lock_until FROM failed_attempts WHERE email = 'alice@test.com'",
    );
    expect(r.rows[0]?.lock_until).toBeNull();
  });

  it('supports upsert for incrementing count', async () => {
    await db.query(
      "INSERT INTO failed_attempts (email, count, window_start) VALUES ('alice@test.com', 1, NOW())",
    );
    await db.query(
      "INSERT INTO failed_attempts (email, count, window_start) VALUES ('alice@test.com', 1, NOW()) ON CONFLICT (email) DO UPDATE SET count = failed_attempts.count + 1",
    );
    const r = await db.query<{ count: number }>(
      "SELECT count FROM failed_attempts WHERE email = 'alice@test.com'",
    );
    expect(r.rows[0]?.count).toBe(2);
  });
});

// =============================================================================
// Cross-Table — Cascade Deletes
// =============================================================================

describe('Cross-table cascade deletes', () => {
  it('deleting a user cascades to all dependent tables', async () => {
    await insertUser();

    // Insert records in all dependent tables
    await db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'u1', 'hash', NOW() + INTERVAL '1 hour')",
    );
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt', 'pro', 'cus_1')",
    );
    await db.query(
      "INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id) VALUES ('oa1', 'u1', 'github', 'gh-1')",
    );
    await db.query(
      "INSERT INTO user_api_keys (id, user_id, provider, encrypted_key) VALUES ('k1', 'u1', 'ollama', 'enc')",
    );
    await db.query(
      "INSERT INTO tenant_provider_configs (id, user_id, provider) VALUES ('tc1', 'u1', 'vultr')",
    );
    await db.query(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ('t1', 'u1', 'hash1', NOW() + INTERVAL '1 hour')",
    );

    // Delete the user
    await db.query("DELETE FROM users WHERE id = 'u1'");

    // Verify all dependent records are gone
    const tables = [
      'sessions',
      'licenses',
      'oauth_accounts',
      'user_api_keys',
      'tenant_provider_configs',
      'password_reset_tokens',
    ];

    for (const table of tables) {
      const r = await db.query(`SELECT COUNT(*) as c FROM ${table}`);
      expect(Number(r.rows[0]?.c), `${table} should be empty after user delete`).toBe(0);
    }
  });
});

// =============================================================================
// Transaction Rollback
// =============================================================================

describe('Transaction rollback', () => {
  it('rolls back all changes on constraint violation mid-transaction', async () => {
    await insertUser();

    try {
      await db.query('BEGIN');
      await db.query(
        "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt1', 'pro', 'cus_1')",
      );
      // This should fail (FK violation) and the entire transaction should roll back
      await db.query(
        "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l2', 'nonexistent', 'jwt2', 'max', 'cus_2')",
      );
      await db.query('COMMIT');
    } catch {
      await db.query('ROLLBACK');
    }

    // First insert should also be rolled back
    const r = await db.query('SELECT COUNT(*) as c FROM licenses');
    expect(Number(r.rows[0]?.c)).toBe(0);
  });

  it('commits successfully when all constraints are met', async () => {
    await insertUser();

    await db.query('BEGIN');
    await db.query(
      "INSERT INTO licenses (id, user_id, license_key, tier, customer_id) VALUES ('l1', 'u1', 'jwt1', 'pro', 'cus_1')",
    );
    await db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s1', 'u1', 'hash', NOW() + INTERVAL '1 hour')",
    );
    await db.query('COMMIT');

    const rl = await db.query('SELECT COUNT(*) as c FROM licenses');
    const rs = await db.query('SELECT COUNT(*) as c FROM sessions');
    expect(Number(rl.rows[0]?.c)).toBe(1);
    expect(Number(rs.rows[0]?.c)).toBe(1);
  });
});
