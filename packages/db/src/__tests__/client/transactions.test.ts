/**
 * Transaction Handling Tests
 *
 * Tests for the withTransaction helper in packages/db/src/client/index.ts.
 * Since the Neon HTTP driver does not support transactions, these tests verify:
 * - Error when using Neon HTTP driver
 * - Successful delegation to Drizzle's transaction API for pg-based clients
 * - Rollback behavior on error
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

const mockTransaction = vi.fn()
const mockPoolEnd = vi.fn().mockResolvedValue(undefined)

vi.mock('pg', () => {
  class MockPool {
    totalCount = 5
    idleCount = 3
    waitingCount = 0
    end = mockPoolEnd
  }
  return { Pool: MockPool }
})

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}))

vi.mock('@revealui/config', () => ({
  default: {
    database: { url: undefined },
  },
}))

vi.mock('@revealui/utils/database', () => ({
  getSSLConfig: vi.fn(() => false),
}))

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    // Neon HTTP client does NOT have a transaction method
  })),
}))

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    query: {},
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: mockTransaction,
  })),
}))

// ============================================================================
// Import once to avoid dynamic import timeouts
// ============================================================================

import { createClient, resetClient, withTransaction } from '../../client/index.js'

// ============================================================================
// Tests
// ============================================================================

describe('withTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetClient()
  })

  afterEach(() => {
    resetClient()
  })

  it('throws when used with a Neon HTTP client (no transaction support)', async () => {
    const neonDb = createClient({
      connectionString: 'postgresql://user:pass@ep-cool.neon.tech/mydb',
    })

    await expect(
      withTransaction(neonDb, async () => {
        return 'result'
      }),
    ).rejects.toThrow('Transaction not supported')
  })

  it('delegates to Drizzle transaction API for pg-based clients', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn(), update: vi.fn() })
    })

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    })

    const result = await withTransaction(pgDb, async (_tx) => {
      return 'committed'
    })

    expect(result).toBe('committed')
    expect(mockTransaction).toHaveBeenCalledOnce()
  })

  it('propagates errors from the transaction callback', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn() })
    })

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    })

    await expect(
      withTransaction(pgDb, async () => {
        throw new Error('constraint violation')
      }),
    ).rejects.toThrow('constraint violation')
  })

  it('passes the transaction context to the callback', async () => {
    const txContext = { insert: vi.fn(), update: vi.fn(), select: vi.fn() }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txContext)
    })

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    })

    await withTransaction(pgDb, async (tx) => {
      expect(tx).toBeDefined()
      return 'ok'
    })
  })

  it('returns the value from a successful transaction', async () => {
    const expectedResult = { id: 'user-123', email: 'test@example.com' }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn() })
    })

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    })

    const result = await withTransaction(pgDb, async () => {
      return expectedResult
    })

    expect(result).toEqual(expectedResult)
  })

  it('Drizzle handles rollback when transaction throws', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return await fn({ insert: vi.fn() })
    })

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    })

    await expect(
      withTransaction(pgDb, async () => {
        throw new Error('rollback me')
      }),
    ).rejects.toThrow('rollback me')
  })

  it('handles async operations inside the transaction', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn(), update: vi.fn() })
    })

    const pgDb = createClient({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
    })

    const result = await withTransaction(pgDb, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { success: true }
    })

    expect(result).toEqual({ success: true })
  })

  it('error message explains Neon HTTP limitation', async () => {
    const neonDb = createClient({
      connectionString: 'postgresql://user:pass@ep-cool.neon.tech/mydb',
    })

    try {
      await withTransaction(neonDb, async () => 'x')
      expect.fail('Should have thrown')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain('Neon HTTP driver')
      expect(message).toContain('stateless')
    }
  })
})
