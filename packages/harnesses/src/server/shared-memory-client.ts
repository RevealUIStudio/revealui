/**
 * Shared Memory Client
 *
 * Thin HTTP client for the RevealUI admin API's shared memory routes.
 * Used by the daemon's RPC server to bridge CLI agent requests to the
 * NeonDB-backed shared memory layer.
 *
 * All routes require session authentication via cookie.
 */

export interface SharedMemoryClientConfig {
  /** Admin app base URL (e.g., http://localhost:4000) */
  baseUrl: string;
  /** Session cookie value for authentication */
  sessionCookie: string;
}

export interface SharedFact {
  id: string;
  sessionId: string;
  agentId: string;
  content: string;
  factType: string;
  confidence: number;
  tags: string[];
  sourceRef?: Record<string, unknown>;
  createdAt: string;
}

export interface SharedMemory {
  id: string;
  agentId: string;
  siteId: string;
  content: string;
  type: string;
  source: Record<string, unknown>;
  metadata: Record<string, unknown>;
  scope: string;
  sessionScope: string;
  sourceFacts: string[];
  createdAt: string;
}

export interface YjsPatch {
  id: number;
  documentId: string;
  agentId: string;
  patchType: string;
  path: string;
  content: string;
  applied: boolean;
  createdAt: string;
}

export interface ReconcileResult {
  reconciled: number;
  duplicatesFound: number;
  contradictions: number;
  memories: unknown[];
}

export class SharedMemoryClient {
  private readonly baseUrl: string;
  private readonly cookie: string;

  constructor(config: SharedMemoryClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.cookie = `revealui-session=${config.sessionCookie}`;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url, {
      headers: { Cookie: this.cookie },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return (await res.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.cookie,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }

    return (await res.json()) as T;
  }

  /** Publish a shared fact to the coordination session. */
  async publishFact(params: {
    sessionId: string;
    agentId: string;
    content: string;
    factType: string;
    confidence?: number;
    tags?: string[];
    sourceRef?: Record<string, unknown>;
  }): Promise<SharedFact> {
    return this.post('/api/sync/shared-facts', {
      session_id: params.sessionId,
      agent_id: params.agentId,
      content: params.content,
      fact_type: params.factType,
      confidence: params.confidence,
      tags: params.tags,
      source_ref: params.sourceRef,
    });
  }

  /** Store a shared memory across agents. */
  async storeMemory(params: {
    agentId: string;
    siteId: string;
    sessionScope: string;
    content: string;
    type: string;
    source: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFacts?: string[];
  }): Promise<SharedMemory> {
    return this.post('/api/sync/shared-memories', {
      agent_id: params.agentId,
      site_id: params.siteId,
      session_scope: params.sessionScope,
      content: params.content,
      type: params.type,
      source: params.source,
      metadata: params.metadata,
      source_facts: params.sourceFacts,
    });
  }

  /** Submit a structured patch to a Yjs scratchpad document. */
  async patchScratchpad(params: {
    documentId: string;
    agentId: string;
    patchType: string;
    path: string;
    content: string;
  }): Promise<YjsPatch> {
    return this.post('/api/sync/yjs-document-patches', {
      document_id: params.documentId,
      agent_id: params.agentId,
      patch_type: params.patchType,
      path: params.path,
      content: params.content,
    });
  }

  /** List shared facts for a coordination session. */
  async listFacts(params: {
    sessionId: string;
    activeOnly?: boolean;
    limit?: number;
  }): Promise<SharedFact[]> {
    const query: Record<string, string> = { session_id: params.sessionId };
    if (params.activeOnly === false) query.active = 'false';
    if (params.limit) query.limit = String(params.limit);
    return this.get('/api/sync/shared-facts', query);
  }

  /** List shared memories for a coordination session scope. */
  async listMemories(params: { sessionScope: string; limit?: number }): Promise<SharedMemory[]> {
    const query: Record<string, string> = { session_scope: params.sessionScope };
    if (params.limit) query.limit = String(params.limit);
    return this.get('/api/sync/shared-memories', query);
  }

  /** Trigger reconciliation for a coordination session. */
  async reconcile(params: { sessionId: string; siteId: string }): Promise<ReconcileResult> {
    return this.post('/api/sync/reconcile', {
      session_id: params.sessionId,
      site_id: params.siteId,
    });
  }
}
