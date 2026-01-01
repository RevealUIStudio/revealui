/**
 * PayloadCMS Test Utilities
 * Helper functions for testing PayloadCMS collections and authentication
 */

import type { Payload } from "@revealui/cms"
import { getPayload } from "@revealui/cms"
import config from "../../../payload.config"

let payloadInstance: Payload | null = null

/**
 * Get or create PayloadCMS instance for testing
 */
export async function getTestPayload(): Promise<Payload> {
  if (!payloadInstance) {
    payloadInstance = await getPayload({ config })
  }
  return payloadInstance
}

/**
 * Create a test user with specified roles
 */
export async function createTestUser(
  email: string,
  password: string,
  roles: string[] = ["user-admin"],
  tenantId?: number,
  tenantRoles?: string[]
): Promise<{ user: any; token: string }> {
  const payload = await getTestPayload()

  // Check if user already exists
  const existingUser = await payload.find({
    collection: "users",
    where: {
      email: {
        equals: email,
      },
    },
  })

  if (existingUser.docs.length > 0) {
    // User exists, try to login
    try {
      const loginResult = await payload.login({
        collection: "users",
        data: { email, password },
      })
      return { user: loginResult.user, token: loginResult.token || "" }
    } catch (error) {
      // If login fails, delete and recreate
      await payload.delete({
        collection: "users",
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
  const user = await payload.create({
    collection: "users",
    data: userData,
  })

  // Login to get token
  const loginResult = await payload.login({
    collection: "users",
    data: { email, password },
  })

  return { user, token: loginResult.token || "" }
}

/**
 * Delete a test user by email
 */
export async function deleteTestUser(email: string): Promise<void> {
  const payload = await getTestPayload()
  const result = await payload.find({
    collection: "users",
    where: {
      email: {
        equals: email,
      },
    },
  })

  if (result.docs.length > 0) {
    await payload.delete({
      collection: "users",
      id: result.docs[0].id,
    })
  }
}

/**
 * Clean up all test users
 */
export async function cleanupTestUsers(): Promise<void> {
  const payload = await getTestPayload()
  const testEmails = [
    "test@example.com",
    "test-admin@example.com",
    "test-superadmin@example.com",
    "test-tenant-admin@example.com",
    "test-user@example.com",
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
    const parts = token.split(".")
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid JWT format" }
    }

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    )

    // Check required claims
    if (!payload.id || !payload.email) {
      return { valid: false, error: "Missing required claims" }
    }

    return { valid: true, payload }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Create a test tenant
 */
export async function createTestTenant(
  name: string,
  url: string
): Promise<any> {
  const payload = await getTestPayload()

  const tenant = await payload.create({
    collection: "tenants",
    data: {
      name,
      domains: url ? [{ domain: url }] : [],
      roles: ["user"],
    },
  })

  return tenant
}

/**
 * Delete a test tenant
 */
export async function deleteTestTenant(id: string | number): Promise<void> {
  const payload = await getTestPayload()
  try {
    await payload.delete({
      collection: "tenants",
      id,
    })
  } catch (error) {
    // Tenant might not exist, ignore
  }
}

