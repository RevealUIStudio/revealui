/**
 * Stripe API Input Validation Schemas
 *
 * These schemas validate data before sending to Stripe API
 * Prevents injection attacks and malformed data errors
 */

import { z } from 'zod/v4';

/**
 * Schema for Stripe Customer Update
 */
export const CustomerUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  address: z
    .object({
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      postal_code: z.string().max(20).optional(),
      country: z.string().length(2).optional(), // ISO country code
    })
    .optional(),
});

/**
 * Schema for Stripe Customer Create
 */
export const CustomerCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  address: z
    .object({
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      postal_code: z.string().max(20).optional(),
      country: z.string().length(2).optional(),
    })
    .optional(),
});

/**
 * Type exports for use in API routes
 */
export type CustomerUpdateInput = z.infer<typeof CustomerUpdateSchema>;
export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;
