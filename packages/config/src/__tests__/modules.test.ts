import { beforeEach, describe, expect, it } from 'vitest';
import { getBrandingConfig } from '../modules/branding';
import { getDatabaseConfig } from '../modules/database';
import { getDevToolsConfig, getSentryConfig, getSupabaseConfig } from '../modules/optional';
import { getRevealConfig } from '../modules/reveal';
import { getStorageConfig } from '../modules/storage';
import { getStripeConfig } from '../modules/stripe';
import type { EnvConfig } from '../schema';

// Minimal valid env for module tests  -  modules only read specific fields
function makeEnv(overrides: Partial<EnvConfig> = {}): EnvConfig {
  return {
    REVEALUI_SECRET: 'test-secret-that-is-long-enough-32chars!',
    POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
    NEXT_PUBLIC_SERVER_URL: 'http://localhost:4000',
    ...overrides,
  } as EnvConfig;
}

describe('config modules', () => {
  describe('getBrandingConfig', () => {
    it('returns defaults when no branding env vars set', () => {
      const config = getBrandingConfig(makeEnv());
      expect(config.name).toBe('RevealUI');
      expect(config.logoUrl).toBeUndefined();
      expect(config.primaryColor).toBeUndefined();
      expect(config.showPoweredBy).toBe(true);
    });

    it('uses custom brand name', () => {
      const config = getBrandingConfig(makeEnv({ REVEALUI_BRAND_NAME: 'MyProduct' }));
      expect(config.name).toBe('MyProduct');
    });

    it('uses custom logo URL', () => {
      const config = getBrandingConfig(
        makeEnv({ REVEALUI_BRAND_LOGO_URL: 'https://example.com/logo.png' }),
      );
      expect(config.logoUrl).toBe('https://example.com/logo.png');
    });

    it('uses custom primary color', () => {
      const config = getBrandingConfig(makeEnv({ REVEALUI_BRAND_PRIMARY_COLOR: '#ff6600' }));
      expect(config.primaryColor).toBe('#ff6600');
    });

    it('hides powered-by when set to false', () => {
      const config = getBrandingConfig(makeEnv({ REVEALUI_SHOW_POWERED_BY: 'false' }));
      expect(config.showPoweredBy).toBe(false);
    });

    it('shows powered-by for any value other than false', () => {
      expect(getBrandingConfig(makeEnv({ REVEALUI_SHOW_POWERED_BY: 'true' })).showPoweredBy).toBe(
        true,
      );
      expect(getBrandingConfig(makeEnv({ REVEALUI_SHOW_POWERED_BY: '0' })).showPoweredBy).toBe(
        true,
      );
      expect(getBrandingConfig(makeEnv({ REVEALUI_SHOW_POWERED_BY: '' })).showPoweredBy).toBe(true);
    });
  });

  describe('getDatabaseConfig', () => {
    it('uses POSTGRES_URL as primary', () => {
      const config = getDatabaseConfig(makeEnv({ POSTGRES_URL: 'postgresql://pg:5432/db' }));
      expect(config.url).toBe('postgresql://pg:5432/db');
      expect(config.connectionString).toBe('postgresql://pg:5432/db');
    });

    it('falls back to DATABASE_URL', () => {
      const env = makeEnv();
      delete (env as Record<string, unknown>).POSTGRES_URL;
      (env as Record<string, unknown>).DATABASE_URL = 'postgresql://fallback:5432/db';
      const config = getDatabaseConfig(env);
      expect(config.url).toBe('postgresql://fallback:5432/db');
    });

    it('falls back to SUPABASE_DATABASE_URI', () => {
      const env = makeEnv();
      delete (env as Record<string, unknown>).POSTGRES_URL;
      (env as Record<string, unknown>).SUPABASE_DATABASE_URI = 'postgresql://supabase:5432/db';
      const config = getDatabaseConfig(env);
      expect(config.url).toBe('postgresql://supabase:5432/db');
    });

    it('returns empty string when no DB URL set', () => {
      const env = makeEnv();
      delete (env as Record<string, unknown>).POSTGRES_URL;
      const config = getDatabaseConfig(env);
      expect(config.url).toBe('');
    });
  });

  describe('getStripeConfig', () => {
    it('returns undefined for all keys when not set', () => {
      const config = getStripeConfig(makeEnv());
      expect(config.secretKey).toBeUndefined();
      expect(config.publishableKey).toBeUndefined();
      expect(config.webhookSecret).toBeUndefined();
      expect(config.proxy).toBe(false);
    });

    it('reads Stripe keys from env', () => {
      const config = getStripeConfig(
        makeEnv({
          STRIPE_SECRET_KEY: 'sk_test_123',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_456',
          STRIPE_WEBHOOK_SECRET: 'whsec_789',
        }),
      );
      expect(config.secretKey).toBe('sk_test_123');
      expect(config.publishableKey).toBe('pk_test_456');
      expect(config.webhookSecret).toBe('whsec_789');
    });

    it('enables proxy when STRIPE_PROXY is 1', () => {
      const config = getStripeConfig(makeEnv({ STRIPE_PROXY: '1' }));
      expect(config.proxy).toBe(true);
    });

    it('disables proxy when STRIPE_PROXY is 0', () => {
      const config = getStripeConfig(makeEnv({ STRIPE_PROXY: '0' }));
      expect(config.proxy).toBe(false);
    });

    it('disables proxy for non-1 values', () => {
      expect(getStripeConfig(makeEnv({ STRIPE_PROXY: 'true' })).proxy).toBe(false);
      expect(getStripeConfig(makeEnv({ STRIPE_PROXY: 'yes' })).proxy).toBe(false);
    });
  });

  describe('getRevealConfig', () => {
    it('returns core config with required fields', () => {
      const config = getRevealConfig(
        makeEnv({
          REVEALUI_SECRET: 'my-secret',
          NEXT_PUBLIC_SERVER_URL: 'https://app.example.com',
          REVEALUI_PUBLIC_SERVER_URL: 'https://public.example.com',
        }),
      );
      expect(config.secret).toBe('my-secret');
      expect(config.serverURL).toBe('https://app.example.com');
      expect(config.publicServerURL).toBe('https://public.example.com');
    });

    it('parses CORS origins from comma-separated string', () => {
      const config = getRevealConfig(
        makeEnv({
          REVEALUI_CORS_ORIGINS: 'https://a.com, https://b.com , https://c.com',
        }),
      );
      expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
    });

    it('returns empty array when no CORS origins set', () => {
      const config = getRevealConfig(makeEnv());
      expect(config.corsOrigins).toEqual([]);
    });

    it('includes admin credentials when set', () => {
      const config = getRevealConfig(
        makeEnv({
          REVEALUI_ADMIN_EMAIL: 'admin@test.com',
          REVEALUI_ADMIN_PASSWORD: 'secret123',
        }),
      );
      expect(config.adminEmail).toBe('admin@test.com');
      expect(config.adminPassword).toBe('secret123');
    });

    it('omits admin credentials when not set', () => {
      const config = getRevealConfig(makeEnv());
      expect(config.adminEmail).toBeUndefined();
      expect(config.adminPassword).toBeUndefined();
    });

    it('parses deprecated whitelist origins', () => {
      const config = getRevealConfig(
        makeEnv({
          REVEALUI_WHITELISTORIGINS: 'https://old.com, https://legacy.com',
        }),
      );
      expect(config.whitelistOrigins).toEqual(['https://old.com', 'https://legacy.com']);
    });
  });

  describe('getStorageConfig', () => {
    it('returns blob token when set', () => {
      const config = getStorageConfig(makeEnv({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_xyz' }));
      expect(config.blobToken).toBe('vercel_blob_xyz');
    });

    it('returns undefined when not set', () => {
      const config = getStorageConfig(makeEnv());
      expect(config.blobToken).toBeUndefined();
    });
  });

  describe('getSupabaseConfig', () => {
    it('returns all Supabase fields when set', () => {
      const config = getSupabaseConfig(
        makeEnv({
          NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
          SUPABASE_SECRET_KEY: 'secret-key',
          SUPABASE_DATABASE_URI: 'postgresql://supabase:5432/db',
        }),
      );
      expect(config.url).toBe('https://abc.supabase.co');
      expect(config.publishableKey).toBe('publishable-key');
      expect(config.secretKey).toBe('secret-key');
      expect(config.databaseUri).toBe('postgresql://supabase:5432/db');
    });

    it('returns undefined for unset fields', () => {
      const config = getSupabaseConfig(makeEnv());
      expect(config.url).toBeUndefined();
      expect(config.publishableKey).toBeUndefined();
      expect(config.secretKey).toBeUndefined();
      expect(config.databaseUri).toBeUndefined();
    });

    it('treats empty strings as undefined', () => {
      const config = getSupabaseConfig(
        makeEnv({
          NEXT_PUBLIC_SUPABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        }),
      );
      expect(config.url).toBeUndefined();
      expect(config.publishableKey).toBeUndefined();
    });
  });

  describe('getSentryConfig', () => {
    it('returns all Sentry fields when set', () => {
      const config = getSentryConfig(
        makeEnv({
          NEXT_PUBLIC_SENTRY_DSN: 'https://key@sentry.io/123',
          SENTRY_AUTH_TOKEN: 'sntrys_token',
          SENTRY_ORG: 'my-org',
          SENTRY_PROJECT: 'my-project',
        }),
      );
      expect(config.dsn).toBe('https://key@sentry.io/123');
      expect(config.authToken).toBe('sntrys_token');
      expect(config.org).toBe('my-org');
      expect(config.project).toBe('my-project');
    });

    it('returns undefined for unset fields', () => {
      const config = getSentryConfig(makeEnv());
      expect(config.dsn).toBeUndefined();
      expect(config.authToken).toBeUndefined();
    });
  });

  describe('getDevToolsConfig', () => {
    it('returns neonApiKey when set', () => {
      const config = getDevToolsConfig(makeEnv({ NEON_API_KEY: 'neon-key-123' }));
      expect(config.neonApiKey).toBe('neon-key-123');
    });

    it('parses skipOnInit as boolean', () => {
      expect(getDevToolsConfig(makeEnv({ SKIP_ONINIT: 'true' })).skipOnInit).toBe(true);
      expect(getDevToolsConfig(makeEnv({ SKIP_ONINIT: 'false' })).skipOnInit).toBe(false);
      expect(getDevToolsConfig(makeEnv()).skipOnInit).toBe(false);
    });
  });
});

describe('MCP config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear MCP-related env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('MCP_') || key.startsWith('ELECTRIC_') || key === 'PGVECTOR_ENABLED') {
        Reflect.deleteProperty(process.env, key);
      }
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when no env vars set', async () => {
    const { getMcpConfig } = await import('../mcp');
    const config = getMcpConfig();
    expect(config.persistenceDriver).toBe('pglite');
    expect(config.electricDatabaseUrl).toBeNull();
    expect(config.electricApiKey).toBeNull();
    expect(config.metricsMode).toBe('logs');
    expect(config.pgvectorEnabled).toBe(false);
  });

  it('reads persistence driver from env', async () => {
    process.env.MCP_PERSISTENCE_DRIVER = 'postgres';
    const { getMcpConfig } = await import('../mcp');
    const config = getMcpConfig();
    expect(config.persistenceDriver).toBe('postgres');
  });

  it('reads Electric config from env', async () => {
    process.env.ELECTRIC_DATABASE_URL = 'postgresql://electric:5432/db';
    process.env.ELECTRIC_API_KEY = 'electric-key';
    const { getMcpConfig } = await import('../mcp');
    const config = getMcpConfig();
    expect(config.electricDatabaseUrl).toBe('postgresql://electric:5432/db');
    expect(config.electricApiKey).toBe('electric-key');
  });

  it('parses pgvectorEnabled boolean', async () => {
    process.env.PGVECTOR_ENABLED = 'true';
    const { getMcpConfig } = await import('../mcp');
    const config = getMcpConfig();
    expect(config.pgvectorEnabled).toBe(true);
  });

  it('parses pgvectorEnabled with 1', async () => {
    process.env.PGVECTOR_ENABLED = '1';
    const { getMcpConfig } = await import('../mcp');
    const config = getMcpConfig();
    expect(config.pgvectorEnabled).toBe(true);
  });

  it('reads metrics mode from env', async () => {
    process.env.MCP_METRICS_MODE = 'prometheus';
    const { getMcpConfig } = await import('../mcp');
    const config = getMcpConfig();
    expect(config.metricsMode).toBe('prometheus');
  });
});
