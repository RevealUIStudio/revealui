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
import { createMockDatabase } from './database'
import { clearMockEmails, createMockEmailClient } from './email'
import { clearMockRequests, createMockHttpClient } from './external-apis'
import { clearMockFiles, createMockFileStorage } from './file-storage'
import { clearMockWebhooks, createMockWebhookClient } from './webhooks'
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
  database: ReturnType<typeof createMockDatabase>
  fileStorage: ReturnType<typeof createMockFileStorage>
  email: ReturnType<typeof createMockEmailClient>
  webhooks: ReturnType<typeof createMockWebhookClient>
  http: ReturnType<typeof createMockHttpClient>
} {
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
  clearMockFiles()
  clearMockEmails()
  clearMockWebhooks()
  clearMockRequests()
}
