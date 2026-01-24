/**
 * API Client for RevealUI Admin Dashboard
 * Handles all API communication with authentication and error handling
 */

import type { RevealDocument } from '../../../types/index.js'
import { getAuthHeader } from './auth.js'

export interface APIResponse<T = RevealDocument> {
  docs?: T[]
  doc?: T
  totalDocs?: number
  limit?: number
  totalPages?: number
  page?: number
  pagingCounter?: number
  hasPrevPage?: boolean
  hasNextPage?: boolean
  prevPage?: number | null
  nextPage?: number | null
  message?: string
  errors?: Array<{ message: string; field?: string }>
}

export enum APIErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
}

export class APIError extends Error {
  constructor(
    public type: APIErrorType,
    message: string,
    public status?: number,
    public field?: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export interface FindOptions {
  collection: string
  page?: number
  limit?: number
  where?: Record<string, any>
  sort?: string
  depth?: number
}

export interface CreateOptions {
  collection: string
  data: Record<string, any>
}

export interface UpdateOptions {
  collection: string
  id: string
  data: Record<string, any>
}

export interface DeleteOptions {
  collection: string
  id: string
}

export interface APIClientOptions {
  baseURL?: string
}

/**
 * API Client class for making authenticated requests to RevealUI CMS API
 */
export class APIClient {
  private baseURL: string

  constructor(options: APIClientOptions = {}) {
    // Get base URL from environment or use default
    this.baseURL =
      options.baseURL ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SERVER_URL ||
          process.env.REVEALUI_PUBLIC_SERVER_URL ||
          'http://localhost:4000')
  }

  /**
   * Make an authenticated API request
   */
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const authHeader = getAuthHeader()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(authHeader && { Authorization: authHeader }),
      ...options.headers,
    }

    const url = `${this.baseURL}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for authentication
      })

      // Handle authentication errors
      if (response.status === 401) {
        throw new APIError(
          APIErrorType.AUTHENTICATION,
          'Authentication required. Please log in.',
          401,
        )
      }

      // Handle authorization errors
      if (response.status === 403) {
        throw new APIError(
          APIErrorType.AUTHORIZATION,
          'You do not have permission to perform this action.',
          403,
        )
      }

      // Handle not found errors
      if (response.status === 404) {
        throw new APIError(APIErrorType.NOT_FOUND, 'Resource not found.', 404)
      }

      // Handle validation errors
      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          errorData.message || errorData.errors?.[0]?.message || 'Validation error'
        throw new APIError(APIErrorType.VALIDATION, errorMessage, 400, errorData.errors?.[0]?.field)
      }

      // Handle server errors
      if (response.status >= 500) {
        throw new APIError(
          APIErrorType.SERVER,
          'Server error. Please try again later.',
          response.status,
        )
      }

      // Parse response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new APIError(
          APIErrorType.SERVER,
          errorData.message || `Request failed with status ${response.status}`,
          response.status,
        )
      }

      return await response.json()
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new APIError(APIErrorType.NETWORK, 'Network error. Please check your connection.', 0)
      }

      // Re-throw API errors
      if (error instanceof APIError) {
        throw error
      }

      // Handle unknown errors
      throw new APIError(
        APIErrorType.SERVER,
        error instanceof Error ? error.message : 'Unknown error occurred',
        0,
      )
    }
  }

  /**
   * Find documents in a collection
   */
  async find(options: FindOptions): Promise<APIResponse> {
    const { collection, page = 1, limit = 10, where, sort, depth } = options

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    if (where) {
      params.set('where', JSON.stringify(where))
    }
    if (sort) {
      params.set('sort', sort)
    }
    if (depth !== undefined) {
      params.set('depth', String(depth))
    }

    const endpoint = `/api/collections/${collection}?${params.toString()}`

    return this.request<APIResponse>(endpoint, {
      method: 'GET',
    })
  }

  /**
   * Find a single document by ID
   */
  async findById(collection: string, id: string): Promise<RevealDocument> {
    const endpoint = `/api/collections/${collection}/${id}`

    const response = await this.request<{ doc: RevealDocument }>(endpoint, {
      method: 'GET',
    })

    return response.doc!
  }

  /**
   * Create a new document
   */
  async create(options: CreateOptions): Promise<RevealDocument> {
    const { collection, data } = options
    const endpoint = `/api/collections/${collection}`

    const response = await this.request<{ doc: RevealDocument }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })

    return response.doc!
  }

  /**
   * Update an existing document
   */
  async update(options: UpdateOptions): Promise<RevealDocument> {
    const { collection, id, data } = options
    const endpoint = `/api/collections/${collection}/${id}`

    const response = await this.request<{ doc: RevealDocument }>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })

    return response.doc!
  }

  /**
   * Delete a document
   */
  async delete(options: DeleteOptions): Promise<void> {
    const { collection, id } = options
    const endpoint = `/api/collections/${collection}/${id}`

    await this.request(endpoint, {
      method: 'DELETE',
    })
  }
}

// Export singleton instance
export const apiClient = new APIClient()
