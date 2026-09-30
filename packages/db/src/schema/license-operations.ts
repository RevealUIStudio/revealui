/** Committed operator issuance/rotation receipts; tokens follow existing licenses storage policy. */
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const licenseOperations = pgTable('license_operations', {
  operationId: text('operation_id').primaryKey(),
  requestFingerprint: text('request_fingerprint').notNull(),
  customerId: text('customer_id').notNull(),
  mode: text('mode').notNull(),
  licenseId: text('license_id').notNull(),
  licenseKey: text('license_key').notNull(),
  jti: text('jti').notNull().unique('license_operations_jti_unique'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
