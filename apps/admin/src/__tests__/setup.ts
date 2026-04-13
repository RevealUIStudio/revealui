/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import fs from 'node:fs';
import path from 'node:path';

const originalConsoleWarn = console.warn.bind(console);

// Set test environment variables BEFORE any imports
// Use type assertion to avoid read-only property error in strict mode
(process.env as { NODE_ENV: string }).NODE_ENV = 'test';
// CRITICAL: Skip env validation during tests - must be set FIRST
process.env.SKIP_ENV_VALIDATION = 'true';
process.env.REVEALUI_SECRET = 'test-secret-key-for-testing-only-32chars';
process.env.REVEALUI_PUBLIC_SERVER_URL = 'http://localhost:4000';
// Force SQLite for tests to avoid Postgres dependency issues
process.env.DATABASE_URL = '';
// Skip onInit hook during tests (avoid database access on startup)
process.env.SKIP_ONINIT = 'true';

// Ensure test database directory exists - must match revealui.config.ts path
const testDbDir = path.resolve(__dirname, '../../../../.revealui/cache');
const testDbPath = path.resolve(testDbDir, 'revealui.db');

if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}

// Clean up test database before all tests to ensure fresh state
beforeAll(async () => {
  // Remove existing test database to ensure clean state
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Clear any cached RevealUI instance to ensure fresh initialization
  // This is imported dynamically to avoid circular dependencies
  const utils = await import('./utils/admin-test-utils.js');
  if (utils.clearTestRevealUI) {
    utils.clearTestRevealUI();
  }

  // Database tables will be created automatically by RevealUI on first connection
  // No need to manually create tables here
  // Note: Worker isolation ensures each Vitest worker gets its own database instance
}, 30000); // 30 second timeout for parallel test execution

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn((...args: unknown[]) => {
    const shouldSuppressAggregateRowWarning = args.some(
      (arg) => typeof arg === 'string' && arg.includes('Database row missing required id field'),
    );

    if (shouldSuppressAggregateRowWarning) {
      return;
    }

    originalConsoleWarn(...args);
  }),
  // Keep error for debugging tests
};

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
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn((_name: string) => ({ value: 'mock-token' })),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

/**
 * Test helpers
 */

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  roles: ['admin'],
  lastLoggedInTenant: 1,
};

export const mockSuperAdmin = {
  id: 2,
  email: 'superadmin@example.com',
  roles: ['super-admin'],
};

export const mockTenant = {
  id: 1,
  name: 'Test Tenant',
  url: 'https://test-tenant.example.com',
};
