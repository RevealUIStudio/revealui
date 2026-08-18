/**
 * GAP-360 walk residual (jv#1420) — Groq catalog id must never ride an
 * OpenAI host. Production 2026-08-17: both A2A Send Task and
 * /api/agent-stream failed with
 * `OpenAI API error: The model llama-3.3-70b-versatile does not exist or
 * you do not have access to it.`
 *
 * Those two routes share resolveLLMClientForRequest → LLMClient. This
 * file pins the production pairing at the client that actually fetches.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  createLLMClientForUser,
  createLLMClientFromEnv,
  defaultBaseURLForProvider,
  defaultModelForProvider,
  LLMClient,
} from '../client.js';

const GROQ_RETIRED_ID = 'llama-3.3-70b-versatile';
const OPENAI_HOST = 'https://api.openai.com/v1';
const GROQ_HOST = 'https://api.groq.com/openai/v1';

const PROVIDER_ENV_KEYS = [
  'LLM_PROVIDER',
  'INFERENCE_SNAPS_BASE_URL',
  'GROQ_API_KEY',
  'GROQ_BASE_URL',
  'OLLAMA_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'XAI_API_KEY',
  'XAI_BASE_URL',
  'HF_TOKEN',
  'HF_MODEL_URL',
  'LLM_MODEL',
] as const;

const savedEnv: Record<string, string | undefined> = {};

interface KeyRow {
  id: string;
  provider: string;
  encryptedKey: string;
}

interface PreferredRow {
  provider: string;
  model?: string | null;
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
} {
  return (client as unknown as { config: { provider: string; model?: string; baseURL?: string } })
    .config;
}

function isOpenAiHost(url: string): boolean {
  return url.startsWith(OPENAI_HOST);
}

function isGroqHost(url: string): boolean {
  return url.startsWith(GROQ_HOST);
}

function parsePostedModel(init?: RequestInit): string | undefined {
  if (typeof init?.body !== 'string') return undefined;
  const body: unknown = JSON.parse(init.body);
  if (!body || typeof body !== 'object') return undefined;
  const model = (body as { model?: unknown }).model;
  return typeof model === 'string' ? model : undefined;
}

function mockChatFetch(): { urls: string[]; models: Array<string | undefined> } {
  const urls: string[] = [];
  const models: Array<string | undefined> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      urls.push(url);
      models.push(parsePostedModel(init));
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }),
  );
  return { urls, models };
}

beforeEach(() => {
  for (const key of PROVIDER_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of PROVIDER_ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('production pairing: Groq model id + OpenAI-default/env client', () => {
  it('does not POST a Groq catalog id to api.openai.com from an OpenAI client', async () => {
    const posted = mockChatFetch();
    const client = new LLMClient({
      provider: 'openai',
      apiKey: 'sk-test',
      model: GROQ_RETIRED_ID,
    });

    await client.chat([{ role: 'user', content: 'hi' }]);

    expect(posted.urls.length).toBeGreaterThan(0);
    expect(posted.urls.some(isOpenAiHost)).toBe(true);
    expect(posted.models).not.toContain(GROQ_RETIRED_ID);
    expect(inspectRoute(client).model).toBe(defaultModelForProvider('openai'));
    expect(inspectRoute(client).baseURL).toBe(OPENAI_HOST);
  });

  it('switches the env client to Groq when LLM_MODEL is a Groq id and a Groq key exists', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GROQ_API_KEY = 'gsk-test';
    process.env.LLM_MODEL = GROQ_RETIRED_ID;

    const posted = mockChatFetch();
    const client = createLLMClientFromEnv();
    const route = inspectRoute(client);

    expect(route.provider).toBe('groq');
    expect(route.baseURL).toBe(GROQ_HOST);
    expect(route.model).not.toBe(GROQ_RETIRED_ID);
    expect(route.model).toBe(defaultModelForProvider('groq'));

    await client.chat([{ role: 'user', content: 'hi' }]);

    expect(posted.urls.some(isOpenAiHost)).toBe(false);
    expect(posted.urls.some(isGroqHost)).toBe(true);
    expect(posted.models).not.toContain(GROQ_RETIRED_ID);
  });

  it('keeps the OpenAI client but drops the Groq id when only an OpenAI env key exists', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.LLM_MODEL = GROQ_RETIRED_ID;

    const posted = mockChatFetch();
    const client = createLLMClientFromEnv();
    const route = inspectRoute(client);

    expect(route.provider).toBe('openai');
    expect(route.baseURL).toBe(OPENAI_HOST);
    expect(route.model).toBe(defaultModelForProvider('openai'));

    await client.chat([{ role: 'user', content: 'hi' }]);

    expect(posted.urls.some(isOpenAiHost)).toBe(true);
    expect(posted.models).not.toContain(GROQ_RETIRED_ID);
  });
});

describe('createLLMClientForUser — Groq catalog model selects the Groq host', () => {
  it('uses the saved Groq key when the preferred OpenAI row names a Groq catalog model', async () => {
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'openai', model: GROQ_RETIRED_ID },
        keys: [
          { id: 'k-oa', provider: 'openai', encryptedKey: 'enc-oa' },
          { id: 'k-groq', provider: 'groq', encryptedKey: 'enc-groq' },
        ],
      }),
      undefined,
      { hostedViableOnly: true },
    );

    expect(client).toBeInstanceOf(LLMClient);
    const route = inspectRoute(client as LLMClient);
    expect(route.provider).toBe('groq');
    expect(route.baseURL).toBe(GROQ_HOST);
    expect(route.model).toBe(defaultModelForProvider('groq'));
    expect(route.model).not.toBe(GROQ_RETIRED_ID);
  });

  it('does not keep an OpenAI host when the only saved key is Groq and the model is a Groq id', async () => {
    const posted = mockChatFetch();
    const client = await createLLMClientForUser(
      'user-1',
      makeDb({
        preferred: { provider: 'openai', model: GROQ_RETIRED_ID },
        keys: [{ id: 'k-groq', provider: 'groq', encryptedKey: 'enc-groq' }],
      }),
      undefined,
      { hostedViableOnly: true },
    );

    expect(client).toBeInstanceOf(LLMClient);
    await (client as LLMClient).chat([{ role: 'user', content: 'hi' }]);

    expect(posted.urls.some(isOpenAiHost)).toBe(false);
    expect(posted.urls.some(isGroqHost)).toBe(true);
    expect(posted.models).not.toContain(GROQ_RETIRED_ID);
  });
});

describe('Groq-accepted default', () => {
  it('defaults Groq to a current catalog id, not the Aug 2026 retired llama id', () => {
    expect(defaultModelForProvider('groq')).not.toBe(GROQ_RETIRED_ID);
    expect(defaultBaseURLForProvider('groq')).toBe(GROQ_HOST);
  });

  it('constructs a Groq client on the Groq host with an accepted model', async () => {
    const posted = mockChatFetch();
    const client = new LLMClient({
      provider: 'groq',
      apiKey: 'gsk-test',
      model: GROQ_RETIRED_ID,
    });

    expect(inspectRoute(client).provider).toBe('groq');
    expect(inspectRoute(client).baseURL).toBe(GROQ_HOST);
    expect(inspectRoute(client).model).toBe(defaultModelForProvider('groq'));

    await client.chat([{ role: 'user', content: 'hi' }]);

    expect(posted.urls.some(isGroqHost)).toBe(true);
    expect(posted.urls.some(isOpenAiHost)).toBe(false);
    expect(posted.models).not.toContain(GROQ_RETIRED_ID);
  });
});
