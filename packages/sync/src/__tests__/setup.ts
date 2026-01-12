/**
 * Vitest Setup File
 *
 * Global test setup and mocks
 */

import '@testing-library/jest-dom'

// Mock window.location if needed
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:4000',
  },
  writable: true,
})
