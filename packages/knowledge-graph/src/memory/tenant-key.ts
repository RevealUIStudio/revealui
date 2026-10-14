/**
 * Hosted non-operator namespace. One helper for write and read.
 * Agent DIDs must not be passed in.
 */
import { type MemoryClassification, type MemoryPrincipal, STUDIO_LOCAL_TENANT } from './types.js';

export function tenantNaturalKey(tenantId: string, clientKey: string): string {
  const prefix = `tenant:${tenantId}:`;
  if (clientKey.startsWith(prefix)) return clientKey;
  return `${prefix}${clientKey}`;
}

export function shouldNamespaceKeys(principal: {
  trustBoundary: 'studio-local' | 'hosted';
  isFleetOperator: boolean;
}): boolean {
  return principal.trustBoundary === 'hosted' && !principal.isFleetOperator;
}

/** Scope node metadata as well as episode provenance. Canonical read keys stay usable. */
export function scopedMemoryNaturalKey(
  principal: MemoryPrincipal,
  classification: MemoryClassification,
  clientKey: string,
): string {
  const prefix =
    classification === 'private'
      ? `private:${principal.did}:`
      : principal.workspaceId
        ? `workspace:${encodeURIComponent(principal.workspaceId)}:`
        : '';
  const tenantPrefix =
    principal.tenantId !== STUDIO_LOCAL_TENANT ? `tenant:${principal.tenantId}:` : '';
  const key =
    tenantPrefix && clientKey.startsWith(tenantPrefix)
      ? clientKey.slice(tenantPrefix.length)
      : clientKey;
  if (
    classification === 'workspace' &&
    (key.startsWith('private:') ||
      (key.startsWith('workspace:') && !(prefix && key.startsWith(prefix))))
  )
    throw new Error('Memory key belongs to a different scope');
  const scoped = prefix && !key.startsWith(prefix) ? `${prefix}${key}` : key;
  return `${tenantPrefix}${scoped}`;
}
