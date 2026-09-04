import { type IngestOptions, ingestEpisode } from '../ingest/index.js';
import type { EdgeInput, KgExecutor, NodeInput, NodeRef } from '../types.js';
import { principalMissing, validatePrincipal } from './principal.js';
import { shouldNamespaceKeys, tenantNaturalKey } from './tenant-key.js';
import {
  MEMORY_MAX_CONTENT_CHARS,
  MEMORY_MAX_EDGES,
  MEMORY_MAX_NODES,
  MEMORY_SCHEMA,
  type MemoryContentRef,
  type MemoryPrincipal,
  type MemoryPublishData,
  type MemoryPublishInput,
  type MemoryResult,
} from './types.js';

function namespaceKey(principal: MemoryPrincipal, kind: string, key: string): string {
  if (kind === 'agent') return key;
  if (!shouldNamespaceKeys(principal)) return key;
  return tenantNaturalKey(principal.tenantId, key);
}

function namespaceRef(principal: MemoryPrincipal, ref: NodeRef): NodeRef {
  return { kind: ref.kind, naturalKey: namespaceKey(principal, ref.kind, ref.naturalKey) };
}

function namespaceNode(principal: MemoryPrincipal, node: NodeInput): NodeInput {
  return { ...node, naturalKey: namespaceKey(principal, node.kind, node.naturalKey) };
}

function namespaceEdge(principal: MemoryPrincipal, edge: EdgeInput): EdgeInput {
  return {
    ...edge,
    source: namespaceRef(principal, edge.source),
    target: namespaceRef(principal, edge.target),
  };
}

function unavailable(reason: string, message: string): MemoryResult<MemoryPublishData> {
  return { status: 'unavailable', available: false, reason, message };
}

export async function publishMemory(
  exec: KgExecutor,
  input: MemoryPublishInput,
  options: IngestOptions = {},
): Promise<MemoryResult<MemoryPublishData>> {
  const missing = validatePrincipal(input.principal);
  if (missing) return principalMissing(missing);

  const summary = input.summary.trim();
  if (!summary) return unavailable('payload-too-large', 'summary is required');
  if (summary.length > MEMORY_MAX_CONTENT_CHARS) {
    return unavailable(
      'payload-too-large',
      `summary exceeds ${MEMORY_MAX_CONTENT_CHARS} characters`,
    );
  }

  const principal = input.principal;
  const episodeType = input.episodeType ?? 'agent-fact';
  const agentNode: NodeInput = {
    kind: 'agent',
    name: principal.agentId,
    naturalKey: principal.did,
    attributes: {
      harness: principal.harness,
      agentId: principal.agentId,
      fingerprint: principal.fingerprint,
      tenantId: principal.tenantId,
      didKind: principal.didKind,
    },
  };

  const subjects = input.subjects.map((n) => namespaceNode(principal, n));
  const nodes = [agentNode, ...subjects];
  if (nodes.length > MEMORY_MAX_NODES) {
    return unavailable('payload-too-large', `node count exceeds ${MEMORY_MAX_NODES}`);
  }

  const discovered: EdgeInput[] = subjects.map((subject) => ({
    source: { kind: 'agent', naturalKey: principal.did },
    target: { kind: subject.kind, naturalKey: subject.naturalKey },
    relation: 'discovered',
    fact: input.claim
      ? `${principal.agentId} claims ${input.claim.unit ?? input.claim.paths?.join(', ') ?? subject.name}`
      : `${principal.agentId} discovered: ${summary}`,
    repo: subject.repo ?? input.scope.repo ?? null,
    attributes: {
      advisory: true,
      ...(input.claim ? { claimKind: input.claim.kind, status: input.claim.status } : {}),
    },
  }));
  const extra = (input.extraEdges ?? []).map((e) => namespaceEdge(principal, e));
  const edges = [...discovered, ...extra];
  if (edges.length > MEMORY_MAX_EDGES) {
    return unavailable('payload-too-large', `edge count exceeds ${MEMORY_MAX_EDGES}`);
  }

  const contentRef: MemoryContentRef = {
    schema: MEMORY_SCHEMA,
    actorDid: principal.did,
    harness: principal.harness,
    scope: {
      tenantId: input.scope.tenantId || principal.tenantId,
      workspaceId: input.scope.workspaceId ?? principal.workspaceId,
      repo: input.scope.repo,
      classification: input.scope.classification,
    },
    claim: input.claim,
  };

  try {
    const result = await ingestEpisode(
      exec,
      {
        episode: {
          episodeType,
          source: `agent:${principal.did}`,
          siteId: input.siteId,
          content: summary,
          contentRef: { ...contentRef },
          referenceTime: input.referenceTime ?? new Date(),
        },
        nodes,
        edges,
      },
      {
        ...options,
        recordOutbox: options.recordOutbox ?? true,
        invalidateContradictions: false,
      },
    );
    return {
      status: 'ok',
      available: true,
      enforcement:
        principal.trustBoundary === 'hosted' && !principal.isFleetOperator
          ? 'enforced'
          : 'deferred',
      deniedCount: 0,
      data: {
        episodeId: result.episodeId,
        nodeCount: result.nodeCount,
        edgeCount: result.edgeCount,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'knowledge graph write failed';
    return unavailable('kg-database-unavailable', message);
  }
}
