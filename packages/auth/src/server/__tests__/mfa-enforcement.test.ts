import { describe, expect, it } from 'vitest';
import type { MfaRequest } from '../mfa-enforcement.js';
import { requireMfa } from '../mfa-enforcement.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  overrides: Partial<MfaRequest> & { session?: MfaRequest['session'] } = {},
): MfaRequest {
  return {
    session: {
      user: {
        id: 'user-1',
        role: 'admin',
        mfaEnabled: true,
        mfaVerified: true,
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireMfa', () => {
  describe('default options (admin role)', () => {
    const check = requireMfa();

    it('allows admin with MFA enabled and verified', () => {
      const result = check(makeRequest());
      expect(result.allowed).toBe(true);
      expect(result.status).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('blocks admin without MFA enabled', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'admin', mfaEnabled: false },
          },
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.body?.code).toBe('MFA_REQUIRED');
      expect(result.body?.error).toBe('MFA required');
    });

    it('blocks admin with MFA enabled but not verified this session', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'admin', mfaEnabled: true, mfaVerified: false },
          },
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.body?.code).toBe('MFA_VERIFY_REQUIRED');
      expect(result.body?.error).toBe('MFA verification required');
    });

    it('allows non-admin user without MFA', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: false },
          },
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it('allows requests with no session', () => {
      const result = check({ session: null });
      expect(result.allowed).toBe(true);
    });

    it('allows requests with undefined session', () => {
      const result = check({});
      expect(result.allowed).toBe(true);
    });
  });

  describe('custom roles', () => {
    const check = requireMfa({ roles: ['admin', 'super_admin'] });

    it('enforces MFA for custom roles', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'super_admin', mfaEnabled: false },
          },
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.body?.code).toBe('MFA_REQUIRED');
    });

    it('does not enforce MFA for roles not in the list', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'viewer', mfaEnabled: false },
          },
        }),
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('operation-based enforcement', () => {
    const check = requireMfa({
      roles: [],
      operations: ['delete_user', 'change_role'],
    });

    it('blocks operation when MFA is not enabled', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: false },
          },
          operation: 'delete_user',
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.body?.code).toBe('MFA_REQUIRED');
    });

    it('blocks operation when MFA is enabled but not verified', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: true, mfaVerified: false },
          },
          operation: 'change_role',
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.body?.code).toBe('MFA_VERIFY_REQUIRED');
    });

    it('allows operation when MFA is enabled and verified', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: true, mfaVerified: true },
          },
          operation: 'delete_user',
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it('allows operations not in the list', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: false },
          },
          operation: 'read_data',
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it('allows when no operation is specified', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: false },
          },
        }),
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('combined role and operation enforcement', () => {
    const check = requireMfa({
      roles: ['admin'],
      operations: ['delete_user'],
    });

    it('blocks admin even without operation', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'admin', mfaEnabled: false },
          },
        }),
      );
      expect(result.allowed).toBe(false);
    });

    it('blocks non-admin performing restricted operation', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: false },
          },
          operation: 'delete_user',
        }),
      );
      expect(result.allowed).toBe(false);
    });

    it('allows non-admin performing unrestricted operation', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'editor', mfaEnabled: false },
          },
          operation: 'read_data',
        }),
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('mfaVerified defaults', () => {
    const check = requireMfa();

    it('treats undefined mfaVerified as not verified', () => {
      const result = check(
        makeRequest({
          session: {
            user: { id: 'u1', role: 'admin', mfaEnabled: true },
          },
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.body?.code).toBe('MFA_VERIFY_REQUIRED');
    });
  });
});
