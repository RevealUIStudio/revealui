/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import { vi, beforeAll, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

// Set test environment variables BEFORE any imports
Object.assign(process.env, {
  NODE_ENV: 'test',
  REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
  REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
  // Force SQLite for tests to avoid Postgres dependency issues
  DATABASE_URL: '',
  // Skip onInit hook during tests (avoid database access on startup)
  SKIP_ONINIT: 'true',
})

// Ensure test database directory exists - must match revealui.config.ts path
const testDbDir = path.resolve(__dirname, '../../../.revealui/cache')
const testDbPath = path.resolve(testDbDir, 'revealui.db')

if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true })
}

// Create basic tables for tests
beforeAll(() => {
  const db = new Database(testDbPath)
  db.pragma('journal_mode = WAL')
  
  // Create users table (minimal schema for tests)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      roles TEXT,
      tenants TEXT,
      lastLoggedInTenant TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Create tenants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domains TEXT,
      roles TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Create pages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT,
      slug TEXT,
      tenant TEXT,
      layout TEXT,
      hero TEXT,
      publishedAt DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Create posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT,
      slug TEXT,
      content TEXT,
      publishedAt DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // Create media table
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      filename TEXT,
      mimeType TEXT,
      filesize INTEGER,
      url TEXT,
      alt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  db.close()
})

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  // Keep warn and error for debugging tests
}

/**
 * Global test utilities and mocks
 */

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn((name: string) => ({ value: 'mock-token' })),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
}))

/**
 * Test helpers
 */

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  roles: ['user-admin'],
  lastLoggedInTenant: 1,
}

export const mockSuperAdmin = {
  id: 2,
  email: 'superadmin@example.com',
  roles: ['user-super-admin'],
}

export const mockTenant = {
  id: 1,
  name: 'Test Tenant',
  url: 'https://test-tenant.example.com',
}
