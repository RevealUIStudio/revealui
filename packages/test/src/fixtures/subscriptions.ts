import { randomUUID } from 'node:crypto'

export interface TestSubscription {
  id: string
  userId: string
  stripeSubscriptionId: string
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  planId: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export function createTestSubscription(overrides?: Partial<TestSubscription>): TestSubscription {
  const testId = randomUUID()
  return {
    id: overrides?.id || `sub_${testId}`,
    userId: overrides?.userId || `user_${testId}`,
    stripeSubscriptionId: overrides?.stripeSubscriptionId || `sub_stripe_${testId}`,
    status: overrides?.status || 'active',
    planId: overrides?.planId || 'pro_monthly',
    currentPeriodStart: overrides?.currentPeriodStart || new Date(),
    currentPeriodEnd:
      overrides?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: overrides?.cancelAtPeriodEnd ?? false,
    ...overrides,
  }
}
