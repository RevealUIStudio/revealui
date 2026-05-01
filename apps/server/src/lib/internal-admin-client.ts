/**
 * Internal admin API Client
 *
 * Implements the AdminAPIClient interface from @revealui/ai by calling
 * the API's own content routes internally. Used by agent-stream to give
 * agents admin tool access without an external HTTP round-trip.
 */

/** Matches AdminAPIClient from @revealui/ai/tools/admin */
export interface InternalCMSClient {
  find(options: {
    collection: string;
    page?: number;
    limit?: number;
    where?: Record<string, unknown>;
    sort?: string;
  }): Promise<{
    docs?: unknown[];
    totalDocs?: number;
    page?: number;
    totalPages?: number;
  }>;

  findById(collection: string, id: string): Promise<unknown>;

  create(options: { collection: string; data: Record<string, unknown> }): Promise<unknown>;

  update(options: {
    collection: string;
    id: string;
    data: Record<string, unknown>;
  }): Promise<unknown>;

  delete(options: { collection: string; id: string }): Promise<void>;

  findGlobal(options: { slug: string; depth?: number }): Promise<unknown>;

  updateGlobal(options: { slug: string; data: Record<string, unknown> }): Promise<unknown>;
}

/**
 * Create an internal admin client that calls the API's own content routes.
 *
 * @param baseUrl  -  The API's own origin (e.g., 'http://localhost:3004' or derived from request)
 * @param sessionCookie  -  The user's session cookie for auth passthrough
 */
export function createInternalAdminClient(
  baseUrl: string,
  sessionCookie: string,
): InternalCMSClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: `revealui-session=${sessionCookie}`,
  };

  async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`admin API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    async find(options) {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.where) params.set('where', JSON.stringify(options.where));
      if (options.sort) params.set('sort', options.sort);
      const qs = params.toString();
      return fetchJson(`/api/content/${options.collection}${qs ? `?${qs}` : ''}`);
    },

    async findById(collection, id) {
      return fetchJson(`/api/content/${collection}/${id}`);
    },

    async create(options) {
      return fetchJson(`/api/content/${options.collection}`, {
        method: 'POST',
        body: JSON.stringify(options.data),
      });
    },

    async update(options) {
      return fetchJson(`/api/content/${options.collection}/${options.id}`, {
        method: 'PATCH',
        body: JSON.stringify(options.data),
      });
    },

    async delete(options) {
      await fetchJson(`/api/content/${options.collection}/${options.id}`, {
        method: 'DELETE',
      });
    },

    async findGlobal(options) {
      const params = options.depth ? `?depth=${options.depth}` : '';
      return fetchJson(`/api/content/globals/${options.slug}${params}`);
    },

    async updateGlobal(options) {
      return fetchJson(`/api/content/globals/${options.slug}`, {
        method: 'PATCH',
        body: JSON.stringify(options.data),
      });
    },
  };
}
