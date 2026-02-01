/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Set test environment
process.env.NODE_ENV = 'test'

// Mock Next.js navigation if needed
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
