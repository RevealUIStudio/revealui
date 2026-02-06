import { randomUUID } from 'node:crypto'

export interface TestSession {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  persistent: boolean
  lastActivityAt: Date
  ipAddress?: string
  userAgent?: string
}

export function createTestSession(overrides?: Partial<TestSession>): TestSession {
  const testId = randomUUID()
  return {
    id: overrides?.id || `session_${testId}`,
    userId: overrides?.userId || `user_${testId}`,
    tokenHash: overrides?.tokenHash || `hash_${testId}`,
    expiresAt: overrides?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    persistent: overrides?.persistent ?? false,
    lastActivityAt: overrides?.lastActivityAt || new Date(),
    ...overrides,
  }
}

export function createExpiredSession(overrides?: Partial<TestSession>): TestSession {
  return createTestSession({
    expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    ...overrides,
  })
}
