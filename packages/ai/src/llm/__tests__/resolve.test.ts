/**
 * GAP-360 PR-2 — resolver order + security invariants (spec §5.2 / §6).
 *
 * Mocks the client factories and the DB so the resolution ORDER and the
 * hosted fail-closed invariants are exercised in isolation. No real DB, no
 * real crypto (§6 is behavioral, pinned here).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateForUser, mockCreateFromEnv, mockDecrypt, FakeLLMClient } = vi.hoisted(() => {
  class FakeLLMClient {
    constructor(public readonly cfg: Record<string, unknown>) {}
  }
  return {
    mockCreateForUser: vi.fn(),
    mockCreateFromEnv: vi.fn(),
    mockDecrypt: vi.fn((s: string) => `plaintext:${s}`),
    FakeLLMClient,
  };
});

vi.mock('../client.js', () => ({
  createLLMClientForUser: (...args: unknown[]) => mockCreateForUser(...args),
  createLLMClientFromEnv: (...args: unknown[]) => mockCreateFromEnv(...args),
  // hostedViable = cloud providers only; localhost providers are false.
  isHostedViable: (p: string) =>
    p === 'anthropic' || p === 'openai' || p === 'groq' || p === 'huggingface',
  LLMClient: FakeLLMClient,
}));

vi.mock('@revealui/db/crypto', () => ({ decryptApiKey: (s: string) => mockDecrypt(s) }));
vi.mock('@revealui/db/schema', () => ({ workspaceInferenceConfigs: { workspaceId: {} } }));
vi.mock('drizzle-orm', () => ({ eq: (a: unknown, b: unknown) => ({ a, b }) }));

import type { Database } from '@revealui/db/client';
import {
  hostedByokDispatchEnabled,
  LLMNotConfiguredError,
  llmNotConfiguredBody,
  resolveLLMClientForRequest,
} from '../resolve.js';

/** Fake db whose site-config query resolves to `siteRows`. */
function makeDb(siteRows: unknown[]): Database {
  return {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => siteRows }) }),
    }),
  } as unknown as Database;
}

const ENV_SENTINEL = { source: 'env' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateFromEnv.mockReturnValue(ENV_SENTINEL);
  mockCreateForUser.mockResolvedValue(null);
  delete process.env.HOSTED_BYOK_DISPATCH;
});

describe('hostedByokDispatchEnabled — flag semantics (§7)', () => {
  it('defaults to ON when hosted, OFF when self-hosted', () => {
    expect(hostedByokDispatchEnabled(true)).toBe(true);
    expect(hostedByokDispatchEnabled(false)).toBe(false);
  });

  it('an explicit off value forces OFF even on hosted', () => {
    for (const value of ['false', '0', 'off', 'no', 'OFF']) {
      process.env.HOSTED_BYOK_DISPATCH = value;
      expect(hostedByokDispatchEnabled(true)).toBe(false);
    }
  });

  it('an explicit on value forces ON even on self-hosted', () => {
    for (const value of ['true', '1', 'on', 'yes']) {
      process.env.HOSTED_BYOK_DISPATCH = value;
      expect(hostedByokDispatchEnabled(false)).toBe(true);
    }
  });

  it('an unrecognized value falls back to the deployment default', () => {
    process.env.HOSTED_BYOK_DISPATCH = 'maybe';
    expect(hostedByokDispatchEnabled(true)).toBe(true);
    expect(hostedByokDispatchEnabled(false)).toBe(false);
  });
});

describe('resolveLLMClientForRequest — resolution order (§5.2)', () => {
  it('branch 1: per-user BYOK is preferred', async () => {
    const byok = new FakeLLMClient({ source: 'byok' });
    mockCreateForUser.mockResolvedValue(byok);

    const result = await resolveLLMClientForRequest('user-1', makeDb([]), { isHosted: true });

    expect(result).toBe(byok);
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });

  it('branch 2: site inference config when no BYOK (hostedViable provider)', async () => {
    const result = await resolveLLMClientForRequest(
      'user-1',
      makeDb([{ provider: 'openai', encryptedApiKey: 'enc', model: 'gpt-4o' }]),
      {
        isHosted: true,
        workspaceId: 'site-1',
      },
    );

    expect(result).toBeInstanceOf(FakeLLMClient);
    expect((result as FakeLLMClient).cfg.provider).toBe('openai');
    expect((result as FakeLLMClient).cfg.apiKey).toBe('plaintext:enc');
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });

  it('branch 3: deployment env on SELF-HOSTED when nothing above', async () => {
    process.env.HOSTED_BYOK_DISPATCH = 'on'; // force the new order on self-hosted
    const result = await resolveLLMClientForRequest('user-1', makeDb([]), { isHosted: false });

    expect(result).toBe(ENV_SENTINEL);
    expect(mockCreateFromEnv).toHaveBeenCalledTimes(1);
  });

  it('branch 4: hosted + nothing above throws LLMNotConfiguredError', async () => {
    await expect(
      resolveLLMClientForRequest('user-1', makeDb([]), { isHosted: true }),
    ).rejects.toBeInstanceOf(LLMNotConfiguredError);
  });

  it('flag OFF (self-hosted default) returns env directly — byte-unchanged', async () => {
    const byok = new FakeLLMClient({ source: 'byok' });
    mockCreateForUser.mockResolvedValue(byok);

    const result = await resolveLLMClientForRequest('user-1', makeDb([]), { isHosted: false });

    // Flag off → env path, BYOK is never even attempted.
    expect(result).toBe(ENV_SENTINEL);
    expect(mockCreateForUser).not.toHaveBeenCalled();
  });
});

