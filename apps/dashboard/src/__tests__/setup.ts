/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import '@testing-library/jest-dom/vitest'
import * as React from 'react'
import { vi } from 'vitest'

// Set test environment
// Note: NODE_ENV is set by vitest automatically, no need to override

// Make React available globally for tests that use React.* without importing
;(globalThis as unknown as { React: typeof React }).React = React

// Polyfill for getComputedStyle to properly handle inline styles in jsdom
// This fixes toHaveStyle matcher for inline styles
const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = function getComputedStyle(element: Element) {
  const computedStyle = originalGetComputedStyle(element)
  const inlineStyle = (element as HTMLElement).style

  // Return a proxy that checks inline styles first, then computed styles
  return new Proxy(computedStyle, {
    get(target, prop) {
      if (
        typeof prop === 'string' &&
        prop in inlineStyle &&
        inlineStyle[prop as keyof CSSStyleDeclaration]
      ) {
        return inlineStyle[prop as keyof CSSStyleDeclaration]
      }
      return target[prop as keyof CSSStyleDeclaration]
    },
    has(target, prop) {
      if (typeof prop === 'string' && prop in inlineStyle) {
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

// Mock AI SDK useChat hook
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
  }),
}))
