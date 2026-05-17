/**
 * Single Database Integration Tests
 *
 * Tests that the single Neon-primary client handles both relational and
 * vector operations correctly. Post-Supabase removal: one DB, one client.
 */

import { getRestClient, resetClient } from '@revealui/db/client';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Single Database Integration', () => {
  beforeAll(() => {
    if (!process.env.POSTGRES_URL) {
      throw new Error(
        'POSTGRES_URL must be set for database integration tests. ' +
          'This should point to your NeonDB instance.',
      );
    }
  });

  describe('Client Singleton', () => {
    it('returns the same instance on repeated calls', () => {
      resetClient();
      const client1 = getRestClient();
      const client2 = getRestClient();

      expect(client1).toBeDefined();
      expect(client1).toBe(client2);
    });

    it('creates a new instance after reset', () => {
      resetClient();
      const client1 = getRestClient();

      resetClient();
      const client2 = getRestClient();

      expect(client1).not.toBe(client2);
    });
  });

  describe('Database Operations', () => {
    it('executes relational queries', async () => {
      resetClient();
      const db = getRestClient();

      const result = await db.execute(sql`SELECT 1 as test`);
      expect(result).toBeDefined();
    });

    it('queries users table (relational data)', async () => {
      resetClient();
      const db = getRestClient();

      const result = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      expect(result).toBeDefined();
    });

    it('queries agent_memories table (vector data on same client)', async () => {
      resetClient();
      const db = getRestClient();

      const result = await db.execute(sql`SELECT COUNT(*) as count FROM agent_memories`);
      expect(result).toBeDefined();
    });
  });

  describe('Connection Strings', () => {
    it('throws if POSTGRES_URL is not set', () => {
      const original = process.env.POSTGRES_URL;
      Reflect.deleteProperty(process.env, 'POSTGRES_URL');

      resetClient();

      expect(() => getRestClient()).toThrow('POSTGRES_URL');

      if (original) {
        process.env.POSTGRES_URL = original;
      }
    });
  });
});
