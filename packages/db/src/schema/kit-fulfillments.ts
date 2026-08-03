/**
 * Agency Founding Kit fulfillment rows (GAP-448 Phase 2).
 *
 * Tracks stamp/deliver progress after Agency Perpetual (max) mint.
 * No private key material. Thin package may live in `artifact` jsonb (P2-A);
 * external blob URI goes in `artifact_uri` (P2-B).
 *
 * P2-1 schema landed on test via #2393; P2-A extends with optional `artifact`.
 *
 * @see docs/specs/2026-08-02-gap-448-phase2-stamp-deliver.md
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { licenses } from './licenses.js';
import { users } from './users.js';

/** Job/fulfillment lifecycle for kit.stamp.agency */
export type KitFulfillmentStatus = 'queued' | 'running' | 'awaiting_branding' | 'ready' | 'failed';

export interface KitFulfillmentBranding {
  company?: string;
  slug?: string;
  brand?: string;
  email?: string;
}

/** Thin package files for operator stamp or buyer download (P2-A). */
export interface KitFulfillmentArtifact {
  version: 1;
  manifest: {
    product: 'agency-founding-kit';
    tier: 'max';
    perpetual: true;
    maxSites: 10;
    maxUsers: 100;
    licenseId: string;
    templateVersion: string;
    imageTag: string;
    livemode: boolean;
  };
  startHereMarkdown: string;
  revforgeJson: Record<string, unknown>;
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

    /** Always `max` for Agency Founding Kit perpetual path */
    tier: text('tier').notNull().default('max'),

    status: text('status').notNull().default('queued').$type<KitFulfillmentStatus>(),

    branding: jsonb('branding').$type<KitFulfillmentBranding>().notNull().default({}),

    /**
     * Thin kit package (START-HERE + revforge.json + manifest). Prefer this for
     * P2-A; never store private keys here.
     */
    artifact: jsonb('artifact').$type<KitFulfillmentArtifact>(),

    /** R2/S3 or storage path for P2-B full tarball — never a private key */
    artifactUri: text('artifact_uri'),

    error: text('error'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('kit_fulfillments_stripe_event_id_uidx').on(table.stripeEventId),
    index('kit_fulfillments_user_id_idx').on(table.userId),
    index('kit_fulfillments_license_id_idx').on(table.licenseId),
    index('kit_fulfillments_customer_id_idx').on(table.customerId),
    index('kit_fulfillments_status_idx').on(table.status),
    check(
      'kit_fulfillments_status_check',
      sql`status IN ('queued', 'running', 'awaiting_branding', 'ready', 'failed')`,
    ),
  ],
);

export type KitFulfillment = typeof kitFulfillments.$inferSelect;
export type NewKitFulfillment = typeof kitFulfillments.$inferInsert;
