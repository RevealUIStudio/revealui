import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatValidationErrors, getConfig, resetConfig, validateEnvVars } from '../index';
import { detectEnvironment } from '../loader';

// Mock the loader to avoid reading local .env files during tests
vi.mock('../loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../loader.js')>();
  return {
    ...actual,
    // Return a function that reads process.env at call time, not mock creation time
    loadEnvironment: vi.fn().mockImplementation(() => {
      return { ...process.env };
    }),
  };
});

describe('@revealui/config', () => {
  const buildEnv = (entries: Array<[string, string]>): Record<string, string> => {
    return Object.fromEntries(entries);
  };
  const withEnvOverrides = (
    base: Record<string, string>,
    overrides: Array<[string, string]>,
  ): Record<string, string> => {
    return { ...base, ...Object.fromEntries(overrides) };
  };
  const validEnv = buildEnv([
    ['REVEALUI_SECRET', 'test-secret-that-is-at-least-32-characters-long'],
    ['REVEALUI_PUBLIC_SERVER_URL', 'http://localhost:4000'],
    ['NEXT_PUBLIC_SERVER_URL', 'http://localhost:4000'],
    ['POSTGRES_URL', 'postgresql://user:pass@localhost:5432/db'],
    ['BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test_token'],
    ['STRIPE_SECRET_KEY', 'sk_test_test123456789'],
    ['STRIPE_WEBHOOK_SECRET', 'whsec_test123456789'],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_test123456789'],
  ]);

  beforeEach(async () => {
    resetConfig();
    // Restore loadEnvironment mock to default behavior (prevents test poisoning)
    const { loadEnvironment } = await import('../loader.js');
    vi.mocked(loadEnvironment).mockImplementation(() => {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) env[key] = value;
      }
      return env;
    });
    // Reset process.env
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith('REVEALUI_') ||
        key.startsWith('NEXT_PUBLIC_') ||
        key.startsWith('POSTGRES_') ||
        key.startsWith('DATABASE_') ||
        key.startsWith('BLOB_') ||
        key.startsWith('STRIPE_')
      ) {
        Reflect.deleteProperty(process.env, key);
      }
    });
    Reflect.deleteProperty(process.env, 'NODE_ENV');
    Reflect.deleteProperty(process.env, 'NEXT_PHASE');
    Reflect.deleteProperty(process.env, 'SKIP_ENV_VALIDATION');
  });

  describe('Lazy Loading', () => {
    it('should not validate on import', async () => {
      // Import should not throw even without env vars
      // Use dynamic import for ESM compatibility
      await expect(import('../index.js')).resolves.toBeDefined();

      // Verify the import succeeded without validation
      const module = await import('../index.js');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('object');
    });

    it('should validate on first property access', () => {
      // Set up valid env
      Object.assign(process.env, validEnv);

      const config = getConfig();

      // Accessing properties should trigger validation
      expect(() => {
        const url = config.database.url;
        expect(url).toBe(validEnv.POSTGRES_URL);
      }).not.toThrow();
    });

    it('should cache config after first access', () => {
      Object.assign(process.env, validEnv);

      const config1 = getConfig();
      const config2 = getConfig();

      // Should be the same instance
      expect(config1).toBe(config2);
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(detectEnvironment()).toBe('development');
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(detectEnvironment()).toBe('production');
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(detectEnvironment()).toBe('test');
    });

    it('should default to development when NODE_ENV is not set', () => {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
      expect(detectEnvironment()).toBe('development');
    });
  });

  describe('Validation', () => {
    it('should validate required environment variables', () => {
      const result = validateEnvVars(validEnv);

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when required vars are missing', () => {
      const result = validateEnvVars({});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.type === 'missing')).toBe(true);
    });

    it('should validate URL format', () => {
      const invalidUrl = withEnvOverrides(validEnv, [['REVEALUI_PUBLIC_SERVER_URL', 'not-a-url']]);

      const result = validateEnvVars(invalidUrl);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.variable === 'REVEALUI_PUBLIC_SERVER_URL')).toBe(true);
    });

    it('should validate secret length', () => {
      const shortSecret = withEnvOverrides(validEnv, [['REVEALUI_SECRET', 'short']]);

      const result = validateEnvVars(shortSecret);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.variable === 'REVEALUI_SECRET' && e.message.includes('32 characters'),
        ),
      ).toBe(true);
    });

    it('should validate PostgreSQL URL format', () => {
      const invalidDb = withEnvOverrides(validEnv, [
        ['POSTGRES_URL', 'mysql://user:pass@localhost/db'],
      ]);

      const result = validateEnvVars(invalidDb);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.variable === 'POSTGRES_URL' && e.message.includes('PostgreSQL'),
        ),
      ).toBe(true);
    });

    it('should accept DATABASE_URL as fallback for POSTGRES_URL', async () => {
      const databaseUrl = 'postgresql://user:pass@localhost:5432/db';

      // Mock loadEnvironment to return normalized env (simulating real loader behavior)
      const { loadEnvironment } = await import('../loader.js');
      vi.mocked(loadEnvironment).mockReturnValueOnce({
        ...validEnv,
        POSTGRES_URL: databaseUrl,
        DATABASE_URL: databaseUrl,
      });

      const config = getConfig();
      expect(config.database.url).toBe(databaseUrl);
    });
  });

  describe('Build-Time Handling', () => {
    it('should allow build-time access without full validation', () => {
      process.env.NEXT_PHASE = 'phase-production-build';
      process.env.SKIP_ENV_VALIDATION = 'true';

      // Should not throw even without full env vars
      expect(() => {
        const config = getConfig(false); // lenient mode
        expect(config).toBeDefined();
      }).not.toThrow();
    });

    it('should use fallback values during build', () => {
      const originalPhase = process.env.NEXT_PHASE;
      const originalSkip = process.env.SKIP_ENV_VALIDATION;

      process.env.NEXT_PHASE = 'phase-production-build';
      process.env.SKIP_ENV_VALIDATION = 'true';
      resetConfig();

      try {
        const config = getConfig(false); // lenient mode

        // Should have fallback values (may be empty strings for some)
        expect(typeof config.database.url).toBe('string');
        expect(typeof config.reveal.publicServerURL).toBe('string');
      } finally {
        // Restore
        if (originalPhase) process.env.NEXT_PHASE = originalPhase;
        else Reflect.deleteProperty(process.env, 'NEXT_PHASE');
        if (originalSkip) process.env.SKIP_ENV_VALIDATION = originalSkip;
        else Reflect.deleteProperty(process.env, 'SKIP_ENV_VALIDATION');
        resetConfig();
      }
    });
  });

  describe('Error Messages', () => {
    it('should format validation errors clearly', () => {
      const result = validateEnvVars({});

      expect(result.success).toBe(false);

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('❌');
      expect(formatted).toContain('Missing required variables');
      expect(formatted).toContain('💡 Fix:');
    });

    it('should include warnings for deprecated variables', () => {
      const envWithDeprecated = {
        ...validEnv,
        ...buildEnv([['REVEALUI_WHITELISTORIGINS', 'http://localhost:3000']]),
      };

      const result = validateEnvVars(envWithDeprecated);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some(
          (w) => w.includes('REVEALUI_WHITELISTORIGINS') && w.includes('deprecated'),
        ),
      ).toBe(true);
    });

    it('should include warnings for DATABASE_URL usage', () => {
      // Create env with DATABASE_URL but no POSTGRES_URL
      // Pass directly to validateEnvVars (not through loadEnvironment which normalizes)
      const envWithDatabaseUrl: Record<string, string> = {
        ...validEnv,
        ...buildEnv([['DATABASE_URL', 'postgresql://user:pass@localhost:5432/db']]),
      };
      Reflect.deleteProperty(envWithDatabaseUrl, 'POSTGRES_URL');

      const result = validateEnvVars(envWithDatabaseUrl);

      // Should have warning about DATABASE_URL
      expect(
        result.warnings.some((w) => w.includes('DATABASE_URL') && w.includes('POSTGRES_URL')),
      ).toBe(true);
    });
  });

  describe('Config Structure', () => {
    beforeEach(() => {
      Object.assign(process.env, validEnv);
      resetConfig(); // Reset after setting env vars to force fresh load
    });

    it('should provide database config', () => {
      const config = getConfig();

      expect(config.database).toBeDefined();
      expect(config.database.url).toBe(validEnv.POSTGRES_URL);
    });

    it('should provide stripe config', () => {
      const config = getConfig();

      expect(config.stripe).toBeDefined();
      expect(config.stripe.secretKey).toBe(validEnv.STRIPE_SECRET_KEY);
      expect(config.stripe.webhookSecret).toBe(validEnv.STRIPE_WEBHOOK_SECRET);
      expect(config.stripe.publishableKey).toBe(validEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
    });

    it('should provide storage config', () => {
      const config = getConfig();

      expect(config.storage).toBeDefined();
      expect(config.storage.blobToken).toBe(validEnv.BLOB_READ_WRITE_TOKEN);
    });

    it('should provide reveal config', () => {
      const config = getConfig();

      expect(config.reveal).toBeDefined();
      expect(config.reveal.secret).toBe(validEnv.REVEALUI_SECRET);
      expect(config.reveal.publicServerURL).toBe(validEnv.REVEALUI_PUBLIC_SERVER_URL);
    });

    it('should provide optional config', () => {
      const config = getConfig();

      expect(config.optional).toBeDefined();
      expect(config.optional.supabase).toBeDefined();
      expect(config.optional.sentry).toBeDefined();
      expect(config.optional.devTools).toBeDefined();
    });

    it('should provide raw env access', () => {
      const config = getConfig();

      expect(config.env).toBeDefined();
      expect(config.env.REVEALUI_SECRET).toBe(validEnv.REVEALUI_SECRET);
    });
  });

  describe('Optional Variables', () => {
    beforeEach(() => {
      Object.assign(process.env, validEnv);
      resetConfig(); // Reset after setting env vars to force fresh load
    });

    it('should handle optional Supabase config', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

      resetConfig(); // Reset again after adding optional vars
      const config = getConfig();

      expect(config.optional.supabase.url).toBe('https://test.supabase.co');
      expect(config.optional.supabase.publishableKey).toBe('test-publishable-key');
    });

    it('should handle optional Sentry config', () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';

      resetConfig();
      const config = getConfig();

      expect(config.optional.sentry.dsn).toBe('https://test@sentry.io/123');
    });

    it('should handle optional CORS origins', () => {
      process.env.REVEALUI_CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';

      resetConfig();
      const config = getConfig();

      expect(config.reveal.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings gracefully', () => {
      const envWithEmpty = {
        ...validEnv,
        ...buildEnv([['REVEALUI_SECRET', '']]),
      };

      const result = validateEnvVars(envWithEmpty);

      expect(result.success).toBe(false);
    });

    it('should handle undefined values', () => {
      const envWithUndefined = {
        ...validEnv,
      };
      Reflect.deleteProperty(envWithUndefined, 'REVEALUI_SECRET');

      const result = validateEnvVars(envWithUndefined);

      expect(result.success).toBe(false);
    });

    it('should reset config cache', () => {
      Object.assign(process.env, validEnv);

      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();

      // Should be different instances after reset
      expect(config1).not.toBe(config2);
    });
  });
});
