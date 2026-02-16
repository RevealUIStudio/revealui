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

interface Board {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string | null
  tenantId: string | null
  isDefault: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

interface BoardColumn {
  id: string
  boardId: string
  name: string
  slug: string
  position: number
  wipLimit: number | null
  color: string | null
  isDefault: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

interface Ticket {
  id: string
  boardId: string
  columnId: string | null
  parentTicketId: string | null
  ticketNumber: number
  title: string
  description: unknown
  status: string
  priority: string
  type: string
  assigneeId: string | null
  reporterId: string | null
  dueDate: Date | string | null
  estimatedEffort: number | null
  sortOrder: number
  commentCount: number
  attachments: unknown
  metadata: unknown
  closedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

interface TicketComment {
  id: string
  ticketId: string
  authorId: string | null
  body: unknown
  createdAt: Date | string
  updatedAt: Date | string
}

interface TicketLabel {
  id: string
  name: string
  slug: string
  color: string | null
  description: string | null
  tenantId: string | null
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

    const data = (await response.json()) as ApiResponse<T>

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
 * Board API methods
 */
export const boardsApi = {
  async getAll(): Promise<ApiResponse<Board[]>> {
    return apiFetch<Board[]>('/api/tickets/boards')
  },

  async getById(id: string): Promise<ApiResponse<Board>> {
    return apiFetch<Board>(`/api/tickets/boards/${id}`)
  },

  async create(data: {
    name: string
    slug: string
    description?: string
  }): Promise<ApiResponse<Board>> {
    return apiFetch<Board>('/api/tickets/boards', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(
    id: string,
    data: Partial<{ name: string; slug: string; description: string }>,
  ): Promise<ApiResponse<Board>> {
    return apiFetch<Board>(`/api/tickets/boards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>(`/api/tickets/boards/${id}`, {
      method: 'DELETE',
    })
  },

  async getColumns(boardId: string): Promise<ApiResponse<BoardColumn[]>> {
    return apiFetch<BoardColumn[]>(`/api/tickets/boards/${boardId}/columns`)
  },

  async createColumn(
    boardId: string,
    data: { name: string; slug: string; position: number; wipLimit?: number; color?: string },
  ): Promise<ApiResponse<BoardColumn>> {
    return apiFetch<BoardColumn>(`/api/tickets/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

/**
 * Ticket API methods
 */
export const ticketsApi = {
  async getByBoard(
    boardId: string,
    filters?: {
      status?: string
      priority?: string
      type?: string
      assigneeId?: string
      columnId?: string
    },
  ): Promise<ApiResponse<Ticket[]>> {
    const params = new URLSearchParams()
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value)
      }
    }
    const query = params.toString()
    return apiFetch<Ticket[]>(`/api/tickets/boards/${boardId}/tickets${query ? `?${query}` : ''}`)
  },

  async getById(id: string): Promise<ApiResponse<Ticket>> {
    return apiFetch<Ticket>(`/api/tickets/tickets/${id}`)
  },

  async create(
    boardId: string,
    data: {
      title: string
      description?: unknown
      columnId?: string
      status?: string
      priority?: string
      type?: string
      assigneeId?: string
      reporterId?: string
      dueDate?: string
      estimatedEffort?: number
    },
  ): Promise<ApiResponse<Ticket>> {
    return apiFetch<Ticket>(`/api/tickets/boards/${boardId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(
    id: string,
    data: Partial<{
      title: string
      description: unknown
      status: string
      priority: string
      type: string
      assigneeId: string | null
      reporterId: string | null
      columnId: string | null
      dueDate: string | null
      estimatedEffort: number | null
      sortOrder: number
    }>,
  ): Promise<ApiResponse<Ticket>> {
    return apiFetch<Ticket>(`/api/tickets/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>(`/api/tickets/tickets/${id}`, {
      method: 'DELETE',
    })
  },

  async move(id: string, columnId: string, sortOrder: number): Promise<ApiResponse<Ticket>> {
    return apiFetch<Ticket>(`/api/tickets/tickets/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ columnId, sortOrder }),
    })
  },

  async getSubtasks(id: string): Promise<ApiResponse<Ticket[]>> {
    return apiFetch<Ticket[]>(`/api/tickets/tickets/${id}/subtasks`)
  },

  async getComments(ticketId: string): Promise<ApiResponse<TicketComment[]>> {
    return apiFetch<TicketComment[]>(`/api/tickets/tickets/${ticketId}/comments`)
  },

  async addComment(
    ticketId: string,
    body: unknown,
    authorId?: string,
  ): Promise<ApiResponse<TicketComment>> {
    return apiFetch<TicketComment>(`/api/tickets/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, authorId }),
    })
  },

  async getLabels(ticketId: string): Promise<ApiResponse<TicketLabel[]>> {
    return apiFetch<TicketLabel[]>(`/api/tickets/tickets/${ticketId}/labels`)
  },

  async assignLabel(
    ticketId: string,
    labelId: string,
  ): Promise<ApiResponse<{ id: string; ticketId: string; labelId: string }>> {
    return apiFetch<{ id: string; ticketId: string; labelId: string }>(
      `/api/tickets/tickets/${ticketId}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labelId }),
      },
    )
  },

  async removeLabel(ticketId: string, labelId: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>(`/api/tickets/tickets/${ticketId}/labels/${labelId}`, {
      method: 'DELETE',
    })
  },
}

/**
 * Label API methods
 */
export const labelsApi = {
  async getAll(): Promise<ApiResponse<TicketLabel[]>> {
    return apiFetch<TicketLabel[]>('/api/tickets/labels')
  },

  async create(data: {
    name: string
    slug: string
    color?: string
    description?: string
  }): Promise<ApiResponse<TicketLabel>> {
    return apiFetch<TicketLabel>('/api/tickets/labels', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(
    id: string,
    data: Partial<{ name: string; slug: string; color: string; description: string }>,
  ): Promise<ApiResponse<TicketLabel>> {
    return apiFetch<TicketLabel>(`/api/tickets/labels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>(`/api/tickets/labels/${id}`, {
      method: 'DELETE',
    })
  },
}

/**
 * Code Provenance types
 */
interface CodeProvenanceEntry {
  id: string
  schemaVersion: string
  filePath: string
  functionName: string | null
  lineStart: number | null
  lineEnd: number | null
  authorType: string
  aiModel: string | null
  aiSessionId: string | null
  gitCommitHash: string | null
  gitAuthor: string | null
  confidence: number
  reviewStatus: string
  reviewedBy: string | null
  reviewedAt: Date | string | null
  linesOfCode: number
  metadata: unknown
  createdAt: Date | string
  updatedAt: Date | string
}

interface CodeReviewEntry {
  id: string
  provenanceId: string
  reviewerId: string | null
  reviewType: string
  status: string
  comment: string | null
  metadata: unknown
  createdAt: Date | string
}

interface ProvenanceStats {
  byAuthorType: Array<{ authorType: string; count: number; totalLines: number }>
  byReviewStatus: Array<{ reviewStatus: string; count: number }>
}

/**
 * Code Provenance API methods
 */
export const provenanceApi = {
  async getAll(filters?: {
    authorType?: string
    reviewStatus?: string
    filePathPrefix?: string
  }): Promise<ApiResponse<CodeProvenanceEntry[]>> {
    const params = new URLSearchParams()
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value)
      }
    }
    const query = params.toString()
    return apiFetch<CodeProvenanceEntry[]>(`/api/provenance${query ? `?${query}` : ''}`)
  },

