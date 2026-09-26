/**
 * Run-start trust commit. Enforce refuses the run when resolution fails or
 * when preset_applied cannot be recorded. Shadow records and continues.
 */

import type { Database } from '@revealui/db/client';
import type { LowTrustMode } from '@revealui/security';
import { type AgentPrincipal, TrustResolveError } from './agent-principal.js';
import {
  recordAgentTrustPresetApplied,
  recordAgentTrustResolveFailed,
} from './agent-tool-audit.js';

export class TrustRunRefused extends Error {
  readonly code = 'TRUST_RESOLVE_FAILED' as const;

  constructor(readonly reason: string) {
    super(`Trust run refused: ${reason}`);
    this.name = 'TrustRunRefused';
  }
}

export function trustRefusalReason(err: unknown): string | null {
  if (err instanceof TrustResolveError || err instanceof TrustRunRefused) return err.reason;
  return null;
}

export async function commitPrincipalTrust(input: {
  principal: AgentPrincipal;
  mode: LowTrustMode;
  db?: Database;
  sessionId?: string;
  taskId?: string;
}): Promise<void> {
  if (input.mode === 'off') return;
  const { principal } = input;
  const common = {
    accountId: principal.accountId,
    userId: principal.actingUserId,
    agentId: principal.agentId,
    sessionId: input.sessionId,
    taskId: input.taskId,
    db: input.db,
    principalKind: principal.kind,
    preset: principal.trust.preset,
    scopeId: principal.trust.scope?.id ?? null,
    source: principal.trust.sources[0],
  };

  if (principal.trustResolveFailure) {
    try {
      await recordAgentTrustResolveFailed({
        ...common,
        reason: principal.trustResolveFailure.reason,
        sources: principal.trustResolveFailure.sources,
      });
    } catch {
      if (input.mode === 'enforce') throw new TrustRunRefused('resolve_failed_audit_failed');
      return;
    }
    if (input.mode === 'enforce') {
      throw new TrustResolveError(
        principal.trustResolveFailure.reason,
        principal.trustResolveFailure.sources,
      );
    }
    return;
  }

  if (principal.trust.preset !== 'low_trust_review') return;

  try {
    await recordAgentTrustPresetApplied({
      ...common,
      scope: principal.trust.scope,
      sources: principal.trust.sources,
    });
  } catch {
    if (input.mode === 'enforce') throw new TrustRunRefused('preset_applied_audit_failed');
  }
}
