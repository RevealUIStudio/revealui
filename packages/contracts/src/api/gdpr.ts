/**
 * GDPR API Contracts
 *
 * Validation contracts for GDPR/privacy endpoints (data export, deletion)
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';

/**
 * GDPR Data Export Request validation
 *
 * Validates data export request with userId OR email (at least one required)
 */
export const GDPRExportRequestSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
  })
  .refine((data) => data.userId || data.email, {
    message: 'Either userId or email must be provided',
    path: ['body'],
  });

export type GDPRExportRequest = z.infer<typeof GDPRExportRequestSchema>;

export const GDPRExportRequestContract = createContract({
  name: 'GDPRExportRequest',
  version: '1',
  description: 'Validates GDPR data export request',
  schema: GDPRExportRequestSchema,
});

/**
 * GDPR Data Deletion Request validation
 *
 * Validates data deletion request with:
 * - userId OR email (at least one required)
 * - confirmation must equal "DELETE" (security measure)
 */
export const GDPRDeleteRequestSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
    confirmation: z.literal('DELETE', {
      message: "Please confirm deletion by sending 'DELETE' in the confirmation field",
    }),
  })
  .refine((data) => data.userId || data.email, {
    message: 'Either userId or email must be provided',
    path: ['body'],
  });

export type GDPRDeleteRequest = z.infer<typeof GDPRDeleteRequestSchema>;

export const GDPRDeleteRequestContract = createContract({
  name: 'GDPRDeleteRequest',
  version: '1',
  description: 'Validates GDPR data deletion request with confirmation',
  schema: GDPRDeleteRequestSchema,
});
