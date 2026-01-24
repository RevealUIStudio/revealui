/**
 * Webhook mocks
 *
 * Provides mocks for webhook delivery, signature generation, and retry logic
 */

import crypto from 'node:crypto'

export interface MockWebhook {
  id: string
  url: string
  payload: unknown
  headers: Record<string, string>
  sentAt: Date
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
}

const mockWebhooks: MockWebhook[] = []

/**
 * Generate webhook signature
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

/**
 * Mock webhook delivery
 */
export function mockWebhookDelivery(options: {
  url: string
  payload: unknown
  secret?: string
}): Promise<MockWebhook> {
  const payloadString = JSON.stringify(options.payload)
  const signature = options.secret ? generateWebhookSignature(payloadString, options.secret) : ''

  const webhook: MockWebhook = {
    id: `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    url: options.url,
    payload: options.payload,
    headers: {
      'Content-Type': 'application/json',
      ...(signature && { 'X-Webhook-Signature': signature }),
    },
    sentAt: new Date(),
    status: 'delivered',
    attempts: 1,
  }

  mockWebhooks.push(webhook)
  return Promise.resolve(webhook)
}

/**
 * Mock webhook retry logic
 */
export function mockWebhookRetry(
  webhookId: string,
  maxAttempts = 3,
): Promise<MockWebhook | null> {
  const webhook = mockWebhooks.find((w) => w.id === webhookId)
  if (!webhook) {
    return Promise.resolve(null)
  }

  if (webhook.attempts < maxAttempts && webhook.status === 'failed') {
    webhook.attempts++
    webhook.status = 'delivered'
    webhook.sentAt = new Date()
  }

  return Promise.resolve(webhook)
}

/**
 * Get mock webhooks
 */
export function getMockWebhooks(): MockWebhook[] {
  return [...mockWebhooks]
}

/**
 * Clear all mock webhooks
 */
export function clearMockWebhooks(): void {
  mockWebhooks.length = 0
}

/**
 * Create mock webhook client
 */
export function createMockWebhookClient() {
  return {
    deliver: mockWebhookDelivery,
    retry: mockWebhookRetry,
    generateSignature: generateWebhookSignature,
    verifySignature: verifyWebhookSignature,
    getWebhooks: getMockWebhooks,
    clear: clearMockWebhooks,
  }
}
