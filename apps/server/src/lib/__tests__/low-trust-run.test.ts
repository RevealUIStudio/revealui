import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveStreamPrincipal, TrustResolveError } from '../agent-principal.js';
import { commitPrincipalTrust, TrustRunRefused } from '../low-trust-run.js';

const mockApplied = vi.fn();
const mockFailed = vi.fn();

vi.mock('../agent-tool-audit.js', () => ({
  recordAgentTrustPresetApplied: (...args: unknown[]) => mockApplied(...args),
  recordAgentTrustResolveFailed: (...args: unknown[]) => mockFailed(...args),
}));

const boundTrust = {
  preset: 'low_trust_review' as const,
  scope: { kind: 'ticket' as const, id: 'tkt-1', accountId: 'acct-1' },
  sources: ['task' as const],
};

function principalWith(trust: typeof boundTrust) {
  return resolveStreamPrincipal({
    mode: 'admin',
    userId: 'user-1',
    userRole: 'owner',
    accountId: 'acct-1',
    trust,
  });
}

describe('commitPrincipalTrust', () => {
  beforeEach(() => {
    mockApplied.mockReset();
    mockFailed.mockReset();
    mockApplied.mockResolvedValue(undefined);
    mockFailed.mockResolvedValue(undefined);
  });

  it('does nothing when the mode is off', async () => {
    await commitPrincipalTrust({
      principal: principalWith(boundTrust),
      mode: 'off',
    });
    expect(mockApplied).not.toHaveBeenCalled();
    expect(mockFailed).not.toHaveBeenCalled();
  });

  it('records preset_applied for a resolved low_trust run', async () => {
    await commitPrincipalTrust({
      principal: principalWith(boundTrust),
      mode: 'enforce',
      taskId: 'tkt-1',
    });
    expect(mockApplied).toHaveBeenCalledOnce();
    expect(mockApplied.mock.calls[0]?.[0]).toMatchObject({
      preset: 'low_trust_review',
      scopeId: 'tkt-1',
      sources: ['task'],
    });
  });

  it('refuses enforce when preset_applied cannot be recorded', async () => {
    mockApplied.mockRejectedValueOnce(new Error('audit down'));
    await expect(
      commitPrincipalTrust({
        principal: principalWith(boundTrust),
        mode: 'enforce',
      }),
    ).rejects.toBeInstanceOf(TrustRunRefused);
  });

  it('records resolve_failed and throws in enforce', async () => {
    const principal = resolveStreamPrincipal({
      mode: 'admin',
      userId: 'user-1',
      userRole: 'owner',
      accountId: 'acct-1',
      trustLayers: [{ source: 'task', preset: 'low_trust_review', origin: 'server' }],
    });
    await expect(commitPrincipalTrust({ principal, mode: 'enforce' })).rejects.toBeInstanceOf(
      TrustResolveError,
    );
    expect(mockFailed).toHaveBeenCalledOnce();
  });

  it('records resolve_failed and continues in shadow', async () => {
    const principal = resolveStreamPrincipal({
      mode: 'admin',
      userId: 'user-1',
      userRole: 'owner',
      accountId: 'acct-1',
      trustLayers: [{ source: 'task', preset: 'low_trust_review', origin: 'server' }],
    });
    await expect(commitPrincipalTrust({ principal, mode: 'shadow' })).resolves.toBeUndefined();
    expect(mockFailed).toHaveBeenCalledOnce();
  });
});
