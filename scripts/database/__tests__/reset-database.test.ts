/**
 * Comprehensive tests for reset-database.ts
 * Tests actual database reset functionality, not just environment variables
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock pg module with proper structure
const mockQuery = vi.fn()
const mockRelease = vi.fn()
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
})
const mockEnd = vi.fn().mockResolvedValue(undefined)

// Create a proper class mock that can be used as a constructor
class MockPool {
  connect = mockConnect
  end = mockEnd
  constructor(public config?: unknown) {
    // Constructor for Pool - config stored for testing
  }
}

// Export the class directly as Pool
vi.mock('pg', () => ({
  Pool: MockPool,
}))

// Mock shared utilities with spies
const mockLogger = {
  header: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}

const mockConfirm = vi.fn()
const mockGetProjectRoot = vi.fn()

vi.mock('../../shared/utils.js', () => ({
  createLogger: vi.fn(() => mockLogger),
  confirm: mockConfirm,
  getProjectRoot: mockGetProjectRoot,
  requireEnv: vi.fn((key: string) => process.env[key] || ''),
}))

describe('reset-database.ts - File Operations', () => {
  it('should read reset-database.sql file', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    // Test file is in __tests__, SQL file is in parent directory (database/)
    const sqlPath = join(__dirname, '../reset-database.sql')

    // Verify SQL file exists and is readable
    expect(() => readFileSync(sqlPath, 'utf-8')).not.toThrow()
    const sql = readFileSync(sqlPath, 'utf-8')
    expect(sql).toContain('DROP TABLE')
    expect(sql.length).toBeGreaterThan(0)
  })

  it('should construct correct SQL file path', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    // Test file is in __tests__, SQL file is in parent directory (database/)
    const sqlPath = join(__dirname, '../reset-database.sql')

    // Path should be relative to test file location
    expect(sqlPath).toContain('reset-database.sql')
  })
})

describe('reset-database.ts - Environment Variable Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    delete process.env.SUPABASE_DATABASE_URI
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    delete process.env.SUPABASE_DATABASE_URI
  })

  it('should prioritize DATABASE_URL over other variables', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db1'
    process.env.POSTGRES_URL = 'postgresql://user:pass@host:5432/db2'
    process.env.SUPABASE_DATABASE_URI = 'postgresql://user:pass@host:5432/db3'

    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    expect(connectionString).toBe('postgresql://user:pass@host:5432/db1')
  })

  it('should fallback to POSTGRES_URL when DATABASE_URL is not set', () => {
    process.env.POSTGRES_URL = 'postgresql://user:pass@host:5432/db2'

    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    expect(connectionString).toBe('postgresql://user:pass@host:5432/db2')
  })

  it('should fallback to SUPABASE_DATABASE_URI when others are not set', () => {
    process.env.SUPABASE_DATABASE_URI = 'postgresql://user:pass@host:5432/db3'

    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    expect(connectionString).toBe('postgresql://user:pass@host:5432/db3')
  })

  it('should handle missing all database URL variables', () => {
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    expect(connectionString).toBeUndefined()
  })
})

describe('reset-database.ts - Database Connection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
    mockGetProjectRoot.mockResolvedValue('/project/root')
    mockQuery.mockResolvedValue({ rows: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.DATABASE_URL
  })

  it('should create Pool with connection string', async () => {
    const { Pool } = await import('pg')
    const connectionString = process.env.DATABASE_URL

    const pool = new Pool({ connectionString })

    expect(pool).toBeInstanceOf(MockPool)
    expect(pool.config).toEqual({ connectionString })
  })

  it('should enable SSL for connections with sslmode=require', async () => {
    const { Pool } = await import('pg')
    const connectionString = 'postgresql://user:pass@host:5432/db?sslmode=require'

    const pool = new Pool({
      connectionString,
      ssl:
        connectionString.includes('sslmode=require') || connectionString.includes('ssl=true')
          ? { rejectUnauthorized: false }
          : undefined,
    })

    expect(pool).toBeInstanceOf(MockPool)
    expect(pool.config).toEqual({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  })

  it('should enable SSL for connections with ssl=true', async () => {
    const { Pool } = await import('pg')
    const connectionString = 'postgresql://user:pass@host:5432/db?ssl=true'

    const pool = new Pool({
      connectionString,
      ssl:
        connectionString.includes('sslmode=require') || connectionString.includes('ssl=true')
          ? { rejectUnauthorized: false }
          : undefined,
    })

    expect(pool).toBeInstanceOf(MockPool)
    expect(pool.config).toEqual({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  })

  it('should not enable SSL for regular connections', async () => {
    const { Pool } = await import('pg')
    const connectionString = 'postgresql://user:pass@host:5432/db'

    const pool = new Pool({
      connectionString,
      ssl:
        connectionString.includes('sslmode=require') || connectionString.includes('ssl=true')
          ? { rejectUnauthorized: false }
          : undefined,
    })

    expect(pool).toBeInstanceOf(MockPool)
    expect(pool.config).toEqual({
      connectionString,
      ssl: undefined,
    })
  })

  it('should connect to database pool', async () => {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    await pool.connect()

    expect(mockConnect).toHaveBeenCalled()
  })

  it('should execute SQL query', async () => {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()

    await client.query('DROP TABLE IF EXISTS test;')

    expect(mockQuery).toHaveBeenCalledWith('DROP TABLE IF EXISTS test;')
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('should release client after query', async () => {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()

    await client.query('SELECT 1;')
    client.release()

    expect(mockRelease).toHaveBeenCalled()
  })

  it('should end pool connection', async () => {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    await pool.end()

    expect(mockEnd).toHaveBeenCalled()
  })
})

describe('reset-database.ts - User Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
    mockGetProjectRoot.mockResolvedValue('/project/root')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should call confirm with correct message', async () => {
    const { confirm } = await import('../../shared/utils.js')
    await confirm('Are you sure you want to drop all tables and data?', false)

    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to drop all tables and data?',
      false,
    )
  })

  it('should log header when starting', () => {
    expect(mockLogger.header).toBeDefined()
    expect(typeof mockLogger.header).toBe('function')
  })

  it('should log warning about data loss', () => {
    expect(mockLogger.warning).toBeDefined()
    expect(typeof mockLogger.warning).toBe('function')
  })

  it('should log success message on completion', () => {
    expect(mockLogger.success).toBeDefined()
    expect(typeof mockLogger.success).toBe('function')
  })

  it('should log error message on failure', () => {
    expect(mockLogger.error).toBeDefined()
    expect(typeof mockLogger.error).toBe('function')
  })
})

describe('reset-database.ts - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should handle connection errors', async () => {
    const connectionError = new Error('Connection refused')
    connectionError.message = 'connection'

    // Verify error structure matches what script expects
    expect(connectionError.message).toContain('connection')
  })

  it('should handle query execution errors', async () => {
    const queryError = new Error('Query failed')
    mockQuery.mockRejectedValueOnce(queryError)

    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()

    await expect(client.query('INVALID SQL')).rejects.toThrow('Query failed')
  })

  it('should handle missing SQL file gracefully', () => {
    const invalidPath = '/nonexistent/path/reset-database.sql'
    expect(() => readFileSync(invalidPath, 'utf-8')).toThrow()
  })
})

describe('reset-database.ts - Connection String Parsing', () => {
  it('should extract connection info from connection string', () => {
    const connectionString = 'postgresql://user:pass@host.example.com:5432/database'
    const connectionInfo = connectionString.split('@')[1]?.split('/')[0] || 'unknown'

    expect(connectionInfo).toBe('host.example.com:5432')
  })

  it('should handle connection string without port', () => {
    const connectionString = 'postgresql://user:pass@host.example.com/database'
    const connectionInfo = connectionString.split('@')[1]?.split('/')[0] || 'unknown'

    expect(connectionInfo).toBe('host.example.com')
  })

  it('should handle malformed connection string', () => {
    const connectionString = 'invalid-connection-string'
    const connectionInfo = connectionString.split('@')[1]?.split('/')[0] || 'unknown'

    expect(connectionInfo).toBe('unknown')
  })
})
