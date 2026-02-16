/**
 * Board Entity Contract
 *
 * Kanban board that contains tickets organized into columns.
 *
 * Business Rules:
 * - Board slug must be unique per tenant
 * - One board per tenant may be marked isDefault
 * - Creating a board auto-creates default columns (Backlog, To Do, In Progress, Review, Done)
 * - Deleting a board cascades to columns and tickets
 */

import { z } from 'zod/v4'

// =============================================================================
// Constants
// =============================================================================

export const BOARD_SCHEMA_VERSION = 1

export const DEFAULT_COLUMN_SLUGS = ['backlog', 'todo', 'in-progress', 'review', 'done'] as const

export const BOARD_LIMITS = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 200,
  MIN_SLUG_LENGTH: 1,
  MAX_SLUG_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_COLUMNS: 20,
} as const

// =============================================================================
// Board Schema
// =============================================================================

export const BoardObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(BOARD_SCHEMA_VERSION)),
  name: z.string().min(BOARD_LIMITS.MIN_NAME_LENGTH).max(BOARD_LIMITS.MAX_NAME_LENGTH),
  slug: z
    .string()
    .min(BOARD_LIMITS.MIN_SLUG_LENGTH)
    .max(BOARD_LIMITS.MAX_SLUG_LENGTH)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  description: z.string().max(BOARD_LIMITS.MAX_DESCRIPTION_LENGTH).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const BoardSchema = BoardObjectSchema
export type Board = z.infer<typeof BoardSchema>

export const BoardInsertSchema = BoardObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type BoardInsert = z.infer<typeof BoardInsertSchema>

// =============================================================================
// Board Column Schema
// =============================================================================

export const BoardColumnObjectSchema = z.object({
  id: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  position: z.number().int().min(0),
  wipLimit: z.number().int().min(1).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const BoardColumnSchema = BoardColumnObjectSchema
export type BoardColumn = z.infer<typeof BoardColumnSchema>

// =============================================================================
// Helpers
// =============================================================================

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BOARD_LIMITS.MAX_SLUG_LENGTH)
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

export function createBoardInsert(
  name: string,
  slug: string,
  options?: {
    id?: string
    description?: string
    ownerId?: string
    tenantId?: string
    isDefault?: boolean
  },
): BoardInsert {
  const now = new Date()
  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(BOARD_SCHEMA_VERSION),
    name,
    slug,
    description: options?.description ?? null,
    ownerId: options?.ownerId ?? null,
    tenantId: options?.tenantId ?? null,
    isDefault: options?.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  }
}
