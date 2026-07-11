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
import { auditLoginFailure, auditLoginSuccess } from '../audit-bridge.js';

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
});
