/**
 * User Fixtures
 *
 * Pre-defined user test data and factory functions
 */

/**
 * User fixture type
 */
export interface UserFixture {
  email: string
  name: string
  role: 'admin' | 'user' | 'guest'
  password?: string
  emailVerified?: Date
  image?: string
}

/**
 * Pre-defined user fixtures for common test scenarios
 */
export const userFixtures = {
  admin: {
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin' as const,
    password: 'admin123',
    emailVerified: new Date('2024-01-01'),
  },

  user: {
    email: 'user@test.com',
    name: 'Regular User',
    role: 'user' as const,
    password: 'user123',
    emailVerified: new Date('2024-01-01'),
  },

  guest: {
    email: 'guest@test.com',
    name: 'Guest User',
    role: 'guest' as const,
    password: 'guest123',
    emailVerified: null,
  },

  unverified: {
    email: 'unverified@test.com',
    name: 'Unverified User',
    role: 'user' as const,
    password: 'unverified123',
    emailVerified: null,
  },

  premium: {
    email: 'premium@test.com',
    name: 'Premium User',
    role: 'user' as const,
    password: 'premium123',
    emailVerified: new Date('2024-01-01'),
    image: 'https://example.com/premium.jpg',
  },
} as const

/**
 * User factory - creates a user with default values + overrides
 */
let userCounter = 0

export function createUserFixture(overrides: Partial<UserFixture> = {}): UserFixture {
  userCounter++

  return {
    email: `user${userCounter}@test.com`,
    name: `Test User ${userCounter}`,
    role: 'user',
    password: 'password123',
    emailVerified: new Date(),
    ...overrides,
  }
}

/**
 * Create multiple users
 */
export function createUsersFixture(count: number, overrides: Partial<UserFixture> = {}): UserFixture[] {
  return Array.from({ length: count }, () => createUserFixture(overrides))
}

/**
 * Reset the user counter (for test isolation)
 */
export function resetUserCounter(): void {
  userCounter = 0
}
