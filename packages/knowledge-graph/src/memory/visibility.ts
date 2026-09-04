import { MEMORY_SCHEMA, type MemoryPrincipal, type MemoryScope } from './types.js';

export interface EpisodeScopeRef {
  schema?: unknown;
  actorDid?: unknown;
  scope?: {
    tenantId?: unknown;
    workspaceId?: unknown;
    classification?: unknown;
  };
}

function asScope(raw: EpisodeScopeRef['scope']): MemoryScope | null {
  if (!raw || typeof raw.tenantId !== 'string' || raw.tenantId.length === 0) return null;
  const classification = raw.classification === 'private' ? 'private' : 'workspace';
  return {
    tenantId: raw.tenantId,
    workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : undefined,
    classification,
  };
}

/**
 * Pure visibility predicate. Tenant mismatch is always deny.
 * Workspace: writer-set + reader-unset is deny (no silent widen).
 */
export function episodeVisible(principal: MemoryPrincipal, contentRef: EpisodeScopeRef): boolean {
  if (contentRef.schema !== MEMORY_SCHEMA) return false;
  const scope = asScope(contentRef.scope);
  if (!scope) return false;
  if (scope.tenantId !== principal.tenantId) return false;
  if (scope.classification === 'private') {
    return typeof contentRef.actorDid === 'string' && contentRef.actorDid === principal.did;
  }
  const writerWs = scope.workspaceId;
  const readerWs = principal.workspaceId;
  if (!writerWs) return true;
  if (!readerWs) return false;
  return writerWs === readerWs;
}
