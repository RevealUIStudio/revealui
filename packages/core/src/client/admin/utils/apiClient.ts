/**
 * API Client for RevealUI Admin Dashboard
 * Handles all API communication with authentication and error handling
 */

import type { RevealDocument } from '../../../types/index.js';

export interface APIResponse<T = RevealDocument> {
  docs?: T[];
  doc?: T;
  totalDocs?: number;
  limit?: number;
  totalPages?: number;
  page?: number;
  pagingCounter?: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  prevPage?: number | null;
  nextPage?: number | null;
  message?: string;
  errors?: Array<{ message: string; field?: string }>;
}

export enum APIErrorType {
  Network = 'network',
  Authentication = 'authentication',
  Authorization = 'authorization',
  Validation = 'validation',
  NotFound = 'not_found',
  Server = 'server',
}

export class APIError extends Error {
  constructor(
    public type: APIErrorType,
    message: string,
    public status?: number,
    public field?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export interface FindOptions {
  collection: string;
  page?: number;
  limit?: number;
  where?: Record<string, unknown>;
  sort?: string;
  depth?: number;
}

export interface CreateOptions {
  collection: string;
  data: Record<string, unknown>;
}

export interface UpdateOptions {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

export interface DeleteOptions {
  collection: string;
  id: string;
}

export interface FindGlobalOptions {
  slug: string;
  depth?: number;
}

export interface UpdateGlobalOptions {
  slug: string;
  data: Record<string, unknown>;
}

export interface APIClientOptions {
  baseURL?: string;
}

type APIErrorPayload = {
  message?: unknown;
  errors?: Array<{ message?: unknown; field?: unknown }>;
};

const parseErrorPayload = async (response: Response): Promise<APIErrorPayload> => {
  const data = (await response.json().catch(() => null)) as unknown;
  if (!data || typeof data !== 'object') {
    return {};
  }
  return data as APIErrorPayload;
};

const getErrorMessage = (payload: APIErrorPayload, fallback: string): string => {
  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message;
  }
  const firstError = Array.isArray(payload.errors) ? payload.errors[0] : undefined;
  if (firstError && typeof firstError.message === 'string' && firstError.message.length > 0) {
    return firstError.message;
  }
  return fallback;
};

const getErrorField = (payload: APIErrorPayload): string | undefined => {
  const firstError = Array.isArray(payload.errors) ? payload.errors[0] : undefined;
  return typeof firstError?.field === 'string' ? firstError.field : undefined;
};

/**
 * API Client class for making authenticated requests to RevealUI admin API
 */
export class APIClient {
  private baseURL: string;

  constructor(options: APIClientOptions = {}) {
    // Get base URL from environment or use default
    this.baseURL =
      options.baseURL ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SERVER_URL ||
          process.env.REVEALUI_PUBLIC_SERVER_URL ||
          'http://localhost:4000');
  }

  /**
   * Make an authenticated API request
   */
  private async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for authentication
      });

      // Handle authentication errors
      if (response.status === 401) {
        throw new APIError(
          APIErrorType.Authentication,
          'Authentication required. Please log in.',
          401,
        );
      }

      // Handle authorization errors
      if (response.status === 403) {
        throw new APIError(
          APIErrorType.Authorization,
          'You do not have permission to perform this action.',
          403,
        );
      }

      // Handle not found errors
      if (response.status === 404) {
        throw new APIError(APIErrorType.NotFound, 'Resource not found.', 404);
      }

      // Handle validation errors
      if (response.status === 400) {
        const errorData = await parseErrorPayload(response);
        const errorMessage = getErrorMessage(errorData, 'Validation error');
        throw new APIError(APIErrorType.Validation, errorMessage, 400, getErrorField(errorData));
      }

      // Handle server errors
      if (response.status >= 500) {
        throw new APIError(
          APIErrorType.Server,
          'Server error. Please try again later.',
          response.status,
        );
      }

      // Parse response
      if (!response.ok) {
        const errorData = await parseErrorPayload(response);
        throw new APIError(
          APIErrorType.Server,
          getErrorMessage(errorData, `Request failed with status ${response.status}`),
          response.status,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new APIError(APIErrorType.Network, 'Network error. Please check your connection.', 0);
      }

      // Re-throw API errors
      if (error instanceof APIError) {
        throw error;
      }

      // Handle unknown errors
      throw new APIError(
        APIErrorType.Server,
        error instanceof Error ? error.message : 'Unknown error occurred',
        0,
      );
    }
  }

  /**
   * Find documents in a collection
   */
  async find(options: FindOptions): Promise<APIResponse> {
    const { collection, page = 1, limit = 10, where, sort, depth } = options;

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (where) {
      params.set('where', JSON.stringify(where));
    }
    if (sort) {
      params.set('sort', sort);
    }
    if (depth !== undefined) {
      params.set('depth', String(depth));
    }

    const endpoint = `/api/collections/${collection}?${params.toString()}`;

    return this.request<APIResponse>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Find a single document by ID
   */
  async findById(collection: string, id: string): Promise<RevealDocument> {
    const endpoint = `/api/collections/${collection}/${id}`;

    const response = await this.request<{ doc: RevealDocument }>(endpoint, {
      method: 'GET',
    });

    return response.doc;
  }

  /**
   * Create a new document
   */
  async create(options: CreateOptions): Promise<RevealDocument> {
    const { collection, data } = options;
    const endpoint = `/api/collections/${collection}`;

    const response = await this.request<{ doc: RevealDocument }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return response.doc;
  }

  /**
   * Update an existing document
   */
  async update(options: UpdateOptions): Promise<RevealDocument> {
    const { collection, id, data } = options;
    const endpoint = `/api/collections/${collection}/${id}`;

    const response = await this.request<{ doc: RevealDocument }>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    return response.doc;
  }

  /**
   * Delete a document
   */
  async delete(options: DeleteOptions): Promise<void> {
    const { collection, id } = options;
    const endpoint = `/api/collections/${collection}/${id}`;

    await this.request(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Find a global by slug
   */
  async findGlobal(options: FindGlobalOptions): Promise<RevealDocument> {
    const { slug, depth = 0 } = options;
    const endpoint = `/api/globals/${slug}?depth=${depth}`;

    const response = await this.request<APIResponse>(endpoint, {
      method: 'GET',
    });

    if (!response.doc) {
      throw new APIError(APIErrorType.NotFound, `Global '${slug}' not found`, 404);
    }

    return response.doc;
  }

  /**
   * Update a global
   */
  async updateGlobal(options: UpdateGlobalOptions): Promise<RevealDocument> {
    const { slug, data } = options;
    const endpoint = `/api/globals/${slug}`;

    const response = await this.request<APIResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.doc) {
      throw new APIError(APIErrorType.Server, 'Failed to update global');
    }

    return response.doc;
  }
}

// Export singleton instance
export const apiClient = new APIClient();
