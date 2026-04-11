import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks  -  vi.mock factories run before any imports, so all mock
// variables referenced inside must be created via vi.hoisted().
// ---------------------------------------------------------------------------

const {
  mockRows,
  mockLimit,
  mockWhere,
  mockFrom,
  mockSelect,
  mockInsertValues,
  mockInsert,
  mockUpdateWhere,
  mockUpdateSet,
  mockUpdate,
  mockDeleteWhere,
  mockDelete,
  mockGenerateRegistrationOptions,
  mockVerifyRegistrationResponse,
  mockGenerateAuthenticationOptions,
  mockVerifyAuthenticationResponse,
} = vi.hoisted(() => {
  const mockRows: Record<string, unknown>[][] = [[]];
  const mockLimit = vi.fn().mockImplementation(() => Promise.resolve(mockRows[0]));
  const mockWhere = vi.fn().mockImplementation(() => {
    const result = Promise.resolve(mockRows[0]);
    (result as Record<string, unknown>).limit = mockLimit;
    return result;
  });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  return {
    mockRows,
    mockLimit,
    mockWhere,
    mockFrom,
    mockSelect,
    mockInsertValues,
    mockInsert,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockDeleteWhere,
    mockDelete,
    mockGenerateRegistrationOptions: vi.fn(),
    mockVerifyRegistrationResponse: vi.fn(),
    mockGenerateAuthenticationOptions: vi.fn(),
    mockVerifyAuthenticationResponse: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  passkeys: {
    id: 'id',
    userId: 'userId',
    credentialId: 'credentialId',
    publicKey: 'publicKey',
    counter: 'counter',
    transports: 'transports',
    aaguid: 'aaguid',
    deviceName: 'deviceName',
    backedUp: 'backedUp',
    createdAt: 'createdAt',
    lastUsedAt: 'lastUsedAt',
  },
  users: {
    id: 'id',
    password: 'password',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args) => ({ and: args })),
  count: vi.fn(() => 'count_agg'),
  isNotNull: vi.fn((_col) => ({ isNotNull: true })),
}));

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: mockGenerateRegistrationOptions,
  verifyRegistrationResponse: mockVerifyRegistrationResponse,
  generateAuthenticationOptions: mockGenerateAuthenticationOptions,
  verifyAuthenticationResponse: mockVerifyAuthenticationResponse,
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import {
  configurePasskey,
  countUserCredentials,
  deletePasskey,
  generateAuthenticationChallenge,
  generateRegistrationChallenge,
  listPasskeys,
  renamePasskey,
  resetPasskeyConfig,
  storePasskey,
  verifyAuthentication,
  verifyRegistration,
} from '../passkey.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('passkey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows[0] = [];
    resetPasskeyConfig();

    // Re-wire default chain returns after clearAllMocks
    mockLimit.mockImplementation(() => Promise.resolve(mockRows[0]));
    mockWhere.mockImplementation(() => {
      const result = Promise.resolve(mockRows[0]);
      (result as Record<string, unknown>).limit = mockLimit;
      return result;
    });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockInsertValues.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  // =========================================================================
  // Configuration
  // =========================================================================

  describe('configurePasskey / resetPasskeyConfig', () => {
    it('overrides defaults with configurePasskey', async () => {
      configurePasskey({ rpId: 'example.com', rpName: 'Example' });

      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
      });

      await generateRegistrationChallenge('user-1', 'user@example.com');

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpID: 'example.com',
          rpName: 'Example',
        }),
      );
    });

    it('resets config to defaults with resetPasskeyConfig', async () => {
      configurePasskey({ rpId: 'example.com' });
      resetPasskeyConfig();

      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
      });

      await generateRegistrationChallenge('user-1', 'user@test.com');

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpID: 'localhost',
          rpName: 'RevealUI',
        }),
      );
    });
  });

  // =========================================================================
  // Registration
  // =========================================================================

  describe('generateRegistrationChallenge', () => {
    it('calls generateRegistrationOptions with correct params', async () => {
      const mockOptions = {
        challenge: 'abc123',
        rp: { name: 'RevealUI', id: 'localhost' },
      };
      mockGenerateRegistrationOptions.mockResolvedValue(mockOptions);

      const result = await generateRegistrationChallenge('user-1', 'user@test.com');

      expect(result).toEqual(mockOptions);
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith({
        rpName: 'RevealUI',
        rpID: 'localhost',
        userName: 'user@test.com',
        userID: new TextEncoder().encode('user-1'),
        userDisplayName: 'user@test.com',
        excludeCredentials: undefined,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        timeout: 5 * 60 * 1000,
      });
    });

    it('passes existing credential IDs as excludeCredentials', async () => {
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test',
      });

      await generateRegistrationChallenge('user-1', 'user@test.com', ['cred-1', 'cred-2']);

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: [{ id: 'cred-1' }, { id: 'cred-2' }],
        }),
      );
    });
  });

  describe('verifyRegistration', () => {
    const mockResponse: unknown = {
      id: 'credential-id',
      rawId: 'credential-id',
      response: {
        clientDataJSON: 'base64data',
        attestationObject: 'base64data',
      },
      type: 'public-key',
      clientExtensionResults: {},
    };

    it('calls verifyRegistrationResponse and returns result', async () => {
      const mockVerification = {
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-id',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
          },
          fmt: 'none',
          aaguid: '00000000-0000-0000-0000-000000000000',
          credentialType: 'public-key',
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
          userVerified: true,
          origin: 'http://localhost:4000',
          attestationObject: new Uint8Array([]),
        },
      };
      mockVerifyRegistrationResponse.mockResolvedValue(mockVerification);

      const result = await verifyRegistration(
        mockResponse as Parameters<typeof verifyRegistration>[0],
        'challenge-123',
      );

      expect(result).toEqual(mockVerification);
      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith({
        response: mockResponse,
        expectedChallenge: 'challenge-123',
        expectedOrigin: 'http://localhost:4000',
        expectedRPID: 'localhost',
      });
    });

    it('uses custom origin when provided', async () => {
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'id', publicKey: new Uint8Array(), counter: 0 },
        },
      });

      await verifyRegistration(
        mockResponse as Parameters<typeof verifyRegistration>[0],
        'challenge-123',
        'https://example.com',
      );

      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedOrigin: 'https://example.com',
        }),
      );
    });

    it('throws if verification fails', async () => {
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: false,
      });

      await expect(
        verifyRegistration(
          mockResponse as Parameters<typeof verifyRegistration>[0],
          'challenge-123',
        ),
      ).rejects.toThrow('Passkey registration verification failed');
    });
  });

  // =========================================================================
  // Credential Storage
  // =========================================================================

  describe('storePasskey', () => {
    it('inserts passkey row with correct fields', async () => {
      // Mock count query returning 0 existing passkeys
      mockRows[0] = [{ total: 0 }];

      const credential = {
        id: 'cred-id-base64',
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ['internal'] as string[],
        aaguid: 'test-aaguid',
        backedUp: true,
      };

      const result = await storePasskey('user-1', credential, 'My MacBook');

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          credentialId: 'cred-id-base64',
          publicKey: expect.any(Buffer),
          counter: 0,
          transports: ['internal'],
          aaguid: 'test-aaguid',
          deviceName: 'My MacBook',
          backedUp: true,
        }),
      );

      expect(result.userId).toBe('user-1');
      expect(result.credentialId).toBe('cred-id-base64');
      expect(result.deviceName).toBe('My MacBook');
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('rejects when user has reached max passkeys', async () => {
      // Mock count query returning 10 (at limit)
      mockRows[0] = [{ total: 10 }];

      const credential = {
        id: 'cred-id',
        publicKey: new Uint8Array([1, 2]),
        counter: 0,
      };

      await expect(storePasskey('user-1', credential)).rejects.toThrow(
        'Maximum of 10 passkeys per user reached',
      );

      // Should NOT have attempted insertion
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('respects custom maxPasskeysPerUser config', async () => {
      configurePasskey({ maxPasskeysPerUser: 3 });
      mockRows[0] = [{ total: 3 }];

      const credential = {
        id: 'cred-id',
        publicKey: new Uint8Array([1]),
        counter: 0,
      };

      await expect(storePasskey('user-1', credential)).rejects.toThrow(
        'Maximum of 3 passkeys per user reached',
      );
    });

    it('defaults optional fields to null/false', async () => {
      mockRows[0] = [{ total: 0 }];

      const credential = {
        id: 'cred-id',
        publicKey: new Uint8Array([5, 6]),
        counter: 0,
      };

      await storePasskey('user-1', credential);

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          transports: null,
          aaguid: null,
          deviceName: null,
          backedUp: false,
        }),
      );
    });
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('generateAuthenticationChallenge', () => {
    it('calls generateAuthenticationOptions with default config', async () => {
      const mockOptions = { challenge: 'auth-challenge', rpId: 'localhost' };
      mockGenerateAuthenticationOptions.mockResolvedValue(mockOptions);

      const result = await generateAuthenticationChallenge();

      expect(result).toEqual(mockOptions);
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith({
        rpID: 'localhost',
        allowCredentials: undefined,
        timeout: 5 * 60 * 1000,
        userVerification: 'preferred',
      });
    });

    it('passes allowCredentials when provided', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'test',
      });

      await generateAuthenticationChallenge([
        { id: 'cred-1', transports: ['usb', 'nfc'] },
        { id: 'cred-2' },
      ]);

      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          allowCredentials: [
            { id: 'cred-1', transports: ['usb', 'nfc'] },
            { id: 'cred-2', transports: undefined },
          ],
        }),
      );
    });
  });

  describe('verifyAuthentication', () => {
    const mockAssertionResponse: unknown = {
      id: 'cred-id',
      rawId: 'cred-id',
      response: {
        clientDataJSON: 'base64',
        authenticatorData: 'base64',
        signature: 'base64',
      },
      type: 'public-key',
      clientExtensionResults: {},
    };

    const mockCredential = {
      id: 'cred-id',
      publicKey: new Uint8Array([10, 20, 30]),
      counter: 5,
    };

    it('verifies and updates counter + lastUsedAt', async () => {
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          credentialID: 'cred-id',
          newCounter: 6,
          userVerified: true,
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: true,
          origin: 'http://localhost:4000',
          rpID: 'localhost',
        },
      });

      const result = await verifyAuthentication(
        mockAssertionResponse as Parameters<typeof verifyAuthentication>[0],
        mockCredential,
        'challenge-456',
      );

      expect(result.verified).toBe(true);
      expect(result.newCounter).toBe(6);

      // Should have updated the DB
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          counter: 6,
          lastUsedAt: expect.any(Date),
        }),
      );
    });

    it('does not update DB when verification fails', async () => {
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: false,
        authenticationInfo: {
          credentialID: 'cred-id',
          newCounter: 5,
          userVerified: false,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: 'http://localhost:4000',
          rpID: 'localhost',
        },
      });

      const result = await verifyAuthentication(
        mockAssertionResponse as Parameters<typeof verifyAuthentication>[0],
        mockCredential,
        'challenge-456',
      );

      expect(result.verified).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('uses custom origin when provided', async () => {
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          credentialID: 'cred-id',
          newCounter: 6,
          userVerified: true,
          credentialDeviceType: 'multiDevice',
          credentialBackedUp: false,
          origin: 'https://example.com',
          rpID: 'example.com',
        },
      });

      await verifyAuthentication(
        mockAssertionResponse as Parameters<typeof verifyAuthentication>[0],
        mockCredential,
        'challenge-456',
        'https://example.com',
      );

      expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedOrigin: 'https://example.com',
        }),
      );
    });
  });

  // =========================================================================
  // Management
  // =========================================================================

  describe('listPasskeys', () => {
    it('returns passkeys without publicKey and counter', async () => {
      const now = new Date();
      mockRows[0] = [
        {
          id: 'pk-1',
          credentialId: 'cred-1',
          deviceName: 'MacBook',
          backedUp: true,
          createdAt: now,
          lastUsedAt: now,
        },
        {
          id: 'pk-2',
          credentialId: 'cred-2',
          deviceName: null,
          backedUp: false,
          createdAt: now,
          lastUsedAt: null,
        },
      ];

      const result = await listPasskeys('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'pk-1',
        credentialId: 'cred-1',
        deviceName: 'MacBook',
        backedUp: true,
        createdAt: now,
        lastUsedAt: now,
      });

      // Verify select was called with specific columns (no publicKey/counter)
      expect(mockSelect).toHaveBeenCalledWith({
        id: 'id',
        credentialId: 'credentialId',
        deviceName: 'deviceName',
        backedUp: 'backedUp',
        createdAt: 'createdAt',
        lastUsedAt: 'lastUsedAt',
      });
    });
  });

  describe('deletePasskey', () => {
    it('deletes the passkey when user has other credentials', async () => {
      // First call: count passkeys (returns 2)
      // Second call: check user password
      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // passkey count
          return Promise.resolve([{ total: 2 }]);
        }
        // user password check
        const result = Promise.resolve([{ password: 'hashed-pw' }]);
        (result as Record<string, unknown>).limit = vi
          .fn()
          .mockResolvedValue([{ password: 'hashed-pw' }]);
        return result;
      });

      await deletePasskey('user-1', 'pk-1');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it('deletes passkey when user has password but only one passkey', async () => {
      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ total: 1 }]);
        }
        const result = Promise.resolve([{ password: 'hashed-pw' }]);
        (result as Record<string, unknown>).limit = vi
          .fn()
          .mockResolvedValue([{ password: 'hashed-pw' }]);
        return result;
      });

      await deletePasskey('user-1', 'pk-1');

      expect(mockDelete).toHaveBeenCalled();
    });

    it('blocks deletion if last passkey and no password', async () => {
      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ total: 1 }]);
        }
        const result = Promise.resolve([{ password: null }]);
        (result as Record<string, unknown>).limit = vi.fn().mockResolvedValue([{ password: null }]);
        return result;
      });

      await expect(deletePasskey('user-1', 'pk-1')).rejects.toThrow(
        'Cannot delete last sign-in method',
      );

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('renamePasskey', () => {
    it('updates device_name for the given passkey and user', async () => {
      await renamePasskey('user-1', 'pk-1', 'iPhone 15');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith({ deviceName: 'iPhone 15' });
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('countUserCredentials', () => {
    it('returns correct passkey count and hasPassword true', async () => {
      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ total: 3 }]);
        }
        const result = Promise.resolve([{ password: 'hashed' }]);
        (result as Record<string, unknown>).limit = vi
          .fn()
          .mockResolvedValue([{ password: 'hashed' }]);
        return result;
      });

      const result = await countUserCredentials('user-1');

      expect(result).toEqual({ passkeyCount: 3, hasPassword: true });
    });

    it('returns hasPassword false when password is null', async () => {
      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ total: 1 }]);
        }
        const result = Promise.resolve([{ password: null }]);
        (result as Record<string, unknown>).limit = vi.fn().mockResolvedValue([{ password: null }]);
        return result;
      });

      const result = await countUserCredentials('user-1');

      expect(result).toEqual({ passkeyCount: 1, hasPassword: false });
    });

    it('returns zero counts for non-existent user', async () => {
      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ total: 0 }]);
        }
        const result = Promise.resolve([]);
        (result as Record<string, unknown>).limit = vi.fn().mockResolvedValue([]);
        return result;
      });

      const result = await countUserCredentials('user-999');

      expect(result).toEqual({ passkeyCount: 0, hasPassword: false });
    });
  });
});
