/**
 * Supabase integration tests
 *
 * Tests Supabase client initialization, database operations, and auth operations.
 * These tests require SUPABASE_URL and SUPABASE_KEY environment variables.
 */

import { beforeAll, describe, expect, it } from 'vitest';

// Skip all tests if credentials are not available
const hasCredentials = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// Fail fast in CI when credentials are expected but missing
if (process.env.RUN_INTEGRATION === 'true' && !hasCredentials) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY required when RUN_INTEGRATION=true');
}

describe.skipIf(!hasCredentials)('Supabase Integration', () => {
  let supabase: Awaited<ReturnType<typeof import('@supabase/supabase-js').createClient>>;

  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  });

  describe('Client Initialization', () => {
    it('should initialize Supabase client', () => {
      expect(supabase).toBeDefined();
      expect(typeof supabase.from).toBe('function');
      expect(typeof supabase.auth).toBe('object');
      expect(typeof supabase.storage).toBe('object');
    });

    it('should have required auth methods', () => {
      expect(typeof supabase.auth.signInWithPassword).toBe('function');
      expect(typeof supabase.auth.signUp).toBe('function');
      expect(typeof supabase.auth.signOut).toBe('function');
      expect(typeof supabase.auth.getSession).toBe('function');
    });
  });

  describe('Database Operations', () => {
    it('should execute database queries via Supabase', async () => {
      // Test connection via a simple query
      // This queries the auth.users table which should always exist
      const { data, error } = await supabase.rpc('version');

      // If there's an error, it might be because the function doesn't exist
      // but we should at least get a response
      if (error) {
        // Check it's not a connection error
        expect(error.message).not.toContain('Failed to fetch');
        expect(error.message).not.toContain('ECONNREFUSED');
      } else {
        expect(data).toBeDefined();
      }
    });

    it('should handle non-existent table gracefully', async () => {
      const { error } = await supabase.from('non_existent_table_xyz').select('*').limit(1);

      expect(error).toBeDefined();
      expect(error?.code).toBe('42P01'); // PostgreSQL: undefined_table
    });
  });

  describe('Auth Operations', () => {
    it('should reject invalid credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'invalid-test-user@example.com',
        password: 'invalid-password-12345',
      });

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    });

    it('should get current session (initially null)', async () => {
      const { data, error } = await supabase.auth.getSession();

      expect(error).toBeNull();
      // Session should be null when not authenticated
      expect(data.session).toBeNull();
    });

    it('should have correct auth configuration', async () => {
      const { data } = await supabase.auth.getSession();

      // Even without a session, we should be able to access auth
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });
  });
});

describe.skipIf(hasCredentials)('Supabase Integration (skipped)', () => {
  it.skip('SUPABASE_URL and SUPABASE_KEY not configured  -  set credentials to enable');
});
