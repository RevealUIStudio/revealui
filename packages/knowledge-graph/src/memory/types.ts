import type { EdgeRelation, NodeKind } from '../ontology/index.js';
import type { KgSearchResult } from '../search/index.js';
import type { EdgeInput, NodeInput } from '../types.js';

export const MEMORY_SCHEMA = 'revealui.memory.v1';
export const MEMORY_MAX_NODES = 32;
export const MEMORY_MAX_EDGES = 64;
export const MEMORY_MAX_CONTENT_CHARS = 20_000;
export const STUDIO_LOCAL_TENANT = 'studio-local';

/** v1: `public` is omitted. */
export type MemoryClassification = 'private' | 'workspace';

export type MemoryHarness =
  | 'claude'
  | 'grok'
  | 'cursor'
  | 'opencode'
  | 'revdev'
  | 'hermes'
  | 'other';

export interface MemoryPrincipal {
  /** `did:revfleet:{agentId}:{fingerprint}` */
  did: string;
  agentId: string;
  fingerprint: string;
  didKind: 'agent-key' | 'user-account-fallback';
  harness: MemoryHarness;
  /**
   * Hosted: entitlements.accountId. Studio stdio: literal `studio-local`.
   */
  tenantId: string;
  workspaceId?: string;
  trustBoundary: 'studio-local' | 'hosted';
  /** Platform super-admin only. Not CMS owner/admin. */
  isFleetOperator: boolean;
}

export interface MemoryScope {
  tenantId: string;
  workspaceId?: string;
  /** Existing kg_nodes.repo partition key. Not an ownership predicate. */
  repo?: string;
  classification: MemoryClassification;
}

export type MemoryResult<T> =
  | {
      status: 'ok';
      available: true;
      enforcement: 'enforced' | 'deferred';
      deniedCount: number;
      data: T;
    }
  | {
      status: 'denied';
      available: true;
      reason: 'scope-denied';
      scope: MemoryScope;
      message: string;
      deniedCount: number;
    }
  | {
      status: 'unavailable';
      available: false;
      reason:
        | 'kg-database-unavailable'
        | 'principal-missing'
        | 'timeout'
        | 'scope-enforcement-unwired'
        | 'electric-unavailable'
        | 'payload-too-large'
        | string;
      message: string;
    };

export type ClaimKind = 'file' | 'unit' | 'intent';

export interface MemoryPublishInput {
  principal: MemoryPrincipal;
  scope: MemoryScope;
  episodeType?: 'agent-fact' | 'memory' | 'manual';
  summary: string;
  subjects: NodeInput[];
  claim?: {
    kind: ClaimKind;
    status: 'open' | 'resolved';
    paths?: string[];
    unit?: string;
  };
  extraEdges?: EdgeInput[];
  referenceTime?: Date;
  siteId: string;
  timeoutMs?: number;
}

export interface MemoryPublishData {
  episodeId: string;
  nodeCount: number;
  edgeCount: number;
}

export interface MemoryQuery {
  principal: MemoryPrincipal;
  query: string;
  relations?: Array<'discovered' | 'mentions' | 'relates-to' | EdgeRelation>;
  kinds?: NodeKind[];
  repo?: string;
  limit?: number;
  at?: Date;
  timeoutMs?: number;
}

export interface AdvisoryClaim {
  edgeId: string;
  sourceNaturalKey: string;
  targetNaturalKey: string;
  fact: string;
  claimKind?: ClaimKind;
  status: 'open';
  paths?: string[];
  unit?: string;
}

export interface MemoryContentRef {
  schema: typeof MEMORY_SCHEMA;
  actorDid: string;
  harness: MemoryHarness;
  scope: MemoryScope;
  claim?: MemoryPublishInput['claim'];
}

export type { EdgeInput, EdgeRelation, KgSearchResult, NodeInput, NodeKind };
