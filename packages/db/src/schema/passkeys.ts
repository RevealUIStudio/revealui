/**
 * Passkeys table
 *
 * Stores WebAuthn/FIDO2 passkey credentials for passwordless authentication.
 * Each user can register multiple passkeys (e.g., fingerprint, security key, phone).
 * Credential IDs and public keys are stored per the WebAuthn specification.
 */

import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Custom Types
// =============================================================================

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// =============================================================================
// Passkeys Table
// =============================================================================

export const passkeys = pgTable(
  'passkeys',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // WebAuthn credential ID (base64url-encoded by convention)
    credentialId: text('credential_id').notNull(),

    // COSE public key (binary)
    publicKey: bytea('public_key').notNull(),

    // Signature counter for clone detection
    counter: integer('counter').notNull().default(0),

    // Allowed transports (e.g., "usb", "ble", "nfc", "internal")
    transports: jsonb('transports').$type<string[]>(),

    // Authenticator Attestation GUID (identifies authenticator model)
    aaguid: text('aaguid'),

    // User-assigned friendly name (e.g., "MacBook Pro Touch ID")
    deviceName: text('device_name'),

    // Whether the credential is backed up (e.g., iCloud Keychain, Google Password Manager)
    backedUp: boolean('backed_up').default(false).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('passkeys_user_id_idx').on(table.userId),
    uniqueIndex('passkeys_credential_id_idx').on(table.credentialId),
  ],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type Passkey = typeof passkeys.$inferSelect;
export type NewPasskey = typeof passkeys.$inferInsert;
