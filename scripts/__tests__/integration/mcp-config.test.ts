/**
 * MCP Configuration Tests
 *
 * Tests for:
 * - MCP config module (packages/config/src/mcp.ts)
 * - Server definition validation
 * - Environment variable parsing
 * - Default value behavior
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type ServerDefinition, validateServerDefinition } from '../../mcp/hypervisor.js';

// =============================================================================
// MCP Config (packages/config/src/mcp.ts)
// =============================================================================

describe('MCP Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear MCP-related env vars
    delete process.env.MCP_PERSISTENCE_DRIVER;
    delete process.env.MCP_METRICS_MODE;
    delete process.env.ELECTRIC_DATABASE_URL;
    delete process.env.ELECTRIC_API_KEY;
    delete process.env.PGVECTOR_ENABLED;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('getMcpConfig defaults', () => {
    it('should return default config when no env vars set', async () => {
      // Dynamic import to pick up fresh env
      const { getMcpConfig } = await import('../../../packages/config/src/mcp.js');
      const config = getMcpConfig();

      expect(config.persistenceDriver).toBe('pglite');
      expect(config.metricsMode).toBe('logs');
      expect(config.electricDatabaseUrl).toBeNull();
      expect(config.electricApiKey).toBeNull();
      expect(config.pgvectorEnabled).toBe(false);
    });
  });

  describe('getMcpConfig with env overrides', () => {
    it('should use postgres persistence driver from env', async () => {
      process.env.MCP_PERSISTENCE_DRIVER = 'postgres';
      const mod = await import('../../../packages/config/src/mcp.js');
      const config = mod.getMcpConfig();

      expect(config.persistenceDriver).toBe('postgres');
    });

    it('should use otel metrics mode from env', async () => {
      process.env.MCP_METRICS_MODE = 'otel';
      const mod = await import('../../../packages/config/src/mcp.js');
      const config = mod.getMcpConfig();

      expect(config.metricsMode).toBe('otel');
    });

    it('should use prometheus metrics mode from env', async () => {
      process.env.MCP_METRICS_MODE = 'prometheus';
      const mod = await import('../../../packages/config/src/mcp.js');
      const config = mod.getMcpConfig();

      expect(config.metricsMode).toBe('prometheus');
    });

    it('should read electric database URL from env', async () => {
      process.env.ELECTRIC_DATABASE_URL = 'postgresql://electric:5433/db';
      const mod = await import('../../../packages/config/src/mcp.js');
      const config = mod.getMcpConfig();

      expect(config.electricDatabaseUrl).toBe('postgresql://electric:5433/db');
    });

    it('should read electric API key from env', async () => {
      process.env.ELECTRIC_API_KEY = 'ek_test_123';
      const mod = await import('../../../packages/config/src/mcp.js');
      const config = mod.getMcpConfig();

      expect(config.electricApiKey).toBe('ek_test_123');
    });

    it('should enable pgvector with truthy env values', async () => {
      for (const value of ['1', 'true', 'yes', 'TRUE', 'Yes']) {
        process.env.PGVECTOR_ENABLED = value;
        const mod = await import('../../../packages/config/src/mcp.js');
        const config = mod.getMcpConfig();

        expect(config.pgvectorEnabled).toBe(true);
      }
    });

    it('should keep pgvector disabled with falsy env values', async () => {
      for (const value of ['0', 'false', 'no', '']) {
        process.env.PGVECTOR_ENABLED = value;
        const mod = await import('../../../packages/config/src/mcp.js');
        const config = mod.getMcpConfig();

        expect(config.pgvectorEnabled).toBe(false);
      }
    });
  });
});

// =============================================================================
// Server Definition Validation
// =============================================================================

describe('Server Definition Validation', () => {
  const validDef: ServerDefinition = {
    id: 'stripe',
    name: 'Stripe MCP Server',
    command: 'npx',
    args: ['@stripe/mcp', '--tools=all'],
  };

  it('should accept a minimal valid definition', () => {
    expect(validateServerDefinition(validDef)).toEqual([]);
  });

  it('should accept a fully-specified definition', () => {
    const full: ServerDefinition = {
      ...validDef,
      env: { STRIPE_SECRET_KEY: 'sk_test_123' },
      startupTimeoutMs: 15_000,
      healthCheckIntervalMs: 60_000,
      maxConcurrent: 5,
    };

    expect(validateServerDefinition(full)).toEqual([]);
  });

  it('should reject empty string id', () => {
    const errors = validateServerDefinition({ ...validDef, id: '' });
    expect(errors).toContain('Server ID is required and must be a string');
  });

  it('should reject non-string id', () => {
    const errors = validateServerDefinition({ ...validDef, id: 123 as unknown as string });
    expect(errors).toContain('Server ID is required and must be a string');
  });

  it('should reject empty string name', () => {
    const errors = validateServerDefinition({ ...validDef, name: '' });
    expect(errors).toContain('Server name is required and must be a string');
  });

  it('should reject empty string command', () => {
    const errors = validateServerDefinition({ ...validDef, command: '' });
    expect(errors).toContain('Server command is required and must be a string');
  });

  it('should reject non-array args', () => {
    const errors = validateServerDefinition({
      ...validDef,
      args: 'not-array' as unknown as string[],
    });
    expect(errors).toContain('Server args must be an array');
  });

  it('should reject zero startup timeout', () => {
    const errors = validateServerDefinition({ ...validDef, startupTimeoutMs: 0 });
    expect(errors).toContain('Startup timeout must be positive');
  });

  it('should reject negative max concurrent', () => {
    const errors = validateServerDefinition({ ...validDef, maxConcurrent: -5 });
    expect(errors).toContain('Max concurrent must be positive');
  });

  it('should accept undefined optional fields', () => {
    const errors = validateServerDefinition({
      ...validDef,
      startupTimeoutMs: undefined,
      healthCheckIntervalMs: undefined,
      maxConcurrent: undefined,
    });
    expect(errors).toEqual([]);
  });

  describe('Real-world server definitions', () => {
    it('should accept Stripe MCP definition', () => {
      const errors = validateServerDefinition({
        id: 'stripe',
        name: 'Stripe MCP',
        command: 'npx',
        args: ['@stripe/mcp', '--tools=all'],
        env: { STRIPE_SECRET_KEY: 'sk_test_xxx' },
      });
      expect(errors).toEqual([]);
    });

    it('should accept Neon MCP definition', () => {
      const errors = validateServerDefinition({
        id: 'neon',
        name: 'Neon Database MCP',
        remoteUrl: 'https://mcp.neon.tech',
        env: { NEON_API_KEY: 'neon_xxx' },
      });
      expect(errors).toEqual([]);
    });

    it('should accept Playwright MCP definition', () => {
      const errors = validateServerDefinition({
        id: 'playwright',
        name: 'Playwright MCP',
        command: 'npx',
        args: ['playwright-mcp'],
        startupTimeoutMs: 30_000,
      });
      expect(errors).toEqual([]);
    });

    it('should accept Vercel MCP definition', () => {
      const errors = validateServerDefinition({
        id: 'vercel',
        name: 'Vercel MCP',
        command: 'npx',
        args: ['vercel-mcp'],
        env: { VERCEL_API_KEY: 'vk_xxx' },
        maxConcurrent: 5,
      });
      expect(errors).toEqual([]);
    });

    it('should accept Supabase MCP definition', () => {
      const errors = validateServerDefinition({
        id: 'supabase',
        name: 'Supabase MCP',
        command: 'npx',
        args: ['supabase-mcp'],
        healthCheckIntervalMs: 120_000,
      });
      expect(errors).toEqual([]);
    });
  });
});
