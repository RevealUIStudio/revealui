/**
 * AI Feature Gate Middleware Tests (GAP-477)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsFeatureEnabled = vi.fn();
const mockAccountHasFeature = vi.fn();
const mockGetClient = vi.fn(() => ({}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
}));

vi.mock('@revealui/db/client', () => ({
  getClient: () => mockGetClient(),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/access/account-feature', () => ({
  accountHasFeature: (...args: unknown[]) => mockAccountHasFeature(...args),
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
    vi.unstubAllEnvs();
    mockAccountHasFeature.mockResolvedValue(false);
    mockIsFeatureEnabled.mockReturnValue(false);
  });

  async function loadFn() {
    vi.resetModules();
    const mod = await import('../ai-feature-gate.js');
    return mod.checkAIFeatureGate;
  }

  it('returns 401 when userId is missing', async () => {
    const checkAIFeatureGate = await loadFn();
    const result = await checkAIFeatureGate(null);
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(401);
  });

  it('returns null when account entitlements grant ai', async () => {
    mockAccountHasFeature.mockResolvedValue(true);
    const checkAIFeatureGate = await loadFn();

    const result = await checkAIFeatureGate('user-1');
    expect(result).toBeNull();
    expect(mockAccountHasFeature).toHaveBeenCalled();
    expect(mockIsFeatureEnabled).not.toHaveBeenCalled();
  });

  it('falls back to process isFeatureEnabled when account lacks feature', async () => {
    mockAccountHasFeature.mockResolvedValue(false);
    mockIsFeatureEnabled.mockReturnValue(true);
    const checkAIFeatureGate = await loadFn();

    const result = await checkAIFeatureGate('user-1');
    expect(result).toBeNull();
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('ai');
  });

  it('returns 403 when neither account nor process license grants ai', async () => {
    mockAccountHasFeature.mockResolvedValue(false);
    mockIsFeatureEnabled.mockReturnValue(false);
    const checkAIFeatureGate = await loadFn();

    const result = await checkAIFeatureGate('user-1');
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(403);
    expect((result as unknown as { body: { error: string } }).body).toEqual({
      error: 'AI features require a Pro license',
    });
  });

  it('allows when REVEALUI_ALLOW_DEV_FEATURE_BYPASS=1', async () => {
    vi.stubEnv('REVEALUI_ALLOW_DEV_FEATURE_BYPASS', '1');
    const checkAIFeatureGate = await loadFn();

    const result = await checkAIFeatureGate('user-1');
    expect(result).toBeNull();
    expect(mockAccountHasFeature).not.toHaveBeenCalled();
  });

  it('does not bypass on NODE_ENV=development alone', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('REVEALUI_ALLOW_DEV_FEATURE_BYPASS', '');
    mockAccountHasFeature.mockResolvedValue(false);
    mockIsFeatureEnabled.mockReturnValue(false);
    const checkAIFeatureGate = await loadFn();

    const result = await checkAIFeatureGate('user-1');
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(403);
  });

  it('falls back to process license when getClient throws (no DB in unit tests)', async () => {
    mockGetClient.mockImplementation(() => {
      throw new Error('Database connection string not provided');
    });
    mockIsFeatureEnabled.mockReturnValue(true);
    const checkAIFeatureGate = await loadFn();

    const result = await checkAIFeatureGate('user-1');
    expect(result).toBeNull();
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith('ai');
    expect(mockAccountHasFeature).not.toHaveBeenCalled();
  });
});
