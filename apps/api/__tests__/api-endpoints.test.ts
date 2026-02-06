import type { DatabaseClient } from '@revealui/db/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../src/index.js'

/**
 * Critical Integration Tests for apps/api
 *
 * PURPOSE: Verify all API endpoints work correctly before production launch
 *
 * CONTEXT: apps/api had ZERO tests - this is a critical gap that must be filled
 * before charging customers. These tests verify:
 * - Health endpoint functionality
 * - Todos CRUD operations
 * - Input validation (Zod schemas)
 * - Error handling (404, 400, 500)
 * - CORS configuration
 *
 * COVERAGE AREAS:
 * 1. Health endpoint (/health)
 * 2. Todos list (GET /api/todos)
 * 3. Todos create (POST /api/todos)
 * 4. Todos read single (GET /api/todos/:id)
 * 5. Todos update (PATCH /api/todos/:id)
 * 6. Todos delete (DELETE /api/todos/:id)
 * 7. Validation errors (400)
 * 8. Not found errors (404)
 * 9. CORS headers
 */

// Mock database for testing
// We mock the database to avoid needing actual DB connections in unit tests
const mockTodos = [
  { id: '1', text: 'Test todo 1', completed: false, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', text: 'Test todo 2', completed: true, createdAt: new Date(), updatedAt: new Date() },
]

const mockDb = {
  query: {
    todos: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as DatabaseClient

// Mock the database queries module
vi.mock('@revealui/db/queries/todos', () => ({
  getAllTodos: vi.fn(async () => mockTodos),
  getTodoById: vi.fn(async (_db: unknown, id: string) => {
    return mockTodos.find((t) => t.id === id) || null
  }),
  createTodo: vi.fn(async (_db: unknown, text: string) => ({
    id: '3',
    text,
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateTodo: vi.fn(
    async (_db: unknown, id: string, data: { text?: string; completed?: boolean }) => {
      const todo = mockTodos.find((t) => t.id === id)
      if (!todo) return null
      return { ...todo, ...data, updatedAt: new Date() }
    },
  ),
  deleteTodo: vi.fn(async () => undefined),
}))

// Mock the database client to avoid actual connections
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}))

// Mock environment to avoid CORS errors in tests
beforeAll(() => {
  process.env.NODE_ENV = 'development'
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('API Endpoints Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /health - Health Check Endpoint', () => {
    it('returns 200 with health status', async () => {
      const res = await app.request('/health')

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        service: 'RevealUI API',
      })
      expect(json).toHaveProperty('timestamp')
      expect(new Date(json.timestamp)).toBeInstanceOf(Date)
    })

    it('returns correct content-type header', async () => {
      const res = await app.request('/health')

      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('GET /api/todos - List All Todos', () => {
    it('returns 200 with todos array', async () => {
      const res = await app.request('/api/todos')

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(2)
      expect(json.data[0]).toMatchObject({
        id: '1',
        text: 'Test todo 1',
        completed: false,
      })
      expect(json.data[0]).toHaveProperty('createdAt')
      expect(json.data[0]).toHaveProperty('updatedAt')
    })

    it('returns empty array when no todos exist', async () => {
      const { getAllTodos } = await import('@revealui/db/queries/todos')
      vi.mocked(getAllTodos).mockResolvedValueOnce([])

      const res = await app.request('/api/todos')

      const json = await res.json()
      expect(json.data).toEqual([])
    })
  })

  describe('GET /api/todos/:id - Get Single Todo', () => {
    it('returns 200 with todo when found', async () => {
      const res = await app.request('/api/todos/1')

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toMatchObject({
        id: '1',
        text: 'Test todo 1',
        completed: false,
      })
      expect(json.data).toHaveProperty('createdAt')
      expect(json.data).toHaveProperty('updatedAt')
    })

    it('returns 404 when todo not found', async () => {
      const res = await app.request('/api/todos/999')

      expect(res.status).toBe(404)

      const json = await res.json()
      expect(json).toMatchObject({
        success: false,
        error: 'Todo not found',
      })
    })
  })

  describe('POST /api/todos - Create New Todo', () => {
    it('creates todo with valid data and returns 201', async () => {
      const res = await app.request('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'New todo' }),
      })

      expect(res.status).toBe(201)

      const json = await res.json()
      expect(json).toMatchObject({
        success: true,
        data: {
          id: '3',
          text: 'New todo',
          completed: false,
        },
      })
    })

    it('rejects empty text with 400', async () => {
      const res = await app.request('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: '' }),
      })

      expect(res.status).toBe(400)

      const json = await res.json()
      expect(json).toHaveProperty('error')
    })

    it('rejects text longer than 500 characters with 400', async () => {
      const longText = 'a'.repeat(501)
      const res = await app.request('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: longText }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects missing text field with 400', async () => {
      const res = await app.request('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('rejects invalid JSON with 400', async () => {
      const res = await app.request('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /api/todos/:id - Update Todo', () => {
    it('updates todo text successfully', async () => {
      const res = await app.request('/api/todos/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Updated text' }),
      })

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json).toMatchObject({
        success: true,
        data: {
          id: '1',
          text: 'Updated text',
        },
      })
    })

    it('updates todo completed status successfully', async () => {
      const res = await app.request('/api/todos/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: true }),
      })

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.data.completed).toBe(true)
    })

    it('updates both text and completed status', async () => {
      const res = await app.request('/api/todos/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Updated', completed: true }),
      })

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.data).toMatchObject({
        text: 'Updated',
        completed: true,
      })
    })

    it('returns 404 when todo not found', async () => {
      const res = await app.request('/api/todos/999', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: 'Updated' }),
      })

      expect(res.status).toBe(404)

      const json = await res.json()
      expect(json).toMatchObject({
        success: false,
        error: 'Todo not found',
      })
    })

    it('rejects invalid text length with 400', async () => {
      const longText = 'a'.repeat(501)
      const res = await app.request('/api/todos/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: longText }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects invalid completed value with 400', async () => {
      const res = await app.request('/api/todos/1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: 'not-a-boolean' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/todos/:id - Delete Todo', () => {
    it('deletes todo successfully and returns 200', async () => {
      const res = await app.request('/api/todos/1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json).toMatchObject({
        success: true,
        message: 'Todo deleted',
      })
    })

    it('returns 404 when todo not found', async () => {
      const res = await app.request('/api/todos/999', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)

      const json = await res.json()
      expect(json).toMatchObject({
        success: false,
        error: 'Todo not found',
      })
    })
  })

  describe('CORS Configuration', () => {
    it('includes CORS headers for allowed origins in development', async () => {
      const res = await app.request('/health', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      // In development, CORS should allow localhost origins
      const corsHeader = res.headers.get('access-control-allow-origin')
      expect(corsHeader).toBeTruthy()
    })

    it('includes credentials header when configured', async () => {
      const res = await app.request('/health', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      })

      const credentialsHeader = res.headers.get('access-control-allow-credentials')
      expect(credentialsHeader).toBeTruthy()
    })
  })

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      const { getAllTodos } = await import('@revealui/db/queries/todos')
      vi.mocked(getAllTodos).mockRejectedValueOnce(new Error('Database connection failed'))

      const res = await app.request('/api/todos')

      expect(res.status).toBe(500)

      const json = await res.json()
      expect(json).toHaveProperty('error')
      // Verify we don't leak internal error details (Critical Fix #5)
      expect(json.error).not.toContain('Database connection failed')
      expect(json.error).toBe('An error occurred while processing your request')
    })

    it('returns 404 for unknown routes', async () => {
      const res = await app.request('/api/unknown')

      expect(res.status).toBe(404)
    })
  })
})
