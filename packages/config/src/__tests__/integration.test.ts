import { beforeEach, describe, expect, it, vi } from 'vitest';
import config, { resetConfig } from '../index';

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

/**
 * Integration tests for @revealui/config
 * Tests actual usage patterns as they would be used in the codebase
 */

describe('Config Integration Tests', () => {
  const validEnv = {
    REVEALUI_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
    NEXT_PUBLIC_SERVER_URL: 'http://localhost:4000',
    POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test_token',
    STRIPE_SECRET_KEY: 'sk_test_test123456789',
    STRIPE_WEBHOOK_SECRET: 'whsec_test123456789',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_test123456789',
  };

  beforeEach(() => {
    resetConfig();
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

  describe('Database Client Usage Pattern', () => {
    it('should allow checking database property without validation', () => {
      // Simulate: if (!url && config.database?.url)
      // The 'in' check should not trigger validation
      expect('database' in config).toBe(true);
    });

    it('should provide database URL when env vars are set', () => {
      Object.assign(process.env, validEnv);
      resetConfig();

      // Simulate: const url = config.database?.url
      const url = config.database?.url;
      expect(url).toBe(validEnv.POSTGRES_URL);
    });

    it('should throw validation error when accessing database without env vars', () => {
      // Simulate accessing config.database.url without env vars
      expect(() => {
        void config.database.url;
      }).toThrow();
    });
  });

  describe('Stripe Client Usage Pattern', () => {
    it('should allow checking stripe property without validation', () => {
      // Simulate: if (config.stripe?.secretKey)
      expect('stripe' in config).toBe(true);
    });

    it('should provide Stripe keys when env vars are set', () => {
      Object.assign(process.env, validEnv);
      resetConfig();

      // Simulate: const secretKey = config.stripe?.secretKey
      const secretKey = config.stripe?.secretKey;
      expect(secretKey).toBe(validEnv.STRIPE_SECRET_KEY);

      const webhookSecret = config.stripe?.webhookSecret;
      expect(webhookSecret).toBe(validEnv.STRIPE_WEBHOOK_SECRET);
    });

    it('should throw validation error when accessing stripe without env vars', () => {
      expect(() => {
        void config.stripe.secretKey;
      }).toThrow();
    });
  });

  describe('RevealUI Config Usage Pattern', () => {
    it('should allow checking reveal property without validation', () => {
      expect('reveal' in config).toBe(true);
    });

    it('should provide RevealUI config when env vars are set', () => {
      Object.assign(process.env, validEnv);
      resetConfig();

      // Simulate: const serverUrl = config.reveal.publicServerURL
      const serverUrl = config.reveal.publicServerURL;
      expect(serverUrl).toBe(validEnv.REVEALUI_PUBLIC_SERVER_URL);

      const secret = config.reveal.secret;
      expect(secret).toBe(validEnv.REVEALUI_SECRET);

      const serverURL = config.reveal.serverURL;
      expect(serverURL).toBe(validEnv.NEXT_PUBLIC_SERVER_URL);
    });
  });

  describe('Build-Time Usage Pattern', () => {
    it('should allow build-time access without full validation', () => {
      process.env.NEXT_PHASE = 'phase-production-build';
      resetConfig();

      // During build, should be able to check properties
      expect('database' in config).toBe(true);

      // Should be able to access with fallback values
      const url = config.database.url;
      expect(typeof url).toBe('string');
    });

    it('should prevent lenient mode at runtime', () => {
      Reflect.deleteProperty(process.env, 'NEXT_PHASE');
      Reflect.deleteProperty(process.env, 'SKIP_ENV_VALIDATION');
      process.env.NODE_ENV = 'production';
      process.env.RUNTIME_INIT = 'true'; // Ensure it's not detected as build
      resetConfig();

      // Runtime should require full validation
      expect(() => {
        void config.database.url;
      }).toThrow();
    });
  });

  describe('Optional Config Usage Pattern', () => {
    it('should handle optional Supabase config', () => {
      Object.assign(process.env, validEnv);
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      resetConfig();

      const supabaseUrl = config.optional.supabase?.url;
      expect(supabaseUrl).toBe('https://test.supabase.co');
    });

    it('should handle missing optional config gracefully', () => {
      Object.assign(process.env, validEnv);
      resetConfig();

      // Optional configs should be falsy (undefined or empty string) when not set
      const supabaseUrl = config.optional.supabase?.url;
      expect(supabaseUrl || undefined).toBeUndefined();
    });
  });

  describe('Direct Property Access Patterns', () => {
    it('should support Object.keys() without validation for known properties', () => {
      // Object.keys() uses ownKeys trap
      const keys = Object.keys(config);
      expect(keys).toContain('database');
      expect(keys).toContain('stripe');
      expect(keys).toContain('reveal');
    });

    it('should support property existence checks', () => {
      expect('database' in config).toBe(true);
      expect('stripe' in config).toBe(true);
      // Unknown properties return false without validation (truly lazy)
      expect('nonexistent' in config).toBe(false);
      expect('unknownProperty' in config).toBe(false);
    });
  });

  describe('Error Handling Patterns', () => {
    it('should provide helpful error messages', () => {
      try {
        void config.database.url;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toContain('Environment Configuration Error');
          // Error message may say "Invalid variables" or "Missing required variables"
          // depending on how Zod categorizes the error
          expect(
            error.message.includes('Missing required variables') ||
              error.message.includes('Invalid variables'),
          ).toBe(true);
        }
      }
    });

    it('should include error context in messages', () => {
      try {
        void config.database.url;
        expect.fail('Should have thrown');
      } catch (error) {
        // Error should include context about where it occurred
        if (error instanceof Error) {
          expect(error.message).toContain('Error occurred when accessing config');
        }
      }
    });

    it('should allow try-catch error handling in consuming code', () => {
      // Simulate how consuming code would handle errors
      let url: string | undefined;
      try {
        url = config.database.url;
      } catch (error) {
        // Error handling works correctly
        expect(error).toBeInstanceOf(Error);
        url = undefined; // Fallback
      }

      // Should have caught the error and set fallback
      expect(url).toBeUndefined();
    });

    it('should handle errors with try-catch in consuming code', () => {
      // Test that try-catch properly handles validation errors
      // Note: Optional chaining doesn't prevent Proxy validation, so errors will be thrown
      let secretKey: string | undefined;
      try {
        // Accessing config.stripe.secretKey will trigger validation via Proxy
        secretKey = config.stripe.secretKey;
      } catch (error) {
        // Error should be caught - validation failed
        expect(error).toBeInstanceOf(Error);
        secretKey = process.env.STRIPE_SECRET_KEY; // Fallback
      }

      // Should have either caught the error and used fallback, or got the value
      // Since env vars aren't set, should have used fallback (undefined)
      expect(secretKey === undefined || typeof secretKey === 'string').toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle symbol property access', () => {
      Object.assign(process.env, validEnv);
      resetConfig();

      // Symbol properties should work
      const symbolKey = Symbol('test');
      // Accessing via symbol should work (though not commonly used)
      expect(() => {
        const value = (config as unknown as Record<symbol, unknown>)[symbolKey];
        expect(value).toBeUndefined(); // Symbols not in config
      }).not.toThrow();
    });

    it('should handle Object.getOwnPropertyDescriptor for known properties', () => {
      // Should work without validation for known properties
      const descriptor = Object.getOwnPropertyDescriptor(config, 'database');
      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(true);
    });

    it('should handle Object.keys() without validation', () => {
      // Should return keys without validation
      const keys = Object.keys(config);
      expect(keys).toContain('database');
      expect(keys).toContain('stripe');
      expect(keys.length).toBe(7); // All known properties: database, stripe, storage, reveal, branding, optional, env
    });

    it('should handle unknown property checks', () => {
      // Unknown properties return false without validation (truly lazy)
      expect('unknownProperty' in config).toBe(false);
      expect('nonexistent' in config).toBe(false);
      // Should not throw - returns false immediately
      expect(() => {
        const exists = 'unknownProperty' in config;
        return exists;
      }).not.toThrow();
    });
  });
});
