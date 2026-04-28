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
