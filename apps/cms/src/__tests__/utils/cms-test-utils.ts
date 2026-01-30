/**
 * RevealUI CMS Test Utilities
 * Helper functions for testing RevealUI CMS collections and authentication
 */

import { randomUUID } from 'node:crypto'
import config from '@revealui/config'
import type { RevealUIInstance } from '@revealui/core'
import { getRevealUI } from '@revealui/core'

let revealuiInstance: RevealUIInstance | null = null

type TestTenantAssignment = {
  tenant: number | string
  roles: string[]
}

type TestUser = {
  id: string | number
  email: string
  roles?: string[]
  tenants?: TestTenantAssignment[]
} & Record<string, unknown>

type TestUserInput = {
  email: string
  password: string
  roles: string[]
  tenants?: TestTenantAssignment[]
}

type TestTenant = { id: string | number } & Record<string, unknown>

/**
 * Clear the cached RevealUI instance (useful for test cleanup)
 */
export function clearTestRevealUI(): void {
  revealuiInstance = null
}

/**
 * Get or create RevealUI CMS instance for testing
 * Ensures database is initialized and tables are created
 */
export async function getTestRevealUI(): Promise<RevealUIInstance> {
  if (!revealuiInstance) {
    revealuiInstance = await getRevealUI({ config })
    // Trigger database initialization by making a lightweight query
    // This ensures tables are created before any test queries
    try {
      await revealuiInstance.find({
        collection: 'users',
        limit: 0,
        depth: 0,
      })
    } catch (_error) {
      // Ignore errors - tables will be created on first real query
      // This is just to trigger initialization
    }
  }
  return revealuiInstance
}

/**
 * Create a test user with specified roles
 */
export async function createTestUser(
  email: string,
  password: string,
  roles: string[] = ['user-admin'],
  tenantId?: number | string,
  tenantRoles?: string[],
): Promise<{ user: TestUser; token: string }> {
  const revealui = await getTestRevealUI()

  // Check if user already exists
  const existingUser = await revealui.find({
    collection: 'users',
    where: {
      email: {
        equals: email,
      },
    },
  })

  if (existingUser.docs.length > 0) {
    // User exists, try to login
    try {
      const loginResult = await revealui.login({
        collection: 'users',
        data: { email, password },
      })
      return { user: loginResult.user as TestUser, token: String(loginResult.token ?? '') }
    } catch (_error) {
      // If login fails, delete and recreate
      if (existingUser.docs[0]) {
        await revealui.delete({
          collection: 'users',
          id: existingUser.docs[0].id,
        })
      }
    }
  }

  // Prepare user data
  const userData: TestUserInput = {
    email,
    password,
    roles,
  }

  // Add tenant if provided
  if (tenantId && tenantRoles) {
    userData.tenants = [
      {
        tenant: tenantId,
        roles: tenantRoles,
      },
    ]
  }

  // Create new user
  const user = (await revealui.create({
    collection: 'users',
    data: userData,
  })) as TestUser

  // Login to get token
  const loginResult = await revealui.login({
    collection: 'users',
    data: { email, password },
  })

  return { user, token: String(loginResult.token ?? '') }
}

/**
 * Delete a test user by email
 *
 * Handles errors gracefully to prevent UNIQUE constraint failures in parallel tests.
 * Returns success status instead of throwing.
 *
 * IMPROVED: Uses sequential deletion to prevent race conditions.
 * For even better isolation, consider using database transactions in test setup.
 * See: packages/test/src/integration/database/transactions.integration.test.ts
 */
export async function deleteTestUser(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const revealui = await getTestRevealUI()

    // Use find with specific email to avoid race conditions
    const result = await revealui.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1, // Only need one result
    })

    if (result.docs.length > 0 && result.docs[0]) {
      // Delete the user - this operation is atomic
      await revealui.delete({
        collection: 'users',
        id: result.docs[0].id,
      })
      return { success: true }
    }

    // User doesn't exist - this is fine, not an error
    // This is expected when:
    // 1. User was already deleted by another test (parallel execution)
    // 2. User never existed (cleanup before creation)
    // 3. User was deleted in a previous test run
    return { success: true }
  } catch (error) {
    // Handle errors gracefully - user might already be deleted by another test
    const errorMessage = error instanceof Error ? error.message : String(error)

    // If it's a "not found" error, that's fine - user already deleted
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist') ||
      errorMessage.includes('No document found')
    ) {
      return { success: true }
    }

    // For UNIQUE constraint errors, the user might have been created/deleted
    // by another test running in parallel - this is expected in parallel test execution
    if (
      errorMessage.includes('UNIQUE constraint') ||
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('duplicate key')
    ) {
      // This is a race condition - user was created by another test
      // Return success since our goal is just to ensure user doesn't exist
      return { success: true }
    }

    // For other errors, log but don't throw (prevents test failures from cleanup)
    // These are unexpected but shouldn't break tests
    return { success: false, error: errorMessage }
  }
}

/**
 * Generate a unique test email address
 * Uses UUID to ensure uniqueness even in parallel test execution
 *
 * @param prefix - Optional prefix for the email (default: 'test')
 * @returns A unique email address in the format: {prefix}-{uuid}@example.com
 *
 * @example
 * ```typescript
 * const email = generateUniqueTestEmail('user')
 * // Returns: 'user-550e8400-e29b-41d4-a716-446655440000@example.com'
 * ```
 */
export function generateUniqueTestEmail(prefix = 'test'): string {
  const uuid = randomUUID()
  return `${prefix}-${uuid}@example.com`
}

/**
 * Clean up all test users
 * Note: This function cleans up hardcoded test emails.
 * For tests using generateUniqueTestEmail(), ensure cleanup is handled via trackTestData()
 * or explicit deletion in test teardown.
 */
export async function cleanupTestUsers(): Promise<void> {
  const _revealui = await getTestRevealUI()
  const testEmails = [
    'test@example.com',
    'test-admin@example.com',
    'test-superadmin@example.com',
    'test-tenant-admin@example.com',
    'test-user@example.com',
  ]

  for (const email of testEmails) {
    await deleteTestUser(email)
  }
}

/**
 * Verify JWT token structure
 */
export function verifyJWTStructure(token: string): {
  valid: boolean
  payload?: Record<string, unknown>
  error?: string
} {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' }
    }

    // Decode payload (base64url)
    const payloadPart = parts[1]
    if (!payloadPart) {
      return { valid: false, error: 'Missing JWT payload' }
    }
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf-8')) as Record<
      string,
      unknown
    >

    // Check required claims
    if (!(payload.id && payload.email)) {
      return { valid: false, error: 'Missing required claims' }
    }

    return { valid: true, payload }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create a test tenant
 */
export async function createTestTenant(name: string, url: string): Promise<TestTenant> {
  const revealui = await getTestRevealUI()

  const tenant = (await revealui.create({
    collection: 'tenants',
    data: {
      name,
      domains: url ? [{ domain: url }] : [],
      roles: ['user'],
    },
  })) as TestTenant

  return tenant
}

/**
 * Delete a test tenant
 */
export async function deleteTestTenant(id: string | number): Promise<void> {
  const revealui = await getTestRevealUI()
  try {
    await revealui.delete({
      collection: 'tenants',
      id,
    })
  } catch (_error) {
    // Tenant might not exist, ignore
  }
}