describe('resolveLLMClientForRequest — security invariants (§6)', () => {
  // §6.5 — the defining invariant: hosted must NEVER fall through to env.
  it('hosted with no config throws and never calls the env factory', async () => {
    await expect(
      resolveLLMClientForRequest('user-1', makeDb([]), { isHosted: true }),
    ).rejects.toBeInstanceOf(LLMNotConfiguredError);
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });

  // §6.1 — userId flows from the argument only; the resolver has no request access.
  it('passes the exact userId argument to the BYOK factory', async () => {
    await resolveLLMClientForRequest('authenticated-owner', makeDb([]), { isHosted: true }).catch(
      () => undefined,
    );
    expect(mockCreateForUser).toHaveBeenCalledWith(
      'authenticated-owner',
      expect.anything(),
      undefined,
      { hostedViableOnly: true },
    );
  });

  it('skips the BYOK factory entirely when userId is null', async () => {
    await resolveLLMClientForRequest(null, makeDb([]), { isHosted: true }).catch(() => undefined);
    expect(mockCreateForUser).not.toHaveBeenCalled();
  });

  // §6.5 — fail-closed on a failed decrypt / bad row, never env on hosted.
  it('fails closed (409, no env) when the BYOK factory throws on hosted', async () => {
    mockCreateForUser.mockRejectedValue(new Error('decrypt failed'));

    await expect(
      resolveLLMClientForRequest('user-1', makeDb([]), { isHosted: true }),
    ).rejects.toBeInstanceOf(LLMNotConfiguredError);
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });

  // §6.5 — a non-hostedViable site config on hosted is skipped, not localhost-served.
  it('skips a non-hostedViable site config on hosted and fails closed', async () => {
    await expect(
      resolveLLMClientForRequest(
        'user-1',
        makeDb([{ provider: 'ollama', encryptedApiKey: null }]),
        {
          isHosted: true,
          workspaceId: 'site-1',
        },
      ),
    ).rejects.toBeInstanceOf(LLMNotConfiguredError);
    expect(mockCreateFromEnv).not.toHaveBeenCalled();
  });

  // §6.5 — requests hostedViable filtering from the BYOK factory on hosted.
  it('requests hostedViableOnly from the BYOK factory on hosted, not on self-hosted', async () => {
    await resolveLLMClientForRequest('u', makeDb([]), { isHosted: true }).catch(() => undefined);
    expect(mockCreateForUser).toHaveBeenLastCalledWith('u', expect.anything(), undefined, {
      hostedViableOnly: true,
    });

    process.env.HOSTED_BYOK_DISPATCH = 'on';
    mockCreateForUser.mockResolvedValue(new FakeLLMClient({ source: 'byok' }));
    await resolveLLMClientForRequest('u', makeDb([]), { isHosted: false });
    expect(mockCreateForUser).toHaveBeenLastCalledWith('u', expect.anything(), undefined, {
      hostedViableOnly: false,
    });
  });
});

describe('LLMNotConfiguredError — 409 mapping (§5.2)', () => {
  it('carries the machine-readable code and settings path', () => {
    const err = new LLMNotConfiguredError();
    expect(err.code).toBe('LLM_NOT_CONFIGURED');
    expect(err.settingsPath).toBe('/settings/api-keys');
    expect(err.name).toBe('LLMNotConfiguredError');
  });

  it('llmNotConfiguredBody produces the actionable 409 body', () => {
    const err = new LLMNotConfiguredError('nope');
    expect(llmNotConfiguredBody(err)).toEqual({
      success: false,
      error: 'nope',
      code: 'LLM_NOT_CONFIGURED',
      settingsPath: '/settings/api-keys',
    });
  });
});
