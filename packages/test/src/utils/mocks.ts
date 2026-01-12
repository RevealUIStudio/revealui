/**
 * Shared mock utilities
 *
 * Provides common mocks for external services and dependencies
 */

import { vi } from 'vitest'

/**
 * Mock Stripe API responses
 */
export const mockStripe = {
  customers: {
    create: vi.fn().mockResolvedValue({
      id: 'cus_test123',
      email: 'test@example.com',
      created: Date.now(),
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'cus_test123',
      email: 'test@example.com',
    }),
  },
  checkout: {
    sessions: {
      create: vi.fn().mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
      }),
    },
  },
  webhooks: {
    constructEvent: vi.fn().mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test123',
          customer: 'cus_test123',
        },
      },
    }),
  },
}

/**
 * Create a chainable query builder mock
 */
function createQueryBuilder() {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    data: [],
    error: null,
  }
  return builder
}

/**
 * Mock Supabase client
 */
export const mockSupabase = {
  from: vi.fn().mockImplementation(() => createQueryBuilder()),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user_test123', email: 'test@example.com' } },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: { id: 'user_test123' }, session: { access_token: 'token_test123' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}

/**
 * Mock HTTP fetch
 */
export const mockFetch = (response: unknown, status = 200) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
    headers: new Headers(),
  } as Response)
}

/**
 * Reset all mocks
 */
export function resetAllMocks(): void {
  // Reset Stripe mocks
  vi.mocked(mockStripe.customers.create).mockClear()
  vi.mocked(mockStripe.customers.retrieve).mockClear()
  vi.mocked(mockStripe.checkout.sessions.create).mockClear()
  vi.mocked(mockStripe.webhooks.constructEvent).mockClear()

  // Reset Supabase mocks
  vi.mocked(mockSupabase.from).mockClear()
  vi.mocked(mockSupabase.from).mockImplementation(() => createQueryBuilder())
  vi.mocked(mockSupabase.auth.getUser).mockClear()
  vi.mocked(mockSupabase.auth.signInWithPassword).mockClear()
  vi.mocked(mockSupabase.auth.signOut).mockClear()
}
