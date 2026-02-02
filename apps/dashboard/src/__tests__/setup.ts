/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Set test environment
process.env.NODE_ENV = 'test'

// Polyfill for getComputedStyle to properly handle inline styles in jsdom
// This fixes toHaveStyle matcher for inline styles
const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = function getComputedStyle(element: Element) {
  const computedStyle = originalGetComputedStyle(element)
  const inlineStyle = (element as HTMLElement).style

  // Return a proxy that checks inline styles first, then computed styles
  return new Proxy(computedStyle, {
    get(target, prop) {
      if (typeof prop === 'string' && inlineStyle[prop as any]) {
        return inlineStyle[prop as any]
      }
      return target[prop as any]
    },
    has(target, prop) {
      if (typeof prop === 'string' && inlineStyle[prop as any]) {
        return true
      }
      return prop in target
    },
  })
}

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
