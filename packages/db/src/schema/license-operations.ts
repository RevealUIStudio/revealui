/** Committed operator issuance/rotation receipts; tokens follow existing licenses storage policy. */
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { LicenseOperationDescriptor } from '../license-operations.js';

export const licenseOperations = pgTable('license_operations', {
  operationId: text('operation_id').primaryKey(),
  requestFingerprint: text('request_fingerprint').notNull(),
  customerId: text('customer_id').notNull(),
  mode: text('mode').notNull(),
  licenseId: text('license_id').notNull(),
  licenseKey: text('license_key').notNull(),
  jti: text('jti').notNull().unique('license_operations_jti_unique'),
  requestDescriptor: jsonb('request_descriptor').$type<LicenseOperationDescriptor>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
