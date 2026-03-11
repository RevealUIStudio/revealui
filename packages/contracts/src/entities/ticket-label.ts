/**
 * Ticket Label Entity Contract
 *
 * Labels for categorizing tickets. Labels can be assigned to multiple tickets
 * and tickets can have multiple labels (many-to-many via ticket_label_assignments).
 *
 * Business Rules:
 * - Label slug must be unique per tenant
 * - Color is optional (hex string e.g. "#ff0000")
 * - Labels are tenant-scoped when tenantId is set
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const TICKET_LABEL_SCHEMA_VERSION = 1;

export const LABEL_LIMITS = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MIN_SLUG_LENGTH: 1,
  MAX_SLUG_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_COLOR_LENGTH: 20,
} as const;

// =============================================================================
// Schema
// =============================================================================

export const TicketLabelObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(TICKET_LABEL_SCHEMA_VERSION)),
  name: z.string().min(LABEL_LIMITS.MIN_NAME_LENGTH).max(LABEL_LIMITS.MAX_NAME_LENGTH),
  slug: z
    .string()
    .min(LABEL_LIMITS.MIN_SLUG_LENGTH)
    .max(LABEL_LIMITS.MAX_SLUG_LENGTH)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  color: z.string().max(LABEL_LIMITS.MAX_COLOR_LENGTH).nullable().optional(),
  description: z.string().max(LABEL_LIMITS.MAX_DESCRIPTION_LENGTH).nullable().optional(),
  tenantId: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TicketLabelSchema = TicketLabelObjectSchema;
export type TicketLabel = z.infer<typeof TicketLabelSchema>;

export const TicketLabelInsertSchema = TicketLabelObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type TicketLabelInsert = z.infer<typeof TicketLabelInsertSchema>;

// =============================================================================
// Helpers
// =============================================================================

export function createLabelInsert(
  name: string,
  slug: string,
  options?: { id?: string; color?: string; description?: string; tenantId?: string },
): TicketLabelInsert {
  const now = new Date();
  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(TICKET_LABEL_SCHEMA_VERSION),
    name,
    slug,
    color: options?.color ?? null,
    description: options?.description ?? null,
    tenantId: options?.tenantId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function generateLabelSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LABEL_LIMITS.MAX_SLUG_LENGTH);
}
