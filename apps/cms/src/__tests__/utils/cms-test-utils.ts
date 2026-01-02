/**
 * RevealUI CMS Test Utilities
 * Helper functions for testing RevealUI CMS collections and authentication
 */

import type { RevealUIInstance } from '@revealui/cms'
import { getRevealUI } from '@revealui/cms'
import config from '../../../revealui.config'

let revealuiInstance: RevealUIInstance | null = null

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
    } catch (error) {
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
  tenantId?: number,
  tenantRoles?: string[]
): Promise<{ user: any; token: string }> {
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
      return { user: loginResult.user, token: String(loginResult.token ?? '') }
    } catch (error) {
      // If login fails, delete and recreate
      await revealui.delete({
        collection: 'users',
        id: existingUser.docs[0].id,
      })
    }
  }

  // Prepare user data
  const userData: any = {
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
  const user = await revealui.create({
    collection: 'users',
    data: userData,
  })

  // Login to get token
  const loginResult = await revealui.login({
    collection: 'users',
    data: { email, password },
  })

  return { user, token: String(loginResult.token ?? '') }
}

/**
 * Delete a test user by email
 */
export async function deleteTestUser(email: string): Promise<void> {
  const revealui = await getTestRevealUI()
  const result = await revealui.find({
    collection: 'users',
    where: {
      email: {
        equals: email,
      },
    },
  })

  if (result.docs.length > 0) {
    await revealui.delete({
      collection: 'users',
      id: result.docs[0].id,
    })
  }
}

/**
 * Clean up all test users
 */
export async function cleanupTestUsers(): Promise<void> {
  const revealui = await getTestRevealUI()
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
  payload?: any
  error?: string
} {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' }
    }

    // Decode payload (base64url)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))

    // Check required claims
    if (!payload.id || !payload.email) {
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
export async function createTestTenant(name: string, url: string): Promise<any> {
  const revealui = await getTestRevealUI()

  const tenant = await revealui.create({
    collection: 'tenants',
    data: {
      name,
      domains: url ? [{ domain: url }] : [],
      roles: ['user'],
    },
  })

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
  } catch (error) {
    // Tenant might not exist, ignore
  }
}
