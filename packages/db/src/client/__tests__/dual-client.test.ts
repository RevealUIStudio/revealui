/**
 * Dual Database Client Tests
 *
 * Tests that getClient('rest') and getClient('vector') return
 * separate clients with correct schemas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient, getRestClient, getVectorClient, resetClient } from '../index.js';

// Mock the config module to prevent it from providing database URLs
vi.mock('@revealui/config', () => ({
  default: {},
}));

// Mock the database clients
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('Dual Database Client', () => {
  beforeEach(() => {
    resetClient();
    // Set up environment variables
    process.env.POSTGRES_URL = 'postgresql://rest-db';
    process.env.SUPABASE_DATABASE_URL = 'postgresql://vector-db';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'POSTGRES_URL');
    Reflect.deleteProperty(process.env, 'SUPABASE_DATABASE_URL');
    Reflect.deleteProperty(process.env, 'DATABASE_URL');
  });

  it('should return separate clients for rest and vector', () => {
    const restClient = getRestClient();
    const vectorClient = getVectorClient();

    expect(restClient).toBeDefined();
    expect(vectorClient).toBeDefined();
    expect(restClient).not.toBe(vectorClient);
  });

  it('should return same client instance for same type', () => {
    const client1 = getClient('rest');
    const client2 = getClient('rest');

    expect(client1).toBe(client2);
  });

  it('should default to rest client when no type specified', () => {
    const defaultClient = getClient();
    const restClient = getRestClient();

    expect(defaultClient).toBe(restClient);
  });

  it('should throw error if SUPABASE_DATABASE_URL not set for vector client', () => {
    resetClient(); // Reset cached client to force re-initialization
    Reflect.deleteProperty(process.env, 'SUPABASE_DATABASE_URL');

    expect(() => getVectorClient()).toThrow('SUPABASE_DATABASE_URL');
  });

  it('should throw error if POSTGRES_URL not set for rest client', () => {
    resetClient(); // Reset cached client to force re-initialization
    Reflect.deleteProperty(process.env, 'POSTGRES_URL');
    Reflect.deleteProperty(process.env, 'DATABASE_URL');

    expect(() => getRestClient()).toThrow('POSTGRES_URL');
  });

  it('should reset both clients', () => {
    const restClient1 = getRestClient();
    const vectorClient1 = getVectorClient();

    resetClient();

    const restClient2 = getRestClient();
    const vectorClient2 = getVectorClient();

    // New instances should be created
    expect(restClient1).not.toBe(restClient2);
    expect(vectorClient1).not.toBe(vectorClient2);
  });
});
