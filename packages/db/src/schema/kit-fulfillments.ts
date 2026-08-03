/**
 * Agency Founding Kit fulfillments (GAP-448 Phase 2).
 *
 * Tracks stamp-on-payment for Agency Perpetual (max tier) buyers.
 * Artifact is a thin kit package (manifest + START-HERE + revforge.json)
 * stored in `artifact` jsonb — no private key material, no full monorepo zip.
 *
 * @see docs/specs in .jv: 2026-08-02-gap-448-phase2-stamp-deliver.md
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { licenses } from './licenses.js';
import { users } from './users.js';

export type KitFulfillmentStatus = 'queued' | 'running' | 'awaiting_branding' | 'ready' | 'failed';

export interface KitFulfillmentBranding {
  company: string;
  slug: string;
  brand: string;
  email: string;
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

    /** Stripe event id — unique idempotency with the job queue */
    stripeEventId: text('stripe_event_id').notNull(),

    licenseId: text('license_id').references(() => licenses.id, { onDelete: 'set null' }),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    customerId: text('customer_id').notNull(),

    /** Always max for Agency Founding Kit; stored for audit */
    tier: text('tier').notNull().default('max'),

    status: text('status').notNull().default('queued').$type<KitFulfillmentStatus>(),

    branding: jsonb('branding').$type<KitFulfillmentBranding>().notNull(),

    /** Thin kit package (no secrets / no private keys) */
    artifact: jsonb('artifact').$type<KitFulfillmentArtifact>(),

    /** Optional external URI when P2-B R2 upload lands */
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
    index('kit_fulfillments_license_id_idx').on(table.licenseId),
    index('kit_fulfillments_user_id_idx').on(table.userId),
    index('kit_fulfillments_customer_id_idx').on(table.customerId),
    index('kit_fulfillments_status_idx').on(table.status),
    check(
      'kit_fulfillments_status_check',
      sql`status IN ('queued', 'running', 'awaiting_branding', 'ready', 'failed')`,
    ),
  ],
);
