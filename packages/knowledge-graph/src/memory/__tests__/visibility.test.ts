import { describe, expect, it } from 'vitest';
import { MEMORY_SCHEMA, type MemoryPrincipal } from '../types.js';
import { episodeVisible } from '../visibility.js';

function principal(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revfleet:agent-a:fp1',
    agentId: 'agent-a',
    fingerprint: 'fp1',
    didKind: 'agent-key',
    harness: 'grok',
    tenantId: 'acct_1',
    trustBoundary: 'hosted',
    isFleetOperator: false,
    ...partial,
  };
}

function ref(scope: {
  tenantId: string;
  workspaceId?: string;
  classification?: 'private' | 'workspace';
  actorDid?: string;
}) {
  return {
    schema: MEMORY_SCHEMA,
    actorDid: scope.actorDid ?? 'did:revfleet:agent-a:fp1',
    scope: {
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
      classification: scope.classification ?? 'workspace',
    },
  };
}

describe('episodeVisible', () => {
  it('denies tenant mismatch', () => {
    expect(episodeVisible(principal(), ref({ tenantId: 'acct_other' }))).toBe(false);
  });

  it('allows tenant-wide workspace facts to any reader in the tenant', () => {
    expect(episodeVisible(principal({ workspaceId: 'ws-1' }), ref({ tenantId: 'acct_1' }))).toBe(
      true,
    );
    expect(episodeVisible(principal(), ref({ tenantId: 'acct_1' }))).toBe(true);
  });

  it('does not silently widen a workspace-scoped fact to a tenant-wide reader', () => {
    expect(episodeVisible(principal(), ref({ tenantId: 'acct_1', workspaceId: 'ws-1' }))).toBe(
      false,
    );
  });

  it('allows matching workspace ids', () => {
    expect(
      episodeVisible(
        principal({ workspaceId: 'ws-1' }),
        ref({ tenantId: 'acct_1', workspaceId: 'ws-1' }),
      ),
    ).toBe(true);
  });

  it('restricts private facts to the writing DID', () => {
    expect(
      episodeVisible(
        principal({ did: 'did:revfleet:other:fp' }),
        ref({ tenantId: 'acct_1', classification: 'private' }),
      ),
    ).toBe(false);
    expect(
      episodeVisible(principal(), ref({ tenantId: 'acct_1', classification: 'private' })),
    ).toBe(true);
  });

  it('rejects non-memory schema', () => {
    expect(
      episodeVisible(principal(), {
        schema: 'other',
        actorDid: 'did:revfleet:agent-a:fp1',
        scope: { tenantId: 'acct_1', classification: 'workspace' },
      }),
    ).toBe(false);
  });
});
