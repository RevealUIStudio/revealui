/**
 * When HOSTED_BYOK_DISPATCH is explicitly off on a hosted deployment, the
 * shared env model key stays refused. The warning fires once per process so
 * an operator can see the flag is set. Per-account resolution still runs.
 *
 * Isolated in its own file so the module-level once-guard starts fresh.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { warnSpy, mockCreateFromEnv } = vi.hoisted(() => ({
  warnSpy: vi.fn(),
  mockCreateFromEnv: vi.fn().mockReturnValue({ source: 'env' }),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: warnSpy,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../client.js', () => ({
  createLLMClientForUser: vi.fn(),
  createLLMClientFromEnv: mockCreateFromEnv,
  isHostedViable: () => true,
  LLMClient: class {},
}));
vi.mock('@revealui/db/crypto', () => ({ decryptApiKey: (s: string) => s }));
vi.mock('@revealui/db/schema', () => ({ workspaceInferenceConfigs: {} }));
vi.mock('drizzle-orm', () => ({ eq: () => ({}) }));

import type { Database } from '@revealui/db/client';
import { resolveLLMClientForRequest } from '../resolve.js';

const db = {} as Database;

beforeEach(() => {
  warnSpy.mockClear();
  delete process.env.HOSTED_BYOK_DISPATCH;
});

describe('resolveLLMClientForRequest — hosted break-glass warning', () => {
  it('warns once when HOSTED_BYOK_DISPATCH=off on a hosted deployment and does not build an env client', async () => {
    process.env.HOSTED_BYOK_DISPATCH = 'off';

    await expect(
      resolveLLMClientForRequest('user-1', db, { isHosted: true }),
    ).rejects.toMatchObject({ code: 'LLM_NOT_CONFIGURED' });
    await expect(
      resolveLLMClientForRequest('user-1', db, { isHosted: true }),
    ).rejects.toMatchObject({ code: 'LLM_NOT_CONFIGURED' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('HOSTED_BYOK_DISPATCH');
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('refused');
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });

  it('does not warn on self-hosted (the flag off is the normal default there)', async () => {
    await resolveLLMClientForRequest('user-1', db, { isHosted: false });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn on hosted when the flag is on (normal path)', async () => {
    process.env.HOSTED_BYOK_DISPATCH = 'on';
    await resolveLLMClientForRequest('user-1', db, { isHosted: true }).catch(() => undefined);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });
});
