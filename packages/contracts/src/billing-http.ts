/**
 * Shared billing HTTP request/response shapes (GAP-177).
 * OpenAPI metadata stays in the Hono route layer (`@revealui/openapi`).
 */
import { z } from 'zod/v4';

export const checkoutRequestSchema = z.object({
  priceId: z.string().min(1).optional(),
  tier: z.enum(['pro', 'max', 'enterprise']).optional(),
  interval: z.enum(['month', 'year']).optional(),
});

export const checkoutResponseSchema = z.object({
  url: z.string(),
});

export const portalResponseSchema = z.object({
  url: z.string(),
});

export const refundRequestSchema = z.object({
  paymentIntentId: z.string().min(1).optional(),
  chargeId: z.string().min(1).optional(),
  amount: z.number().int().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

export const refundResponseSchema = z.object({
  refundId: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
});

export const upgradeRequestSchema = z.object({
  priceId: z.string().min(1).optional(),
  targetTier: z.enum(['pro', 'max', 'enterprise']),
});
