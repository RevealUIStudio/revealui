/**
 * Schema shape lock for GAP-464 Enterprise SSO tables.
 * Runtime login paths land in later phase PRs.
 */
import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accountSsoProviders, ssoIdentities } from '../sso.js';

describe('GAP-464 SSO schema', () => {
  it('account_sso_providers exposes expected columns', () => {
    const cols = Object.keys(accountSsoProviders);
    for (const key of [
      'id',
      'accountId',
      'providerType',
      'name',
      'enabled',
      'issuer',
      'discoveryUrl',
      'clientId',
      'clientSecretRef',
      'samlMetadataUrl',
      'groupClaim',
      'groupRoleMap',
      'defaultRole',
      'requireGroupMatch',
      'allowPasswordFallback',
      'deletedAt',
    ]) {
      expect(cols).toContain(key);
    }
  });

  it('sso_identities links user + provider + subject', () => {
    const cols = Object.keys(ssoIdentities);
    for (const key of ['id', 'userId', 'providerId', 'subject', 'email']) {
      expect(cols).toContain(key);
    }
  });

  it('table names are stable for migrations', () => {
    expect(getTableName(accountSsoProviders)).toBe('account_sso_providers');
    expect(getTableName(ssoIdentities)).toBe('sso_identities');
  });
});
