import { type KgSearchResult, kgSearch } from '../search/index.js';
import type { KgExecutor } from '../types.js';
import { principalMissing, validatePrincipal } from './principal.js';
import { shouldNamespaceKeys, tenantNaturalKey } from './tenant-key.js';
import type { AdvisoryClaim, MemoryPrincipal, MemoryQuery, MemoryResult } from './types.js';

function hostedUnwired<T>(): MemoryResult<T> {
  return {
    status: 'unavailable',
    available: false,
    reason: 'scope-enforcement-unwired',
    message: 'hosted product memory reads require scope SQL (not wired in this package version)',
  };
}

function unavailable<T>(message: string): MemoryResult<T> {
  return {
    status: 'unavailable',
    available: false,
    reason: 'kg-database-unavailable',
    message,
  };
}

function namespaceInbound(principal: MemoryPrincipal, key: string): string {
  if (!shouldNamespaceKeys(principal)) return key;
  return tenantNaturalKey(principal.tenantId, key);
}

export async function queryMemory(
  exec: KgExecutor,
  input: MemoryQuery,
): Promise<MemoryResult<KgSearchResult>> {
  const missing = validatePrincipal(input.principal);
  if (missing) return principalMissing(missing);
  if (input.principal.trustBoundary === 'hosted') return hostedUnwired();

  try {
    const data = await kgSearch(exec, {
      query: input.query,
      kinds: input.kinds,
      relations: input.relations,
      limit: input.limit ?? 20,
      at: input.at,
    });
    return {
      status: 'ok',
      available: true,
      enforcement: 'deferred',
      deniedCount: 0,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'knowledge graph search failed';
    return unavailable(message);
  }
}

interface ClaimRow {
  id: string;
  fact: string;
  attributes: Record<string, unknown> | string | null;
  source_key: string;
  target_key: string;
}

function asAttributes(raw: ClaimRow['attributes']): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export async function queryClaims(
  exec: KgExecutor,
  input: Omit<MemoryQuery, 'query'> & { subjectNaturalKey?: string },
): Promise<MemoryResult<{ claims: AdvisoryClaim[] }>> {
  const missing = validatePrincipal(input.principal);
  if (missing) return principalMissing(missing);
  if (input.principal.trustBoundary === 'hosted') return hostedUnwired();

  const subject = input.subjectNaturalKey
    ? namespaceInbound(input.principal, input.subjectNaturalKey)
    : null;

  try {
    const rows = await exec.query<ClaimRow>(
      `SELECT e.id, e.fact, e.attributes, s.natural_key AS source_key, t.natural_key AS target_key
       FROM kg_edges e
       JOIN kg_nodes s ON s.id = e.source_id
       JOIN kg_nodes t ON t.id = e.target_id
       WHERE e.relation = 'discovered'
         AND e.invalid_at IS NULL
         AND e.expired_at IS NULL
         AND e.attributes->>'advisory' = 'true'
         AND e.attributes->>'status' = 'open'
         AND ($1::text IS NULL OR t.natural_key = $1)
       ORDER BY e.valid_at DESC, e.id`,
      [subject],
    );
    const claims: AdvisoryClaim[] = rows.map((row) => {
      const attrs = asAttributes(row.attributes);
      const kind = attrs.claimKind;
      return {
        edgeId: row.id,
        sourceNaturalKey: row.source_key,
        targetNaturalKey: row.target_key,
        fact: row.fact,
        claimKind: kind === 'file' || kind === 'unit' || kind === 'intent' ? kind : undefined,
        status: 'open',
        paths: Array.isArray(attrs.paths)
          ? attrs.paths.filter((p): p is string => typeof p === 'string')
          : undefined,
        unit: typeof attrs.unit === 'string' ? attrs.unit : undefined,
      };
    });
    return {
      status: 'ok',
      available: true,
      enforcement: 'deferred',
      deniedCount: 0,
      data: { claims },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'knowledge graph claims query failed';
    return unavailable(message);
  }
}
