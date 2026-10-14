import { describe, expect, it } from 'vitest';
import { identityFromLookup, providerFromCircuitBreaker } from '../chat-key-source';

describe('identityFromLookup', () => {
  it('labels a hosted user key as byok and keeps the configured model', () => {
    const identity = identityFromLookup({
      isHosted: true,
      dispatchEnabled: true,
      clientProvider: 'openai',
      envProvider: 'anthropic',
      envModel: 'claude-sonnet-4-6',
      lookup: {
        userProviders: ['openai'],
        userModels: [{ provider: 'openai', model: 'gpt-4o' }],
        siteProvider: 'groq',
        siteModel: 'openai/gpt-oss-120b',
      },
    });
    expect(identity).toEqual({ keySource: 'byok', provider: 'openai', model: 'gpt-4o' });
  });

  it('labels a site config when the user has no key', () => {
    const identity = identityFromLookup({
      isHosted: true,
      dispatchEnabled: true,
      clientProvider: 'groq',
      envProvider: null,
      envModel: null,
      lookup: {
        userProviders: [],
        userModels: [],
        siteProvider: 'groq',
        siteModel: 'openai/gpt-oss-120b',
      },
    });
    expect(identity.keySource).toBe('site');
    expect(identity.provider).toBe('groq');
    expect(identity.model).toBe('openai/gpt-oss-120b');
  });

  it('labels self-hosted env dispatch as env', () => {
    const identity = identityFromLookup({
      isHosted: false,
      dispatchEnabled: false,
      clientProvider: 'ollama',
      envProvider: 'ollama',
      envModel: 'gemma4:e4b',
      lookup: {
        userProviders: [],
        userModels: [],
        siteProvider: null,
        siteModel: null,
      },
    });
    expect(identity).toEqual({ keySource: 'env', provider: 'ollama', model: 'gemma4:e4b' });
  });
});

describe('providerFromCircuitBreaker', () => {
  it('reads the provider id from the public breaker name', () => {
    expect(
      providerFromCircuitBreaker({
        getCircuitBreakerStats: () => ({ primary: { name: 'llm-openai' } }),
      }),
    ).toBe('openai');
  });
});
