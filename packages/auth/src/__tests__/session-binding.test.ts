/**
 * Session Binding Validation Tests
 *
 * Tests for IP/user-agent session binding enforcement.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  configureSessionBinding,
  resetSessionBindingConfig,
  validateSessionBinding,
} from '../server/session.js';
import type { Session } from '../types.js';

function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: 'session-123',
    schemaVersion: '1',
    userId: 'user-123',
    tokenHash: 'hashed-token',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
    ipAddress: '192.168.1.100',
    persistent: false,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    ...overrides,
  };
}

afterEach(() => {
  resetSessionBindingConfig();
});

describe('validateSessionBinding', () => {
  describe('user-agent enforcement (default: on)', () => {
    it('returns null when user-agent matches', () => {
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '192.168.1.100',
      });
      expect(result).toBeNull();
    });

    it('returns mismatch reason when user-agent differs', () => {
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'curl/7.88.1',
        ipAddress: '192.168.1.100',
      });
      expect(result).toBe('user-agent mismatch');
    });

    it('skips check when request has no user-agent', () => {
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        ipAddress: '192.168.1.100',
      });
      expect(result).toBeNull();
    });

    it('skips check when session has no stored user-agent', () => {
      const session = createMockSession({ userAgent: null });
      const result = validateSessionBinding(session, {
        userAgent: 'curl/7.88.1',
        ipAddress: '192.168.1.100',
      });
      expect(result).toBeNull();
    });

    it('can be disabled via config', () => {
      configureSessionBinding({ enforceUserAgent: false });
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'completely-different-agent',
        ipAddress: '192.168.1.100',
      });
      expect(result).toBeNull();
    });
  });

  describe('IP address enforcement (default: off, warn only)', () => {
    it('returns null when IP matches', () => {
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '192.168.1.100',
      });
      expect(result).toBeNull();
    });

    it('returns null when IP differs (default: warn only)', () => {
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '10.0.0.1',
      });
      // Default config: warnOnIpChange=true, enforceIp=false → no rejection
      expect(result).toBeNull();
    });

    it('rejects when IP differs and enforceIp is enabled', () => {
      configureSessionBinding({ enforceIp: true });
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '10.0.0.1',
      });
      expect(result).toBe('ip-address mismatch');
    });

    it('skips check when request has no IP', () => {
      configureSessionBinding({ enforceIp: true });
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
      });
      expect(result).toBeNull();
    });

    it('skips check when session has no stored IP', () => {
      configureSessionBinding({ enforceIp: true });
      const session = createMockSession({ ipAddress: null });
      const result = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '10.0.0.1',
      });
      expect(result).toBeNull();
    });
  });

  describe('configureSessionBinding', () => {
    it('allows partial overrides', () => {
      configureSessionBinding({ enforceIp: true });
      const session = createMockSession();

      // IP should now be enforced
      const ipResult = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '10.0.0.1',
      });
      expect(ipResult).toBe('ip-address mismatch');

      // UA should still be enforced (default)
      const uaResult = validateSessionBinding(session, {
        userAgent: 'different-agent',
        ipAddress: '192.168.1.100',
      });
      expect(uaResult).toBe('user-agent mismatch');
    });

    it('resetSessionBindingConfig restores defaults', () => {
      configureSessionBinding({ enforceUserAgent: false, enforceIp: true });
      resetSessionBindingConfig();

      const session = createMockSession();

      // UA enforcement should be back on
      const uaResult = validateSessionBinding(session, {
        userAgent: 'different-agent',
        ipAddress: '192.168.1.100',
      });
      expect(uaResult).toBe('user-agent mismatch');

      // IP enforcement should be back off
      const ipResult = validateSessionBinding(session, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
        ipAddress: '10.0.0.1',
      });
      expect(ipResult).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null when no context is meaningful', () => {
      const session = createMockSession({ userAgent: null, ipAddress: null });
      const result = validateSessionBinding(session, {});
      expect(result).toBeNull();
    });

    it('checks user-agent before IP (short-circuits)', () => {
      configureSessionBinding({ enforceIp: true });
      const session = createMockSession();
      const result = validateSessionBinding(session, {
        userAgent: 'different-agent',
        ipAddress: '10.0.0.1',
      });
      // Should return UA mismatch, not IP mismatch
      expect(result).toBe('user-agent mismatch');
    });
  });
});
