/**
 * Import Verification Tests for @revealui/ai
 *
 * These tests verify that all export paths work correctly after build.
 * Skipped when dist/ is absent (Pro package  -  dist-only in public repo).
 *
 * Fixed: VectorMemoryService now uses lazy database initialization (getter pattern),
 * so imports no longer trigger immediate database connections.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const distDir = resolve(import.meta.dirname, '../../dist');
const distExists = existsSync(distDir);

describe.skipIf(!distExists)('@revealui/ai - Import Paths', () => {
  it('should import from memory export', { timeout: 30_000 }, async () => {
    const memory = await import(resolve(distDir, 'memory/index.js'));
    expect(memory).toBeDefined();
  });

  it('should import from client export', async () => {
    const client = await import(resolve(distDir, 'client/index.js'));
    expect(client).toBeDefined();
  });

  it('should import from main package export', async () => {
    const main = await import(resolve(distDir, 'index.js'));
    expect(main).toBeDefined();
  }, 30_000);

  it('should have consistent exports between memory and main', async () => {
    const memory = await import(resolve(distDir, 'memory/index.js'));
    const main = await import(resolve(distDir, 'index.js'));

    // Main should re-export everything from memory
    expect(main).toMatchObject(memory);
  }, 30_000);

  it('should import client export with React hooks', async () => {
    const client = await import(resolve(distDir, 'client/index.js'));
    expect(client).toBeDefined();
    const exportValues = Object.values(client);
    expect(exportValues.length).toBeGreaterThan(0);
  });
});
