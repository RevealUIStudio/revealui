/**
 * Durable memory helper for session adapters.
 *
 * Not a store. Soft-optional: never throws. Default path is MCP
 * `kg_add_episode` / `kg_search`; tests inject in-process publish/query.
 * SessionStart does not call this (no queryClaims on start; no SessionEnd
 * auto-publish).
 */

import type {
  MemoryPublishData,
  MemoryPublishInput,
  MemoryQuery,
  MemoryResult,
  MemoryScope,
} from '@revealui/knowledge-graph/memory';
import type { KgSearchResult } from '@revealui/knowledge-graph/search';

export const DEFAULT_DURABLE_MEMORY_TIMEOUT_MS = 4000;

const MEMORY_SCHEMA_ID = 'revealui.memory.v1';

export type DurableMemoryCallTool = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

export interface DurableMemoryExecutor {
  publishMemory?: (input: MemoryPublishInput) => Promise<MemoryResult<MemoryPublishData>>;
  queryMemory?: (input: MemoryQuery) => Promise<MemoryResult<KgSearchResult>>;
}

export interface DurableMemoryOptions {
  /** Dispatch budget in ms. Default 4000. `0` disables the race (tests). */
  readonly timeoutMs?: number;
  /** In-process publish/query (tests). Preferred over `callTool`. */
  readonly executor?: DurableMemoryExecutor;
  /** MCP tool caller wrapping `kg_add_episode` / `kg_search`. */
  readonly callTool?: DurableMemoryCallTool;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unavailable<T>(reason: string, message: string): MemoryResult<T> {
  return { status: 'unavailable', available: false, reason, message };
}

async function raceTimeout<T>(work: Promise<T>, timeoutMs: number, onTimeout: () => T): Promise<T> {
  if (timeoutMs <= 0) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toolIsError(raw: unknown): boolean {
  const rec = asRecord(raw);
  return rec?.isError === true;
}

function extractToolPayload(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return { message: raw };
    }
  }
  const rec = asRecord(raw);
  if (!rec) return raw;
  if (typeof rec.status === 'string') return rec;

  const content = rec.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = asRecord(content[0]);
    const text = first?.text;
    if (typeof text === 'string') {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return { message: text };
      }
    }
  }

  if (typeof rec.text === 'string') {
    try {
      return JSON.parse(rec.text) as unknown;
    } catch {
      return { message: rec.text };
    }
  }
  return rec;
}

function asScope(value: unknown): MemoryScope | null {
  const rec = asRecord(value);
  if (!rec) return null;
  if (typeof rec.tenantId !== 'string') return null;
  if (rec.classification !== 'private' && rec.classification !== 'workspace') return null;
  const scope: MemoryScope = {
    tenantId: rec.tenantId,
    classification: rec.classification,
  };
  if (typeof rec.workspaceId === 'string') scope.workspaceId = rec.workspaceId;
  if (typeof rec.repo === 'string') scope.repo = rec.repo;
  return scope;
}

function coerceMemoryResult<T>(parsed: unknown, isError: boolean): MemoryResult<T> {
  const rec = asRecord(parsed);
  if (rec?.status === 'ok' && rec.available === true) {
    const enforcement = rec.enforcement === 'enforced' ? 'enforced' : 'deferred';
    const deniedCount = typeof rec.deniedCount === 'number' ? rec.deniedCount : 0;
    return {
      status: 'ok',
      available: true,
      enforcement,
      deniedCount,
      data: rec.data as T,
    };
  }
  if (rec?.status === 'denied') {
    const scope = asScope(rec.scope) ?? {
      tenantId: 'unknown',
      classification: 'workspace',
    };
    return {
      status: 'denied',
      available: true,
      reason: 'scope-denied',
      scope,
      message: typeof rec.message === 'string' ? rec.message : 'scope-denied',
      deniedCount: typeof rec.deniedCount === 'number' ? rec.deniedCount : 0,
    };
  }
  if (rec?.status === 'unavailable') {
    return unavailable(
      typeof rec.reason === 'string' ? rec.reason : 'kg-database-unavailable',
      typeof rec.message === 'string' ? rec.message : 'knowledge graph unavailable',
    );
  }
  if (isError) {
    const message =
      (rec && typeof rec.message === 'string' && rec.message) ||
      (typeof parsed === 'string' ? parsed : 'knowledge graph tool returned isError');
    return unavailable('kg-database-unavailable', message);
  }
  return {
    status: 'ok',
    available: true,
    enforcement: 'deferred',
    deniedCount: 0,
    data: parsed as T,
  };
}

