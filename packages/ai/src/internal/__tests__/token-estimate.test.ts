import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../token-estimate.js';

describe('estimateTokens', () => {
  it('uses ~4 characters per token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('ceil-rounds partial buckets', () => {
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('treats empty string as zero tokens', () => {
    expect(estimateTokens('')).toBe(0);
  });
});
