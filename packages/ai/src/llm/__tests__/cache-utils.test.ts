/**
 * Tests for prompt caching utilities
 */

import { describe, expect, it } from 'vitest';
import {
  ANTHROPIC_PRICING,
  cacheableSystemPrompt,
  calculateCacheCost,
  createCachedConversation,
  estimateCacheSavings,
  formatCacheStats,
  shouldCache,
  withCache,
} from '../cache-utils.js';

describe('cache-utils', () => {
  describe('withCache', () => {
    it('should add cache control to message', () => {
      const message = {
        role: 'system' as const,
        content: 'Test content',
      };

      const cached = withCache(message);

      expect(cached).toEqual({
        role: 'system',
        content: 'Test content',
        cacheControl: { type: 'ephemeral' },
      });
    });

    it('should preserve existing message properties', () => {
      const message = {
        role: 'user' as const,
        content: 'Hello',
        name: 'John',
      };

      const cached = withCache(message);

      expect(cached.name).toBe('John');
      expect(cached.cacheControl).toEqual({ type: 'ephemeral' });
    });
  });

  describe('cacheableSystemPrompt', () => {
    it('should create a cached system message', () => {
      const prompt = cacheableSystemPrompt('You are a helpful assistant');

      expect(prompt).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
        cacheControl: { type: 'ephemeral' },
      });
    });
  });

  describe('shouldCache', () => {
    it('should return true for large content', () => {
      const largeContent = 'a'.repeat(5000); // ~1250 tokens
      expect(shouldCache(largeContent)).toBe(true);
    });

    it('should return false for small content', () => {
      const smallContent = 'Hello world'; // ~3 tokens
      expect(shouldCache(smallContent)).toBe(false);
    });

    it('should respect custom minimum', () => {
      const content = 'a'.repeat(2000); // ~500 tokens
      expect(shouldCache(content, 1024)).toBe(false);
      expect(shouldCache(content, 400)).toBe(true);
    });
  });

  describe('formatCacheStats', () => {
    it('should format cache read stats', () => {
      const stats = formatCacheStats({
        promptTokens: 10000,
        cacheReadTokens: 4500,
      });

      expect(stats).toBe('Cache: 45% read (4,500 tokens)');
    });

    it('should format cache creation stats', () => {
      const stats = formatCacheStats({
        promptTokens: 10000,
        cacheCreationTokens: 3000,
      });

      expect(stats).toBe('Cache: 30% created (3,000 tokens)');
    });

    it('should format both read and creation', () => {
      const stats = formatCacheStats({
        promptTokens: 10000,
        cacheReadTokens: 4500,
        cacheCreationTokens: 1000,
      });

      expect(stats).toBe('Cache: 45% read (4,500 tokens), 10% created (1,000 tokens)');
    });

    it('should return null when no cache activity', () => {
      const stats = formatCacheStats({
        promptTokens: 10000,
      });

      expect(stats).toBeNull();
    });
  });

  describe('estimateCacheSavings', () => {
    it('should calculate savings with no cache hits', () => {
      const savings = estimateCacheSavings(10000, 0, 0.7);
      expect(savings).toBe(0); // No hits = no savings
    });

    it('should calculate savings with 50% hit rate', () => {
      const savings = estimateCacheSavings(10000, 0.5, 0.7);
      expect(savings).toBeCloseTo(31.5, 1);
    });

    it('should calculate savings with 100% hit rate', () => {
      const savings = estimateCacheSavings(10000, 1.0, 0.7);
      expect(savings).toBeCloseTo(63, 1);
    });

    it('should handle different cached percentages', () => {
      const savings50 = estimateCacheSavings(10000, 0.8, 0.5);
      const savings80 = estimateCacheSavings(10000, 0.8, 0.8);

      expect(savings80).toBeGreaterThan(savings50);
    });
  });

  describe('createCachedConversation', () => {
    it('should create conversation with system prompt', () => {
      const conversation = createCachedConversation({
        systemPrompt: 'You are helpful',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(conversation).toHaveLength(2);
      expect(conversation[0]).toEqual({
        role: 'system',
        content: 'You are helpful',
        cacheControl: { type: 'ephemeral' },
      });
    });

    it('should add context docs with last one cached', () => {
      const conversation = createCachedConversation({
        contextDocs: ['Doc 1', 'Doc 2', 'Doc 3'],
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(conversation).toHaveLength(4);
      expect(conversation[0].cacheControl).toBeUndefined();
      expect(conversation[1].cacheControl).toBeUndefined();
      expect(conversation[2].cacheControl).toEqual({ type: 'ephemeral' });
      expect(conversation[3].cacheControl).toBeUndefined();
    });

    it('should include user messages without caching', () => {
      const conversation = createCachedConversation({
        messages: [
          { role: 'user', content: 'Question 1' },
          { role: 'assistant', content: 'Answer 1' },
          { role: 'user', content: 'Question 2' },
        ],
      });

      conversation.slice(-3).forEach((msg) => {
        expect(msg.cacheControl).toBeUndefined();
      });
    });
  });

  describe('calculateCacheCost', () => {
    it('should calculate cost without caching', () => {
      const cost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 500,
      });

      expect(cost.total).toBeCloseTo(0.0375, 4);
      expect(cost.breakdown.input).toBeCloseTo(0.03, 4);
      expect(cost.breakdown.output).toBeCloseTo(0.0075, 4);
      expect(cost.breakdown.cacheWrite).toBe(0);
      expect(cost.breakdown.cacheRead).toBe(0);
      expect(cost.savings).toBe(0);
    });

    it('should calculate cost with cache creation', () => {
      const cost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 500,
        cacheCreationTokens: 7000,
      });

      const pricing = ANTHROPIC_PRICING['claude-3-5-sonnet-20241022'];
      const expectedCacheWrite = (7000 / 1_000_000) * pricing.cacheWrite;
      const expectedInput = (3000 / 1_000_000) * pricing.input;
      const expectedOutput = (500 / 1_000_000) * pricing.output;

      expect(cost.breakdown.cacheWrite).toBeCloseTo(expectedCacheWrite, 6);
      expect(cost.breakdown.input).toBeCloseTo(expectedInput, 6);
      expect(cost.breakdown.output).toBeCloseTo(expectedOutput, 6);
    });

    it('should calculate cost with cache read (savings)', () => {
      const cost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 500,
        cacheReadTokens: 7000,
      });

      const pricing = ANTHROPIC_PRICING['claude-3-5-sonnet-20241022'];
      const expectedCacheRead = (7000 / 1_000_000) * pricing.cacheRead;
      const expectedInput = (3000 / 1_000_000) * pricing.input;

      expect(cost.breakdown.cacheRead).toBeCloseTo(expectedCacheRead, 6);
      expect(cost.breakdown.input).toBeCloseTo(expectedInput, 6);

      // Should have significant savings
      expect(cost.savings).toBeGreaterThan(0);
    });

    it('should calculate savings correctly', () => {
      const withoutCache = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 500,
      });

      const withCache = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 500,
        cacheReadTokens: 7000,
      });

      // Cache read should be cheaper
      expect(withCache.total).toBeLessThan(withoutCache.total);

      // Savings should be positive
      expect(withCache.savings).toBeGreaterThan(0);

      // Savings should equal the difference
      expect(withCache.savings).toBeCloseTo(withoutCache.total - withCache.total, 6);
    });

    it('should work with different models', () => {
      const sonnetCost = calculateCacheCost({
        model: 'claude-3-5-sonnet-20241022',
        promptTokens: 10000,
        completionTokens: 500,
      });

      const haikuCost = calculateCacheCost({
        model: 'claude-3-5-haiku-20241022',
        promptTokens: 10000,
        completionTokens: 500,
      });

      // Haiku should be cheaper
      expect(haikuCost.total).toBeLessThan(sonnetCost.total);
    });
  });

  describe('ANTHROPIC_PRICING', () => {
    it('should have pricing for all models', () => {
      const models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
      ] as const;

      models.forEach((model) => {
        expect(ANTHROPIC_PRICING[model]).toBeDefined();
        expect(ANTHROPIC_PRICING[model].input).toBeGreaterThan(0);
        expect(ANTHROPIC_PRICING[model].output).toBeGreaterThan(0);
        expect(ANTHROPIC_PRICING[model].cacheWrite).toBeGreaterThan(0);
        expect(ANTHROPIC_PRICING[model].cacheRead).toBeGreaterThan(0);
      });
    });

    it('should have cache read at 10% of input', () => {
      Object.values(ANTHROPIC_PRICING).forEach((pricing) => {
        expect(pricing.cacheRead).toBeCloseTo(pricing.input * 0.1, 2);
      });
    });

    it('should have cache write at 125% of input', () => {
      Object.values(ANTHROPIC_PRICING).forEach((pricing) => {
        expect(pricing.cacheWrite).toBeCloseTo(pricing.input * 1.25, 2);
      });
    });
  });
});
