import { type MemoryPrincipal, type MemoryResult, STUDIO_LOCAL_TENANT } from './types.js';

export function principalMissing<T>(message: string): MemoryResult<T> {
  return {
    status: 'unavailable',
    available: false,
    reason: 'principal-missing',
    message,
  };
}

export function validatePrincipal(principal: MemoryPrincipal | null | undefined): string | null {
  if (!principal) return 'principal is required';
  if (!(principal.did && principal.agentId && principal.fingerprint)) {
    return 'principal did, agentId, and fingerprint are required';
  }
  if (!principal.did.startsWith('did:revfleet:')) return 'principal did must use did:revfleet:';
  if (!principal.tenantId) return 'principal tenantId is required';
  if (principal.trustBoundary !== 'studio-local' && principal.trustBoundary !== 'hosted') {
    return 'principal trustBoundary is required';
  }
  if (typeof principal.isFleetOperator !== 'boolean') {
    return 'principal isFleetOperator is required';
  }
  if (principal.trustBoundary === 'hosted' && principal.tenantId === STUDIO_LOCAL_TENANT) {
    return 'hosted mount rejects tenantId studio-local';
  }
  return null;
}
