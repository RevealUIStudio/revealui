import { describe, expect, it } from 'vitest';
import { ProviderHealthMonitor } from '../provider-health.js';
import { countMessages, countTokens, estimateCost, estimateRequest } from '../token-counter.js';

describe('provider health monitor', () => {
  it('reports healthy defaults for providers with no samples', () => {
    const monitor = new ProviderHealthMonitor();

    expect(monitor.getHealth('openai')).toEqual({
      provider: 'openai',
      status: 'healthy',
      latencyP50Ms: 0,
      errorRate: 0,
      sampleCount: 0,
    });
  });

  it('tracks degraded and unhealthy providers and ranks the best candidate', () => {
    const monitor = new ProviderHealthMonitor();

    monitor.recordCall('openai', 150);
    monitor.recordCall('openai', 170);
    monitor.recordCall('openai', 160);

    for (let i = 0; i < 10; i++) {
      monitor.recordCall('anthropic', 6_000, i === 0 ? new Error('rate limit') : undefined);
    }

    for (let i = 0; i < 10; i++) {
      monitor.recordCall('groq', 100, new Error('provider down'));
    }

    expect(monitor.getHealth('openai')).toMatchObject({
      status: 'healthy',
      latencyP50Ms: 160,
      errorRate: 0,
      sampleCount: 3,
    });
    expect(monitor.getHealth('anthropic')).toMatchObject({
      status: 'degraded',
      latencyP50Ms: 6000,
      errorRate: 0.1,
      sampleCount: 10,
    });
    expect(monitor.getHealth('groq')).toMatchObject({
      status: 'unhealthy',
      latencyP50Ms: 0,
      errorRate: 1,
      sampleCount: 10,
    });

    expect(monitor.getBestProvider(['groq', 'anthropic', 'openai'])).toBe('openai');
    expect(monitor.getBestProvider(['anthropic'])).toBe('anthropic');
    expect(() => monitor.getBestProvider([])).toThrow('No provider candidates provided');

    monitor.reset('anthropic');
    expect(monitor.getHealth('anthropic').sampleCount).toBe(0);
  });

  it('keeps only the last 100 records per provider', () => {
    const monitor = new ProviderHealthMonitor();

    for (let i = 1; i <= 105; i++) {
      monitor.recordCall('openai', i);
    }

    expect(monitor.getHealth('openai')).toMatchObject({
      sampleCount: 100,
      latencyP50Ms: 56,
    });
  });
});

describe('token counter', () => {
  it('estimates tokens by provider family', () => {
    expect(countTokens('12345678')).toEqual({ tokens: 2, method: 'estimated' });
    expect(countTokens('12345678', { model: 'gemma4:e2b' })).toEqual({
      tokens: 3,
      method: 'estimated',
    });
  });

  it('counts messages with reply overhead', () => {
    const result = countMessages(
      [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Summarize this text' },
      ],
      { model: 'gpt-4o' },
    );

    expect(result).toEqual({
      tokens:
        countTokens('You are helpful', { model: 'gpt-4o' }).tokens +
        countTokens('Summarize this text', { model: 'gpt-4o' }).tokens +
        10,
      method: 'estimated',
    });
  });

  it('estimates input and output costs and handles unknown models', () => {
    expect(estimateCost(2000, 'gpt-4o', 'input')).toEqual({
      estimatedCostUsd: 0.01,
      tokens: 2000,
      model: 'gpt-4o',
      direction: 'input',
    });
    expect(estimateCost(2000, 'unknown-model', 'output')).toEqual({
      estimatedCostUsd: 0,
      tokens: 2000,
      model: 'unknown-model',
      direction: 'output',
    });
  });

  it('estimates request totals from a message list', () => {
    const request = estimateRequest([{ role: 'user', content: 'Explain RevealUI' }], 'gpt-4o-mini');

    expect(request.tokens).toBeGreaterThan(0);
    expect(request.estimatedCostUsd).toBeGreaterThan(0);
  });
});
