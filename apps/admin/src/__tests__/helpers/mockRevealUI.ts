import type { RevealRequest, RevealUIInstance } from '@revealui/core';
import { vi } from 'vitest';

/**
 * Creates a mock RevealUIInstance for testing.
 * Provides all required properties with vitest mock functions.
 */
export function createMockRevealUI(): Partial<RevealUIInstance> {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    find: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    collections: {},
    globals: {},
    config: {} as unknown as RevealUIInstance['config'],
  } as unknown as RevealUIInstance;
}

/**
 * Creates a mock RevealRequest for testing.
 */
export function createMockRequest(): RevealRequest {
  return {
    revealui: createMockRevealUI(),
    user: null,
    payload: createMockRevealUI(),
    context: {},
    locale: 'en',
    fallbackLocale: 'en',
  } as unknown as RevealRequest;
}

/**
 * Creates a mock logger for testing.
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}
