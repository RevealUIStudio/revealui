/**
 * Integration Test Setup
 *
 * Utilities for setting up and tearing down test database connections
 * and creating test fixtures for authentication system tests.
 */

import { getClient } from '@revealui/db/client'
import { sessions, users } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'
import type { Session, User } from '../../src/types'

/**
 * Test database configuration
 */
export interface TestDatabaseConfig {
  connectionString: string
}

/**
 * Gets the test database connection string from environment variables
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.TEST_DATABASE_URL

  if (!url) {
    throw new Error(
      'Test database URL not found. Set DATABASE_URL, POSTGRES_URL, or TEST_DATABASE_URL environment variable.',
    )
  }

  return url
}

/**
 * Creates a test database client
 */
export async function createTestDatabaseClient() {
  // getClient() uses the connection string from environment
  // For tests, we need to ensure DATABASE_URL is set
  const url = getTestDatabaseUrl()
  process.env.DATABASE_URL = url
  return getClient()
}

/**
 * Cleans up test data from database
 */
export async function cleanupTestData(userIds: string[]): Promise<void> {
  const db = getClient()

  // Delete sessions for test users
  if (userIds.length > 0) {
    await db.delete(sessions).where(eq(sessions.userId, userIds[0]))
    // Delete remaining users if any
    for (const userId of userIds.slice(1)) {
      await db.delete(sessions).where(eq(sessions.userId, userId))
    }
  }

  // Delete test users
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId))
  }
}

/**
 * Creates a test user in the database
 */
export async function createTestUser(overrides?: Partial<User>): Promise<User> {
  const db = getClient()

  const testUser: User = {
    id: overrides?.id || crypto.randomUUID(),
    schemaVersion: '1',
    type: 'human',
    name: overrides?.name || 'Test User',
    email: overrides?.email || `test-${Date.now()}@example.com`,
    avatarUrl: null,
    passwordHash: overrides?.passwordHash || null,
    role: overrides?.role || 'viewer',
    status: overrides?.status || 'active',
    agentModel: null,
    agentCapabilities: null,
    agentConfig: null,
    preferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: null,
    ...overrides,
  }

  await db.insert(users).values(testUser)

  return testUser
}

/**
 * Creates a test session in the database
 */
export async function createTestSession(
  userId: string,
  overrides?: Partial<Session>,
): Promise<Session> {
  const db = getClient()

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 1) // 1 day from now

  const testSession: Session = {
    id: overrides?.id || crypto.randomUUID(),
    userId,
    tokenHash: overrides?.tokenHash || 'test-token-hash',
    expiresAt: overrides?.expiresAt || expiresAt,
    userAgent: overrides?.userAgent || 'test-agent',
    ipAddress: overrides?.ipAddress || '127.0.0.1',
    persistent: overrides?.persistent,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  }

  await db.insert(sessions).values(testSession)

  return testSession
}

/**
 * Gets a user by email from the database
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getClient()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return (user as User) || null
}

/**
 * Gets a session by token hash from the database
 */
export async function getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const db = getClient()
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1)
  return (session as Session) || null
}

/**
 * Test fixture helper - creates a user with password hash
 */
export async function createTestUserWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<User> {
  const bcrypt = await import('bcryptjs')
  const passwordHash = await bcrypt.default.hash(password, 12)

  return createTestUser({
    email,
    name: name || 'Test User',
    passwordHash,
  })
}

/**
 * Test fixture helper - creates a user and session
 */
export async function createTestUserWithSession(
  userOverrides?: Partial<User>,
  sessionOverrides?: Partial<Session>,
): Promise<{ user: User; session: Session }> {
  const user = await createTestUser(userOverrides)
  const session = await createTestSession(user.id, sessionOverrides)
  return { user, session }
}
