/**
 * Import Verification Tests for @revealui/db
 *
 * These tests verify that all export paths work correctly after reorganization.
 */

import { describe, expect, it } from 'vitest';

const IMPORT_TIMEOUT_MS = 30_000;

describe('@revealui/db - Import Paths', () => {
  it(
    'should import from core export',
    async () => {
      const { getClient } = await import('@revealui/db/core');
      expect(getClient).toBeDefined();
      expect(typeof getClient).toBe('function');
    },
    IMPORT_TIMEOUT_MS,
  );

  it(
    'should import schemas from core export',
    async () => {
      const core = await import('@revealui/db/core');
      const schema = await import('@revealui/db/schema');
      expect(core.schema.users).toBe(schema.users);
      expect(core.schema.sites).toBe(schema.sites);
    },
    IMPORT_TIMEOUT_MS,
  );

  it(
    'should import from client export',
    async () => {
      const { getClient, createClient } = await import('@revealui/db/client');
      expect(getClient).toBeDefined();
      expect(createClient).toBeDefined();
      expect(typeof getClient).toBe('function');
      expect(typeof createClient).toBe('function');
    },
    IMPORT_TIMEOUT_MS,
  );

  it(
    'should import from main package export',
    async () => {
      const main = await import('@revealui/db');
      expect(main).toBeDefined();
      expect(main.getClient).toBeDefined();
      expect(main.createRestClient).toBeDefined();
      expect(typeof main.getClient).toBe('function');
    },
    IMPORT_TIMEOUT_MS,
  );

  it(
    'should have consistent exports between core and main',
    async () => {
      const core = await import('@revealui/db/core');
      const main = await import('@revealui/db');
      const client = await import('@revealui/db/client');

      // Main should re-export everything from core
      expect(main).toMatchObject(core);
      // All entry points must reach the same transaction owner and lease scope.
      expect(core.getTransactionContext).toBe(client.getTransactionContext);
      expect(main.getTransactionContext).toBe(client.getTransactionContext);
      expect(core.getTransactionConnection).toBe(client.getTransactionConnection);
      expect(main.getTransactionConnection).toBe(client.getTransactionConnection);
    },
    IMPORT_TIMEOUT_MS,
  );
});
