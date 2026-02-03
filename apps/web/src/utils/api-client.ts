/**
 * API Client for apps/web
 *
 * Type-safe wrapper for calling apps/api endpoints
 */

const API_BASE_URL =
  typeof window === 'undefined'
    ? process.env.API_URL || 'http://localhost:3004'
    : process.env.VITE_API_URL || 'http://localhost:3004'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error ${response.status}`,
      }
    }

    return data
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Todo API methods
 */
export const todosApi = {
  /**
   * Get all todos
   */
  async getAll(): Promise<ApiResponse<Todo[]>> {
    return apiFetch<Todo[]>('/api/todos')
  },

  /**
   * Get a single todo by ID
   */
  async getById(id: string): Promise<ApiResponse<Todo>> {
    return apiFetch<Todo>(`/api/todos/${id}`)
  },

  /**
   * Create a new todo
   */
  async create(text: string): Promise<ApiResponse<Todo>> {
    return apiFetch<Todo>('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  },

  /**
   * Update a todo
   */
  async update(
    id: string,
    data: { text?: string; completed?: boolean },
  ): Promise<ApiResponse<Todo>> {
    return apiFetch<Todo>(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /**
   * Delete a todo
   */
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>(`/api/todos/${id}`, {
      method: 'DELETE',
    })
  },
}

/**
 * Export API client
 */
export const api = {
  todos: todosApi,
}

export type { ApiResponse, Todo }
