/**
 * Mock utilities index
 *
 * Exports all mock utilities and provides setup helpers
 */

// Re-export Stripe and Supabase mocks from utils
export {
  mockFetch,
  mockStripe,
  mockSupabase,
  resetAllMocks,
} from '../utils/mocks'
export * from './database'
export * from './email'
export * from './external-apis'
export * from './factories'
export * from './file-storage'
export * from './webhooks'

/**
 * Setup all mocks for testing
 */
export function setupMocks(): {
  database: ReturnType<typeof import('./database').createMockDatabase>
  fileStorage: ReturnType<typeof import('./file-storage').createMockFileStorage>
  email: ReturnType<typeof import('./email').createMockEmailClient>
  webhooks: ReturnType<typeof import('./webhooks').createMockWebhookClient>
  http: ReturnType<typeof import('./external-apis').createMockHttpClient>
} {
  const { createMockDatabase } = require('./database')
  const { createMockFileStorage } = require('./file-storage')
  const { createMockEmailClient } = require('./email')
  const { createMockWebhookClient } = require('./webhooks')
  const { createMockHttpClient } = require('./external-apis')

  return {
    database: createMockDatabase(),
    fileStorage: createMockFileStorage(),
    email: createMockEmailClient(),
    webhooks: createMockWebhookClient(),
    http: createMockHttpClient(),
  }
}

/**
 * Clear all mocks
 */
export function clearAllMocks(): void {
  const { clearMockFiles } = require('./file-storage')
  const { clearMockEmails } = require('./email')
  const { clearMockWebhooks } = require('./webhooks')
  const { clearMockRequests } = require('./external-apis')

  clearMockFiles()
  clearMockEmails()
  clearMockWebhooks()
  clearMockRequests()
}
