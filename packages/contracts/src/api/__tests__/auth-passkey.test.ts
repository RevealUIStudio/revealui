/**
 * Auth Passkey & Recovery Contract Tests
 *
 * Tests for passkey registration/authentication, recovery, and updated MFA disable contracts
 */

import { describe, expect, it } from 'vitest';
import {
  MFADisableRequestSchema,
  PasskeyAuthenticateVerifyRequestSchema,
  PasskeyListResponseSchema,
  PasskeyRegisterOptionsRequestSchema,
  PasskeyRegisterVerifyRequestSchema,
  PasskeyUpdateRequestSchema,
  RecoveryRequestSchema,
  RecoveryVerifyRequestSchema,
} from '../auth.js';

describe('PasskeyRegisterOptionsRequestSchema', () => {
  it('parses full registration data', () => {
    const result = PasskeyRegisterOptionsRequestSchema.safeParse({
      email: 'a@b.com',
      name: 'User',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('a@b.com');
      expect(result.data.name).toBe('User');
    }
  });

  it('parses empty object (authenticated user adding passkey)', () => {
    const result = PasskeyRegisterOptionsRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = PasskeyRegisterOptionsRequestSchema.safeParse({
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 255 characters', () => {
    const result = PasskeyRegisterOptionsRequestSchema.safeParse({
      name: 'a'.repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

describe('PasskeyRegisterVerifyRequestSchema', () => {
  it('parses attestation response with device name', () => {
    const result = PasskeyRegisterVerifyRequestSchema.safeParse({
      attestationResponse: { id: 'abc', rawId: 'xyz', type: 'public-key' },
      deviceName: 'iPhone',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attestationResponse).toEqual({
        id: 'abc',
        rawId: 'xyz',
        type: 'public-key',
      });
      expect(result.data.deviceName).toBe('iPhone');
    }
  });

  it('parses without device name', () => {
    const result = PasskeyRegisterVerifyRequestSchema.safeParse({
      attestationResponse: { id: 'abc' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing attestation response', () => {
    const result = PasskeyRegisterVerifyRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects device name exceeding 100 characters', () => {
    const result = PasskeyRegisterVerifyRequestSchema.safeParse({
      attestationResponse: { id: 'abc' },
      deviceName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe('PasskeyAuthenticateVerifyRequestSchema', () => {
  it('parses authentication response', () => {
    const result = PasskeyAuthenticateVerifyRequestSchema.safeParse({
      authenticationResponse: { id: 'abc', rawId: 'xyz', type: 'public-key' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authenticationResponse).toEqual({
        id: 'abc',
        rawId: 'xyz',
        type: 'public-key',
      });
    }
  });

  it('rejects missing authentication response', () => {
    const result = PasskeyAuthenticateVerifyRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('PasskeyListResponseSchema', () => {
  it('parses a list of passkeys', () => {
    const result = PasskeyListResponseSchema.safeParse({
      passkeys: [
        {
          id: 'pk_123',
          deviceName: 'iPhone 15',
          aaguid: '00000000-0000-0000-0000-000000000000',
          backedUp: true,
          createdAt: '2026-03-17T00:00:00Z',
          lastUsedAt: '2026-03-17T12:00:00Z',
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.passkeys).toHaveLength(1);
      expect(result.data.passkeys[0]?.deviceName).toBe('iPhone 15');
    }
  });

  it('parses passkeys with null optional fields', () => {
    const result = PasskeyListResponseSchema.safeParse({
      passkeys: [
        {
          id: 'pk_456',
          deviceName: null,
          aaguid: null,
          backedUp: false,
          createdAt: '2026-03-17T00:00:00Z',
          lastUsedAt: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('parses empty passkey list', () => {
    const result = PasskeyListResponseSchema.safeParse({ passkeys: [] });
    expect(result.success).toBe(true);
  });
});

describe('PasskeyUpdateRequestSchema', () => {
  it('parses valid device name', () => {
    const result = PasskeyUpdateRequestSchema.safeParse({
      deviceName: 'My Key',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceName).toBe('My Key');
    }
  });

  it('rejects empty device name', () => {
    const result = PasskeyUpdateRequestSchema.safeParse({ deviceName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects device name exceeding 100 characters', () => {
    const result = PasskeyUpdateRequestSchema.safeParse({
      deviceName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe('RecoveryRequestSchema', () => {
  it('parses valid email', () => {
    const result = RecoveryRequestSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('rejects invalid email', () => {
    const result = RecoveryRequestSchema.safeParse({ email: 'not-valid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = RecoveryRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('RecoveryVerifyRequestSchema', () => {
  it('parses valid token', () => {
    const result = RecoveryVerifyRequestSchema.safeParse({ token: 'abc123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('abc123');
    }
  });

  it('rejects empty token', () => {
    const result = RecoveryVerifyRequestSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing token', () => {
    const result = RecoveryVerifyRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('MFADisableRequestSchema (updated)', () => {
  it('parses password method', () => {
    const result = MFADisableRequestSchema.safeParse({
      method: 'password',
      password: 'test123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('password');
    }
  });

  it('parses passkey method', () => {
    const result = MFADisableRequestSchema.safeParse({
      method: 'passkey',
      authenticationResponse: { id: 'abc', type: 'public-key' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('passkey');
    }
  });

  it('rejects password method with empty password', () => {
    const result = MFADisableRequestSchema.safeParse({
      method: 'password',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown method', () => {
    const result = MFADisableRequestSchema.safeParse({
      method: 'sms',
      code: '123456',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing method', () => {
    const result = MFADisableRequestSchema.safeParse({
      password: 'test123',
    });
    expect(result.success).toBe(false);
  });
});
