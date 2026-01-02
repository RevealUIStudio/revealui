/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import { vi, beforeAll } from 'vitest'
import path from 'path'
import fs from 'fs'

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

// Ensure test database directory exists
const testDbDir = path.resolve(__dirname, '../../../.revealui/cache')
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true })
}

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
