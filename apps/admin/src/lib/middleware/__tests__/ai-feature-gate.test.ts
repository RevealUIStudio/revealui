/**
 * AI Feature Gate Middleware Tests
 *
 * Tests for checkAIFeatureGate() which gates Pro AI features behind a license check.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsFeatureEnabled = vi.fn();

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;

    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }

    static json(data: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(data, init);
    }
  }

  return { NextResponse: MockNextResponse };
});

describe('checkAIFeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadFn() {
    const mod = await import('../ai-feature-gate.js');
    return mod.checkAIFeatureGate;
  }

  it('returns null when AI features are enabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(true);
    const checkAIFeatureGate = await loadFn();

    const result = checkAIFeatureGate();
    expect(result).toBeNull();
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('ai');
  });

  it('returns 403 response when AI features are not enabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);
    const checkAIFeatureGate = await loadFn();

    const result = checkAIFeatureGate();
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(403);
    expect((result as unknown as { body: { error: string } }).body).toEqual({
      error: 'AI features require a Pro license',
    });
  });
});
