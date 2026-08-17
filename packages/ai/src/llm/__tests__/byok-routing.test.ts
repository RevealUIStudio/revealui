/**
 * GAP-360 walk residual — createLLMClientForUser key + model routing.
 *
 * Preferred tenant_provider_configs must not pin a client to a provider
 * that has no saved key, and a Groq catalog model must never ride an
 * OpenAI client (walk: llama-3.3-70b-versatile on api.openai.com).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@revealui/db/crypto', () => ({
  decryptApiKey: (encrypted: string) => `plain:${encrypted}`,
}));

vi.mock('@revealui/db/schema', () => ({
  tenantProviderConfigs: { __t: 'tpc', userId: {}, isDefault: {}, provider: {}, model: {} },
  userApiKeys: { __t: 'uak', userId: {}, provider: {}, id: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  and: (...conds: unknown[]) => ({ and: conds }),
}));

import type { Database } from '@revealui/db/client';
import { createLLMClientForUser, LLMClient } from '../client.js';

interface KeyRow {
  id: string;
  provider: string;
  encryptedKey: string;
}

interface PreferredRow {
  provider: string;
  model?: string | null;
  isDefault?: boolean;
}

function thenableRows<T>(rows: T[]): Promise<T[]> & { limit: (n: number) => Promise<T[]> } {
  const promise = Promise.resolve(rows);
  return Object.assign(promise, {
    limit: async (n: number) => rows.slice(0, n),
  });
}

function makeDb(opts: { preferred?: PreferredRow; keys: KeyRow[] }): Database {
  return {
    select: () => ({
      from: (table: { __t?: string }) => ({
        where: () => {
          if (table.__t === 'tpc') {
            return thenableRows(opts.preferred ? [{ ...opts.preferred, isDefault: true }] : []);
          }
          return thenableRows(opts.keys);
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  } as unknown as Database;
}

function inspectRoute(client: LLMClient): {
  provider: string;
  model?: string;
  baseURL?: string;
  apiKey: string;
} {
  return (
    client as unknown as {
      config: { provider: string; model?: string; baseURL?: string; apiKey: string };
    }
  ).config;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createLLMClientForUser — stale preferred provider', () => {
  it('uses a saved hosted-viable Groq key when the preferred provider has no key', async () => {
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'openai', model: 'gpt-4o' },
        keys: [{ id: 'k-groq', provider: 'groq', encryptedKey: 'enc-groq' }],
      }),
      undefined,
      { hostedViableOnly: true },
    );

    expect(client).toBeInstanceOf(LLMClient);
    const route = inspectRoute(client as LLMClient);
    expect(route.provider).toBe('groq');
    expect(route.apiKey).toBe('plain:enc-groq');
    expect(route.model).toBe('llama-3.3-70b-versatile');
    expect(route.baseURL).toBe('https://api.groq.com/openai/v1');
  });

  it('does not apply a stale preferred Groq model to an OpenAI key', async () => {
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        keys: [{ id: 'k-oa', provider: 'openai', encryptedKey: 'enc-oa' }],
      }),
    );

    expect(client).toBeInstanceOf(LLMClient);
    const route = inspectRoute(client as LLMClient);
    expect(route.provider).toBe('openai');
    expect(route.model).toBe('gpt-4o');
    expect(route.baseURL).toBe('https://api.openai.com/v1');
  });

  it('keeps the preferred Groq key, Groq model, and Groq base URL together', async () => {
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        keys: [{ id: 'k-groq', provider: 'groq', encryptedKey: 'enc-groq' }],
      }),
      undefined,
      { hostedViableOnly: true },
    );

    const route = inspectRoute(client as LLMClient);
    expect(route.provider).toBe('groq');
    expect(route.model).toBe('llama-3.3-70b-versatile');
    expect(route.baseURL).toBe('https://api.groq.com/openai/v1');
  });

  it('skips a localhost-only fallback on hosted and returns null when that is the only key', async () => {
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'openai' },
        keys: [{ id: 'k-ollama', provider: 'ollama', encryptedKey: 'enc-local' }],
      }),
      undefined,
      { hostedViableOnly: true },
    );

    expect(client).toBeNull();
  });

  it('prefers the matching preferred-provider key when one exists', async () => {
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'openai', model: 'gpt-4o' },
        keys: [
          { id: 'k-groq', provider: 'groq', encryptedKey: 'enc-groq' },
          { id: 'k-oa', provider: 'openai', encryptedKey: 'enc-oa' },
        ],
      }),
    );

    const route = inspectRoute(client as LLMClient);
    expect(route.provider).toBe('openai');
    expect(route.apiKey).toBe('plain:enc-oa');
    expect(route.model).toBe('gpt-4o');
  });
});
