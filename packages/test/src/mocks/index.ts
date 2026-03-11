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
} from '../utils/mocks.js';

import { createMockDatabase } from './database.js';
import { clearMockEmails, createMockEmailClient } from './email.js';
import { clearMockRequests, createMockHttpClient } from './external-apis.js';
import { clearMockFiles, createMockFileStorage } from './file-storage.js';
import { clearMockWebhooks, createMockWebhookClient } from './webhooks.js';

export * from './database.js';
export * from './email.js';
export * from './external-apis.js';
export * from './factories.js';
export * from './file-storage.js';
export * from './webhooks.js';

/**
 * Setup all mocks for testing
 */
export function setupMocks(): {
  database: ReturnType<typeof createMockDatabase>;
  fileStorage: ReturnType<typeof createMockFileStorage>;
  email: ReturnType<typeof createMockEmailClient>;
  webhooks: ReturnType<typeof createMockWebhookClient>;
  http: ReturnType<typeof createMockHttpClient>;
} {
  return {
    database: createMockDatabase(),
    fileStorage: createMockFileStorage(),
    email: createMockEmailClient(),
    webhooks: createMockWebhookClient(),
    http: createMockHttpClient(),
  };
}

/**
 * Clear all mocks
 */
export function clearAllMocks(): void {
  clearMockFiles();
  clearMockEmails();
  clearMockWebhooks();
  clearMockRequests();
}
