/**
 * Tests for validateProviderKey  -  all HTTP calls are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateProviderKey } from '../key-validator.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('anthropic (GAP-360 §5.7)', () => {
  it('probes the models endpoint with x-api-key and the anthropic-version header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await validateProviderKey('anthropic', 'sk-ant-test');
    expect(result.valid).toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/models');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBeTruthy();
  });

  it('returns valid:false on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const result = await validateProviderKey('anthropic', 'bad');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Anthropic');
  });

  it('honors the ANTHROPIC_BASE_URL override', async () => {
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://proxy.example/v1');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await validateProviderKey('anthropic', 'k');
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://proxy.example/v1/models');
    vi.unstubAllEnvs();
  });
});

describe('openai (GAP-360 §5.7)', () => {
  it('probes the models endpoint with a Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await validateProviderKey('openai', 'sk-test');
    expect(result.valid).toBe(true);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('returns valid:false on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const result = await validateProviderKey('openai', 'bad');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('OpenAI');
  });
});

describe('xai (GAP-360 §5.7)', () => {
  it('probes the models endpoint with a Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await validateProviderKey('xai', 'xai-test');
    expect(result.valid).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/models');
  });

  it('returns valid:false on 403', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    const result = await validateProviderKey('xai', 'bad');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('xAI');
  });
});

describe('inference-snaps', () => {
  it('always returns valid:true (local provider, no API key needed)', async () => {
    const result = await validateProviderKey('inference-snaps', '');
    expect(result.valid).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('groq', () => {
  it('returns valid:true when models endpoint responds 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await validateProviderKey('groq', 'gsk_test_key');
    expect(result.valid).toBe(true);
  });

  it('returns valid:false on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const result = await validateProviderKey('groq', 'bad-key');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Groq');
  });

  it('returns valid:false on unexpected HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
    const result = await validateProviderKey('groq', 'key');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('500');
  });
});

describe('huggingface', () => {
  it('returns valid:true on 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await validateProviderKey('huggingface', 'hf_token');
    expect(result.valid).toBe(true);
  });

  it('returns valid:false on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const result = await validateProviderKey('huggingface', 'bad');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('HuggingFace');
  });
});

describe('ollama', () => {
  it('always returns valid:true (local provider, no API key needed)', async () => {
    const result = await validateProviderKey('ollama', '');
    expect(result.valid).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('network failures', () => {
  it('returns valid:true on AbortError (timeout)', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(abortError);
    const result = await validateProviderKey('groq', 'key');
    // Timeout = treat as unreachable = store anyway
    expect(result.valid).toBe(true);
  });

  it('returns valid:true on general network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await validateProviderKey('groq', 'key');
    expect(result.valid).toBe(true);
  });
});

describe('unknown provider', () => {
  it('returns valid:true for unrecognised providers', async () => {
    const result = await validateProviderKey('cohere', 'key');
    expect(result.valid).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
