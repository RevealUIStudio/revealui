/**
 * Enterprise SSO providers + federated identities (GAP-464 / revealui#449).
 *
 * Per-account IdP bindings (OIDC | SAML). Secrets are stored as vault path
 * references (`client_secret_ref`), never as raw client secrets in this table.
 * Session authMethod is tagged on sessions.metadata at login time (no session
 * column fork).
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { users } from './users.js';

export type SsoProviderType = 'oidc' | 'saml';

export type SsoGroupRoleMap = Record<string, string>;

export const accountSsoProviders = pgTable(
  'account_sso_providers',
  {
    id: text('id').primaryKey(),

    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),

    /** `oidc` | `saml` */
    providerType: text('provider_type').notNull().$type<SsoProviderType>(),

    /** Admin-facing label */
    name: text('name').notNull(),

    /** Disabled until admin enables after test-connection (recommended default). */
    enabled: boolean('enabled').notNull().default(false),

    /** OIDC issuer URL or SAML IdP entity ID */
    issuer: text('issuer').notNull(),

    discoveryUrl: text('discovery_url'),
    clientId: text('client_id'),
    /** revvault path or sealed-secret id — never log the resolved value */
    clientSecretRef: text('client_secret_ref'),

    samlMetadataUrl: text('saml_metadata_url'),
    samlMetadataXml: text('saml_metadata_xml'),
    samlSpEntityId: text('saml_sp_entity_id'),
    signingCertPem: text('signing_cert_pem'),

    groupClaim: text('group_claim').notNull().default('groups'),
    groupRoleMap: jsonb('group_role_map').$type<SsoGroupRoleMap>().notNull().default({}),
    defaultRole: text('default_role').notNull().default('member'),
    requireGroupMatch: boolean('require_group_match').notNull().default(false),
    allowPasswordFallback: boolean('allow_password_fallback').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('account_sso_providers_account_id_idx').on(table.accountId),
    index('account_sso_providers_deleted_at_idx').on(table.deletedAt),
    // One active issuer per account (soft-deleted rows may reuse issuer later)
    uniqueIndex('account_sso_providers_account_issuer_active_idx')
      .on(table.accountId, table.issuer)
      .where(sql`${table.deletedAt} IS NULL`),
    check('account_sso_providers_type_check', sql`provider_type IN ('oidc', 'saml')`),
  ],
);

export const ssoIdentities = pgTable(
  'sso_identities',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    providerId: text('provider_id')
      .notNull()
      .references(() => accountSsoProviders.id, { onDelete: 'cascade' }),

    /** IdP subject (`sub` / NameID) */
    subject: text('subject').notNull(),
    email: text('email'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('sso_identities_provider_subject_idx').on(table.providerId, table.subject),
    index('sso_identities_user_id_idx').on(table.userId),
    index('sso_identities_provider_id_idx').on(table.providerId),
  ],
);

export type AccountSsoProvider = typeof accountSsoProviders.$inferSelect;
export type NewAccountSsoProvider = typeof accountSsoProviders.$inferInsert;
export type SsoIdentity = typeof ssoIdentities.$inferSelect;
export type NewSsoIdentity = typeof ssoIdentities.$inferInsert;