function toAddEpisodeArgs(input: MemoryPublishInput): Record<string, unknown> {
  const args: Record<string, unknown> = {
    episodeType: input.episodeType ?? 'agent-fact',
    content: input.summary,
    classification: input.scope.classification,
    siteId: input.siteId,
    nodes: input.subjects,
  };
  if (input.referenceTime) args.referenceTime = input.referenceTime.toISOString();
  if (input.extraEdges && input.extraEdges.length > 0) args.edges = input.extraEdges;
  const contentRef: Record<string, unknown> = {
    schema: MEMORY_SCHEMA_ID,
    scope: input.scope,
  };
  if (input.claim) contentRef.claim = input.claim;
  args.contentRef = contentRef;
  return args;
}

function toSearchArgs(input: MemoryQuery): Record<string, unknown> {
  const args: Record<string, unknown> = { query: input.query };
  if (input.kinds) args.kinds = input.kinds;
  if (input.relations) args.relations = input.relations;
  if (input.limit !== undefined) args.limit = input.limit;
  if (input.at) args.at = input.at.toISOString();
  if (input.repo) args.repo = input.repo;
  return args;
}

async function publishInner(
  input: MemoryPublishInput,
  options: DurableMemoryOptions,
): Promise<MemoryResult<MemoryPublishData>> {
  if (options.executor?.publishMemory) {
    return options.executor.publishMemory(input);
  }
  if (options.callTool) {
    const raw = await options.callTool('kg_add_episode', toAddEpisodeArgs(input));
    return coerceMemoryResult<MemoryPublishData>(extractToolPayload(raw), toolIsError(raw));
  }
  return unavailable(
    'durable-memory-unwired',
    'no memory executor or MCP caller; proceeding without durable memory',
  );
}

async function queryInner(
  input: MemoryQuery,
  options: DurableMemoryOptions,
): Promise<MemoryResult<KgSearchResult>> {
  if (options.executor?.queryMemory) {
    return options.executor.queryMemory(input);
  }
  if (options.callTool) {
    const raw = await options.callTool('kg_search', toSearchArgs(input));
    return coerceMemoryResult<KgSearchResult>(extractToolPayload(raw), toolIsError(raw));
  }
  return unavailable(
    'durable-memory-unwired',
    'no memory executor or MCP caller; proceeding without durable memory',
  );
}

/**
 * Publish a durable finding. Never throws.
 */
export async function publishDurableFinding(
  input: MemoryPublishInput,
  options: DurableMemoryOptions = {},
): Promise<MemoryResult<MemoryPublishData>> {
  try {
    const timeoutMs = options.timeoutMs ?? DEFAULT_DURABLE_MEMORY_TIMEOUT_MS;
    return await raceTimeout(publishInner(input, options), timeoutMs, () =>
      unavailable('timeout', `durable memory publish timed out after ${timeoutMs}ms`),
    );
  } catch (err) {
    return unavailable('kg-database-unavailable', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Query durable memory via `kg_search`. Never throws.
 */
export async function queryDurableMemory(
  input: MemoryQuery,
  options: DurableMemoryOptions = {},
): Promise<MemoryResult<KgSearchResult>> {
  try {
    const timeoutMs = options.timeoutMs ?? DEFAULT_DURABLE_MEMORY_TIMEOUT_MS;
    return await raceTimeout(queryInner(input, options), timeoutMs, () =>
      unavailable('timeout', `durable memory query timed out after ${timeoutMs}ms`),
    );
  } catch (err) {
    return unavailable('kg-database-unavailable', err instanceof Error ? err.message : String(err));
  }
}

/**
 * One stderr line, same voice as `formatPeerPanel`. Empty when ok+enforced.
 */
export function formatDurableMemoryWarn(result: MemoryResult<unknown>): string {
  if (result.status === 'unavailable') {
    const reason = result.reason || 'unknown';
    return `[durable-memory] WARN: knowledge graph unavailable (${reason}). Proceeding without durable memory.\n`;
  }
  if (result.status === 'denied') {
    return `[durable-memory] deny: scope-denied (${result.scope.classification} ${result.scope.tenantId}). Proceeding without that read.\n`;
  }
  if (result.enforcement === 'deferred') {
    return '[durable-memory] note: studio-local, unscoped by design (single-operator).\n';
  }
  return '';
}
