/**
 * Tests for the auth → audit-trail bridge.
 *
 * The bridge is best-effort by contract: it emits structured audit events for
 * auth operations, but a failure to persist an event must never propagate to
 * the caller (a login must succeed even when its audit write fails).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLog = vi.fn();

vi.mock('@revealui/security/server', () => ({
  audit: { log: (...args: unknown[]) => mockLog(...args) },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { logger } from '@revealui/core/observability/logger';
import {
  auditLoginFailure,
  auditLoginSuccess,
  auditSsoConfigChanged,
  auditSsoLoginFailure,
  auditSsoLoginSuccess,
} from '../audit-bridge.js';

describe('audit-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLog.mockResolvedValue(undefined);
  });

  describe('auditLoginSuccess', () => {
    it('emits exactly one auth.login success event carrying the actor id', async () => {
      await auditLoginSuccess('user-42', '1.2.3.4', 'test-agent');

      expect(mockLog).toHaveBeenCalledTimes(1);
      const event = mockLog.mock.calls[0][0];
      expect(event.type).toBe('auth.login');
      expect(event.result).toBe('success');
      expect(event.action).toBe('login');
      expect(event.actor.id).toBe('user-42');
      expect(event.actor.type).toBe('user');
      expect(event.actor.ip).toBe('1.2.3.4');
      expect(event.actor.userAgent).toBe('test-agent');
    });

    it('does not throw when the audit write fails, and logs the failure', async () => {
      mockLog.mockRejectedValueOnce(new Error('audit storage down'));

      await expect(auditLoginSuccess('user-42', '1.2.3.4', 'test-agent')).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('auditLoginFailure', () => {
    it('emits an auth.failed_login event carrying the email actor and reason', async () => {
      await auditLoginFailure('bad@example.com', '1.2.3.4', 'test-agent', 'invalid_credentials');

      expect(mockLog).toHaveBeenCalledTimes(1);
      const event = mockLog.mock.calls[0][0];
      expect(event.type).toBe('auth.failed_login');
      expect(event.result).toBe('failure');
      expect(event.actor.id).toBe('bad@example.com');
      expect(event.metadata.reason).toBe('invalid_credentials');
    });

    it('does not throw when the audit write fails', async () => {
      mockLog.mockRejectedValueOnce(new Error('audit storage down'));

      await expect(
        auditLoginFailure('bad@example.com', '1.2.3.4', 'test-agent', 'invalid_credentials'),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('auditSsoLoginSuccess', () => {
    it('emits sso_login_success with provider type, account id, user id, and issuer', async () => {
      await auditSsoLoginSuccess({
        providerType: 'oidc',
        accountId: 'acct-1',
        userId: 'user-9',
        issuer: 'https://idp.example.com',
        providerId: 'prov-1',
        ip: '10.0.0.2',
        userAgent: 'sso-agent',
      });

      expect(mockLog).toHaveBeenCalledTimes(1);
      const event = mockLog.mock.calls[0][0];
      expect(event.type).toBe('sso_login_success');
      expect(event.result).toBe('success');
      expect(event.action).toBe('sso_login');
      expect(event.actor.id).toBe('user-9');
      expect(event.actor.ip).toBe('10.0.0.2');
      expect(event.metadata.providerType).toBe('oidc');
      expect(event.metadata.accountId).toBe('acct-1');
      expect(event.metadata.userId).toBe('user-9');
      expect(event.metadata.issuer).toBe('https://idp.example.com');
    });

    it('does not throw when the audit write fails', async () => {
      mockLog.mockRejectedValueOnce(new Error('audit storage down'));

      await expect(
        auditSsoLoginSuccess({
          providerType: 'saml',
          accountId: 'acct-1',
          userId: 'user-9',
          issuer: 'https://idp.example.com',
        }),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('auditSsoLoginFailure', () => {
    it('emits sso_login_failure with structured SSO fields and reason', async () => {
      await auditSsoLoginFailure({
        reason: 'invalid_signature',
        providerType: 'saml',
        accountId: 'acct-1',
        issuer: 'https://idp.example.com',
        providerId: 'prov-1',
        ip: '10.0.0.2',
        userAgent: 'sso-agent',
      });

      expect(mockLog).toHaveBeenCalledTimes(1);
      const event = mockLog.mock.calls[0][0];
      expect(event.type).toBe('sso_login_failure');
      expect(event.result).toBe('failure');
      expect(event.actor.id).toBe('acct-1');
      expect(event.metadata.providerType).toBe('saml');
      expect(event.metadata.accountId).toBe('acct-1');
      expect(event.metadata.userId).toBeNull();
      expect(event.metadata.issuer).toBe('https://idp.example.com');
      expect(event.metadata.reason).toBe('invalid_signature');
    });
  });

  describe('auditSsoConfigChanged', () => {
    it('emits sso_config_changed with provider type, account id, user id, and issuer', async () => {
      await auditSsoConfigChanged({
        action: 'create',
        providerType: 'oidc',
        accountId: 'acct-1',
        userId: 'admin-1',
        issuer: 'https://idp.example.com',
        providerId: 'prov-1',
      });

      expect(mockLog).toHaveBeenCalledTimes(1);
      const event = mockLog.mock.calls[0][0];
      expect(event.type).toBe('sso_config_changed');
      expect(event.result).toBe('success');
      expect(event.action).toBe('create');
      expect(event.actor.id).toBe('admin-1');
      expect(event.metadata.providerType).toBe('oidc');
      expect(event.metadata.accountId).toBe('acct-1');
      expect(event.metadata.userId).toBe('admin-1');
      expect(event.metadata.issuer).toBe('https://idp.example.com');
      expect(event.metadata.action).toBe('create');
    });
  });
});
