import { describe, expect, it } from 'vitest';
import { authorizeToolCall, type McpAuthClaims, validateMcpClaims } from '../auth.js';

// ---------------------------------------------------------------------------
// validateMcpClaims
// ---------------------------------------------------------------------------

describe('validateMcpClaims', () => {
  const validPayload = {
    sub: 'tenant-123',
    tier: 'pro',
    iss: 'revealui',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  it('accepts valid claims', () => {
    const result = validateMcpClaims(validPayload);
    expect(result.valid).toBe(true);
    expect(result.claims).toMatchObject({ sub: 'tenant-123', tier: 'pro' });
  });

  it('accepts claims without optional fields', () => {
    const result = validateMcpClaims({ sub: 'tenant-1', tier: 'free' });
    expect(result.valid).toBe(true);
    expect(result.claims?.tier).toBe('free');
  });

  it('accepts claims with permissions', () => {
    const result = validateMcpClaims({
      sub: 'tenant-1',
      tier: 'enterprise',
      permissions: ['tool_a', 'tool_b'],
    });
    expect(result.valid).toBe(true);
    expect(result.claims?.permissions).toEqual(['tool_a', 'tool_b']);
  });

  it('rejects expired tokens', () => {
    const result = validateMcpClaims({
      ...validPayload,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('checks expiration before schema validation', () => {
    const result = validateMcpClaims({
      exp: Math.floor(Date.now() / 1000) - 60,
      // missing sub and tier  -  but should fail on expiration first
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('rejects missing sub', () => {
    const result = validateMcpClaims({ tier: 'pro' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch('Invalid claims');
  });

  it('rejects missing tier', () => {
    const result = validateMcpClaims({ sub: 'tenant-1' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch('Invalid claims');
  });

  it('rejects invalid tier value', () => {
    const result = validateMcpClaims({ sub: 'tenant-1', tier: 'platinum' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch('Invalid claims');
  });

  it('rejects non-object payloads', () => {
    expect(validateMcpClaims(null).valid).toBe(false);
    expect(validateMcpClaims('string').valid).toBe(false);
    expect(validateMcpClaims(42).valid).toBe(false);
  });

  it('passes tokens with no exp (no expiration set)', () => {
    const result = validateMcpClaims({ sub: 'tenant-1', tier: 'free' });
    expect(result.valid).toBe(true);
  });

  it('accepts all valid tier values', () => {
    for (const tier of ['free', 'pro', 'max', 'enterprise']) {
      const result = validateMcpClaims({ sub: 'tenant-1', tier });
      expect(result.valid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// authorizeToolCall
// ---------------------------------------------------------------------------

describe('authorizeToolCall', () => {
  const makeClaims = (tier: McpAuthClaims['tier'], permissions?: string[]): McpAuthClaims => ({
    sub: 'tenant-123',
    tier,
    ...(permissions ? { permissions } : {}),
  });

  describe('tier-based authorization', () => {
    it('allows free tool for free tier', () => {
      const result = authorizeToolCall(makeClaims('free'), 'tool_a', 'free');
      expect(result.authorized).toBe(true);
    });

    it('allows free tool for higher tiers', () => {
      expect(authorizeToolCall(makeClaims('pro'), 'tool_a', 'free').authorized).toBe(true);
      expect(authorizeToolCall(makeClaims('max'), 'tool_a', 'free').authorized).toBe(true);
      expect(authorizeToolCall(makeClaims('enterprise'), 'tool_a', 'free').authorized).toBe(true);
    });

    it('denies pro tool for free tier', () => {
      const result = authorizeToolCall(makeClaims('free'), 'tool_a', 'pro');
      expect(result.authorized).toBe(false);
      expect(result.reason).toMatch('requires pro tier');
    });

    it('denies enterprise tool for pro tier', () => {
      const result = authorizeToolCall(makeClaims('pro'), 'tool_a', 'enterprise');
      expect(result.authorized).toBe(false);
      expect(result.reason).toMatch('requires enterprise tier');
    });

    it('allows enterprise tool for enterprise tier', () => {
      expect(authorizeToolCall(makeClaims('enterprise'), 'tool_a', 'enterprise').authorized).toBe(
        true,
      );
    });

    it('defaults requiredTier to free', () => {
      expect(authorizeToolCall(makeClaims('free'), 'tool_a').authorized).toBe(true);
    });

    it('respects full tier ordering', () => {
      const tiers: McpAuthClaims['tier'][] = ['free', 'pro', 'max', 'enterprise'];
      for (let i = 0; i < tiers.length; i++) {
        for (let j = 0; j < tiers.length; j++) {
          const result = authorizeToolCall(makeClaims(tiers[i]!), 'tool', tiers[j]!);
          expect(result.authorized).toBe(i >= j);
        }
      }
    });
  });

  describe('permissions-based authorization', () => {
    it('allows tool in permissions list', () => {
      const result = authorizeToolCall(makeClaims('pro', ['tool_a', 'tool_b']), 'tool_a', 'free');
      expect(result.authorized).toBe(true);
    });

    it('denies tool not in permissions list', () => {
      const result = authorizeToolCall(makeClaims('pro', ['tool_a']), 'tool_b', 'free');
      expect(result.authorized).toBe(false);
      expect(result.reason).toMatch('not in permissions list');
    });

    it('allows wildcard permission', () => {
      const result = authorizeToolCall(makeClaims('pro', ['*']), 'any_tool', 'free');
      expect(result.authorized).toBe(true);
    });

    it('requires BOTH tier AND permissions to pass', () => {
      // Has permission but wrong tier
      const result = authorizeToolCall(makeClaims('free', ['tool_a']), 'tool_a', 'pro');
      expect(result.authorized).toBe(false);
      expect(result.reason).toMatch('requires pro tier');
    });

    it('skips permissions check when permissions array is empty', () => {
      const result = authorizeToolCall(makeClaims('pro', []), 'tool_a', 'free');
      expect(result.authorized).toBe(true);
    });

    it('skips permissions check when permissions is undefined', () => {
      const result = authorizeToolCall(makeClaims('pro'), 'tool_a', 'free');
      expect(result.authorized).toBe(true);
    });
  });
});
