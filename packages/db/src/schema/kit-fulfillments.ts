/**
 * Agency Founding Kit fulfillments (GAP-448 Phase 2).
 *
 * Tracks stamp-on-payment for Agency Perpetual (max, maxSites 10) purchases.
 * Never stores license private keys. Artifact may be thin (P2-A) or full (P2-B).
 *
 * Spec: .jv docs/specs/2026-08-02-gap-448-phase2-stamp-deliver.md
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { licenses } from './licenses.js';
import { users } from './users.js';

/** Fulfillment lifecycle. */
export type KitFulfillmentStatus = 'queued' | 'running' | 'awaiting_branding' | 'ready' | 'failed';

/** Artifact production mode: thin package (P2-A) or full stamp tarball (P2-B). */
export type KitArtifactMode = 'thin' | 'full';

export interface KitBranding {
  company: string;
  slug: string;
  brand: string;
  email: string;
}

/**
 * Opaque artifact metadata (no private key material).
 * P2-A: manifest + START-HERE + revforge.json stored as JSON or object URI.
 * P2-B: full kit tarball URI when long-running stamp worker is wired.
 */
export interface KitArtifactMeta {
  mode: KitArtifactMode;
  /** Object storage URI or inline storage key */
  uri?: string;
  /** SHA-256 hex of artifact bytes when stored */
  contentSha256?: string;
  /** Template / stamp version tag for reproducibility */
  templateVersion?: string;
  /** Human notes for ops (e.g. full stamp deferred) */
  note?: string;
  /** P2-A thin package JSON (no private keys) */
  package?: Record<string, unknown>;
}

export const kitFulfillments = pgTable(
  'kit_fulfillments',
  {
    id: text('id').primaryKey(),

    /** Stripe event id — idempotency with jobs queue */
    stripeEventId: text('stripe_event_id').notNull(),

    licenseId: text('license_id').references(() => licenses.id, { onDelete: 'set null' }),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    customerId: text('customer_id').notNull(),

    /** Always max for Agency Founding Kit */
    tier: text('tier').notNull().default('max'),

    status: text('status').notNull().default('queued').$type<KitFulfillmentStatus>(),

    /** thin (P2-A default) | full (P2-B) */
    artifactMode: text('artifact_mode').notNull().default('thin').$type<KitArtifactMode>(),

    branding: jsonb('branding').$type<KitBranding>().notNull(),

    artifact: jsonb('artifact').$type<KitArtifactMeta>(),

    /** Last failure message (no secrets) */
    error: text('error'),

    /** Stripe livemode of originating event */
    livemode: text('livemode').notNull().default('test'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('kit_fulfillments_stripe_event_id_uidx').on(table.stripeEventId),
    index('kit_fulfillments_license_id_idx').on(table.licenseId),
    index('kit_fulfillments_user_id_idx').on(table.userId),
    index('kit_fulfillments_status_idx').on(table.status),
    index('kit_fulfillments_customer_id_idx').on(table.customerId),
    check(
      'kit_fulfillments_status_check',
      sql`status IN ('queued', 'running', 'awaiting_branding', 'ready', 'failed')`,
    ),
    check('kit_fulfillments_artifact_mode_check', sql`artifact_mode IN ('thin', 'full')`),
  ],
);

export type KitFulfillment = typeof kitFulfillments.$inferSelect;
export type NewKitFulfillment = typeof kitFulfillments.$inferInsert;