  async getById(id: string): Promise<ApiResponse<CodeProvenanceEntry>> {
    return apiFetch<CodeProvenanceEntry>(`/api/provenance/${id}`)
  },

  async getByFile(filePath: string): Promise<ApiResponse<CodeProvenanceEntry[]>> {
    return apiFetch<CodeProvenanceEntry[]>(`/api/provenance/file/${encodeURIComponent(filePath)}`)
  },

  async getStats(): Promise<ApiResponse<ProvenanceStats>> {
    return apiFetch<ProvenanceStats>('/api/provenance/stats')
  },

  async create(data: {
    filePath: string
    authorType: string
    functionName?: string
    lineStart?: number
    lineEnd?: number
    aiModel?: string
    aiSessionId?: string
    gitCommitHash?: string
    gitAuthor?: string
    confidence?: number
    linesOfCode?: number
    metadata?: unknown
  }): Promise<ApiResponse<CodeProvenanceEntry>> {
    return apiFetch<CodeProvenanceEntry>('/api/provenance', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(
    id: string,
    data: Partial<{
      filePath: string
      functionName: string | null
      authorType: string
      aiModel: string | null
      confidence: number
      reviewStatus: string
      linesOfCode: number
      metadata: unknown
    }>,
  ): Promise<ApiResponse<CodeProvenanceEntry>> {
    return apiFetch<CodeProvenanceEntry>(`/api/provenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>(`/api/provenance/${id}`, {
      method: 'DELETE',
    })
  },

  async addReview(
    provenanceId: string,
    data: {
      reviewType: string
      status: string
      reviewerId?: string
      comment?: string
      metadata?: unknown
    },
  ): Promise<ApiResponse<CodeReviewEntry>> {
    return apiFetch<CodeReviewEntry>(`/api/provenance/${provenanceId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getReviews(provenanceId: string): Promise<ApiResponse<CodeReviewEntry[]>> {
    return apiFetch<CodeReviewEntry[]>(`/api/provenance/${provenanceId}/reviews`)
  },
}

/**
 * Export API client
 */
export const api = {
  boards: boardsApi,
  tickets: ticketsApi,
  labels: labelsApi,
  provenance: provenanceApi,
}

export type {
  ApiResponse,
  Board,
  BoardColumn,
  CodeProvenanceEntry,
  CodeReviewEntry,
  ProvenanceStats,
  Ticket,
  TicketComment,
  TicketLabel,
}
