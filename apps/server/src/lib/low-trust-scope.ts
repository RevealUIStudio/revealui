/**
 * Parameter scope check for low_trust_review.
 * Tools with no extractor are denied. A loaded record must belong to the
 * scope account. Id equality alone is not ownership.
 */

import { getLowTrustLimits, type ResolvedTrust, type ReviewScope } from '@revealui/security';

export interface LoadedOwnership {
  accountId: string;
}

export interface LowTrustOwnershipLoader {
  load(kind: ReviewScope['kind'], id: string): Promise<LoadedOwnership | null>;
}

export type LowTrustScopeCheck =
  | { ok: true; targetId: string }
  | { ok: false; reason: 'low_trust_out_of_scope' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readId(params: unknown, key: string): string | null {
  if (!isRecord(params)) return null;
  const value = params[key];
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value !== value.trim()) return null;
  return value;
}

function extractTarget(
  toolName: string,
  params: unknown,
  scope: ReviewScope,
): { kind: ReviewScope['kind']; id: string } | null {
  if (toolName === 'get_document') {
    const id = readId(params, 'id');
    return id ? { kind: 'document', id } : null;
  }
  if (toolName === 'document_summarize') {
    const id = readId(params, 'documentId');
    return id ? { kind: 'document', id } : null;
  }
  if (toolName === 'add_ticket_comment') {
    const explicit = readId(params, 'ticketId');
    if (explicit) return { kind: 'ticket', id: explicit };
    if (scope.kind === 'ticket') return { kind: 'ticket', id: scope.id };
    return null;
  }
  return null;
}

export async function checkLowTrustScope(input: {
  toolName: string;
  params: unknown;
  trust: ResolvedTrust;
  loader: LowTrustOwnershipLoader | null;
}): Promise<LowTrustScopeCheck> {
  const scope = input.trust.scope;
  if (!scope) return { ok: false, reason: 'low_trust_out_of_scope' };
  const target = extractTarget(input.toolName, input.params, scope);
  if (!target) return { ok: false, reason: 'low_trust_out_of_scope' };
  if (target.kind !== scope.kind || target.id !== scope.id) {
    return { ok: false, reason: 'low_trust_out_of_scope' };
  }
  if (!input.loader) return { ok: false, reason: 'low_trust_out_of_scope' };
  const loaded = await input.loader.load(target.kind, target.id);
  if (!loaded || loaded.accountId !== scope.accountId) {
    return { ok: false, reason: 'low_trust_out_of_scope' };
  }
  return { ok: true, targetId: target.id };
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Largest string field, used to cap scoped low-trust output. */
export function maxStringBytes(value: unknown): number {
  if (typeof value === 'string') return utf8ByteLength(value);
  if (Array.isArray(value)) {
    let max = 0;
    for (const item of value) max = Math.max(max, maxStringBytes(item));
    return max;
  }
  if (isRecord(value)) {
    let max = 0;
    for (const item of Object.values(value)) max = Math.max(max, maxStringBytes(item));
    return max;
  }
  return 0;
}

export function lowTrustOutputExceedsCap(value: unknown): boolean {
  return maxStringBytes(value) > getLowTrustLimits().maxOutputBytes;
}
