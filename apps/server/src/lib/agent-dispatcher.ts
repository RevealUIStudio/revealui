/**
 * Shared construction of the Pro-package TicketAgentDispatcher.
 *
 * Used by both the synchronous POST handler in routes/agent-tasks.ts
 * (legacy flag-off path) and the durable queue handler in
 * jobs/agent-dispatch.ts (flag-on path). Extracted here so both
 * surfaces see the same dispatcher shape, same license gate, and
 * same DB-backed ticket mutation client.
 *
 * Returns null when the AI feature is not installed or not configured
 * — callers must treat that as a license / configuration failure.
 */

import type { Database } from '@revealui/db/client';
import * as commentQueries from '@revealui/db/queries/ticket-comments';
import * as ticketQueries from '@revealui/db/queries/tickets';

export interface DispatcherResult {
  success: boolean;
  output?: string;
  metadata?: { executionTime?: number; tokensUsed?: number };
}

export interface DispatcherTicket {
  id: string;
  title: string;
  description: unknown;
  type?: string;
  priority?: string;
}

export interface Dispatcher {
  dispatch(ticket: DispatcherTicket, options?: { dispatchId?: string }): Promise<DispatcherResult>;
}

export async function buildDispatcher(
  db: Database,
  _tenantId: string | undefined,
): Promise<Dispatcher | null> {
  const aiMod = await import('@revealui/ai').catch(() => null);
  if (!aiMod) return null;

  let llmClient: unknown;
  try {
    llmClient = aiMod.createLLMClientFromEnv();
  } catch {
    return null;
  }

  // TicketMutationClient backed by real DB queries. Honors the optional
  // `id` field on createComment so deterministic ids from the Pro
  // package (revealui#477) flow through and a crash-resume's second
  // attempt at the same comment collides on the PK constraint rather
  // than producing a duplicate row.
  const ticketClient = {
    async updateTicket(
      id: string,
      data: { status?: string; columnId?: string; metadata?: Record<string, unknown> },
    ) {
      return ticketQueries.updateTicket(db, id, data);
    },
    async createComment(id: string, body: Record<string, unknown>, options?: { id?: string }) {
      return commentQueries.createComment(db, {
        id: options?.id ?? crypto.randomUUID(),
        ticketId: id,
        body,
      });
    },
  };

  const adminBaseUrl = process.env.ADMIN_URL ?? process.env.NEXT_PUBLIC_ADMIN_URL;
  const apiClient = buildCMSClient(adminBaseUrl);

  // Type assertions: TicketAgentDispatcher comes from the Pro package via
  // dynamic import; the runtime shape matches Dispatcher.
  type DispatcherConfig = ConstructorParameters<typeof aiMod.TicketAgentDispatcher>[0];
  return new aiMod.TicketAgentDispatcher({
    llmClient: llmClient as DispatcherConfig['llmClient'],
    apiClient,
    ticketClient,
  }) as unknown as Dispatcher;
}

/**
 * AdminAPIClient over HTTP. Routes through the admin REST API if
 * ADMIN_URL / NEXT_PUBLIC_ADMIN_URL is configured; otherwise returns
 * a stub that throws, so misconfiguration surfaces on first tool use
 * rather than silently returning empty data.
 */
function buildCMSClient(baseUrl: string | undefined) {
  if (!baseUrl) {
    const stub = async () => {
      throw new Error(
        'ADMIN_URL not configured. Set ADMIN_URL to connect the agent to the admin app.',
      );
    };
    return {
      find: stub,
      findById: stub,
      create: stub,
      update: stub,
      delete: stub,
      findGlobal: stub,
      updateGlobal: stub,
    };
  }

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(process.env.CMS_API_KEY ? { Authorization: `Bearer ${process.env.CMS_API_KEY}` } : {}),
  });

  return {
    async find(options: {
      collection: string;
      page?: number;
      limit?: number;
      where?: Record<string, unknown>;
      sort?: string;
    }) {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.sort) params.set('sort', options.sort);
      const res = await fetch(`${baseUrl}/api/${options.collection}?${params}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Admin find failed: ${res.statusText}`);
      const body: unknown = await res.json();
      const data =
        body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      return {
        docs: Array.isArray(data.docs) ? (data.docs as unknown[]) : undefined,
        totalDocs: typeof data.totalDocs === 'number' ? data.totalDocs : undefined,
        page: typeof data.page === 'number' ? data.page : undefined,
        totalPages: typeof data.totalPages === 'number' ? data.totalPages : undefined,
      };
    },

    async findById(collection: string, id: string) {
      const res = await fetch(`${baseUrl}/api/${collection}/${id}`, { headers: headers() });
      if (!res.ok) throw new Error(`Admin findById failed: ${res.statusText}`);
      return res.json();
    },

    async create(options: { collection: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options.data),
      });
      if (!res.ok) throw new Error(`Admin create failed: ${res.statusText}`);
      return res.json();
    },

    async update(options: { collection: string; id: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}/${options.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(options.data),
      });
      if (!res.ok) throw new Error(`Admin update failed: ${res.statusText}`);
      return res.json();
    },

    async delete(options: { collection: string; id: string }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}/${options.id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Admin delete failed: ${res.statusText}`);
    },

    async findGlobal(options: { slug: string; depth?: number }) {
      const params = options.depth !== undefined ? `?depth=${options.depth}` : '';
      const res = await fetch(`${baseUrl}/api/globals/${options.slug}${params}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Admin findGlobal failed: ${res.statusText}`);
      return res.json();
    },

    async updateGlobal(options: { slug: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/globals/${options.slug}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options.data),
      });
      if (!res.ok) throw new Error(`Admin updateGlobal failed: ${res.statusText}`);
      return res.json();
    },
  };
}
