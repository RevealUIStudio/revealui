/**
 * Single Database Client Tests
 *
 * Tests that getClient('rest') and getClient('vector') both return the same
 * single Neon-primary client, and that getVectorClient() is a deprecated alias
 * for getRestClient().
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

describe('Single Database Client (post-Supabase removal)', () => {
  beforeEach(() => {
    resetClient();
    process.env.POSTGRES_URL = 'postgresql://rest-db';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'POSTGRES_URL');
    Reflect.deleteProperty(process.env, 'DATABASE_URL');
  });

  it('getClient("vector") returns the same client as getClient("rest")', () => {
    const restClient = getClient('rest');
    const vectorClient = getClient('vector');

    expect(restClient).toBeDefined();
    expect(vectorClient).toBeDefined();
    expect(restClient).toBe(vectorClient);
  });

  it('getVectorClient() is a deprecated alias that equals getRestClient()', () => {
    const restClient = getRestClient();
    const vectorClient = getVectorClient();

    expect(restClient).toBeDefined();
    expect(vectorClient).toBeDefined();
    expect(restClient).toBe(vectorClient);
  });

  it('returns same client instance for same type (singleton)', () => {
    const client1 = getClient('rest');
    const client2 = getClient('rest');

    expect(client1).toBe(client2);
  });

  it('defaults to rest client when no type specified', () => {
    const defaultClient = getClient();
    const restClient = getRestClient();

    expect(defaultClient).toBe(restClient);
  });

  it('throws error if POSTGRES_URL not set for rest client', () => {
    resetClient();
    Reflect.deleteProperty(process.env, 'POSTGRES_URL');
    Reflect.deleteProperty(process.env, 'DATABASE_URL');

    expect(() => getRestClient()).toThrow('POSTGRES_URL');
  });

  it('throws error if POSTGRES_URL not set for vector client (alias of rest)', () => {
    resetClient();
    Reflect.deleteProperty(process.env, 'POSTGRES_URL');
    Reflect.deleteProperty(process.env, 'DATABASE_URL');

    expect(() => getVectorClient()).toThrow('POSTGRES_URL');
  });

  it('resets client so a new instance is created after reset', () => {
    const client1 = getRestClient();

    resetClient();

    const client2 = getRestClient();

    expect(client1).not.toBe(client2);
  });
});
