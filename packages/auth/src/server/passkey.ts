/**
 * WebAuthn Passkey Module
 *
 * Implements passkey registration, authentication, and management using
 * @simplewebauthn/server v13. Passkeys enable passwordless authentication
 * via biometrics, security keys, or platform authenticators.
 *
 * @see https://simplewebauthn.dev/
 */

import crypto from 'node:crypto';
import { getClient } from '@revealui/db/client';
import { passkeys, users } from '@revealui/db/schema';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  VerifiedRegistrationResponse,
  WebAuthnCredential,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { and, count, eq } from 'drizzle-orm';

// =============================================================================
// Configuration (parameterization convention)
// =============================================================================

export interface PasskeyConfig {
  /** Maximum passkeys per user (default: 10) */
  maxPasskeysPerUser: number;
  /** Challenge TTL in ms (default: 5 minutes) */
  challengeTtlMs: number;
  /** Relying Party ID  -  domain name (default: 'localhost') */
  rpId: string;
  /** Relying Party name  -  user-visible (default: 'RevealUI') */
  rpName: string;
  /** Expected origin(s) for verification (default: 'http://localhost:4000') */
  origin: string | string[];
}

const DEFAULT_CONFIG: PasskeyConfig = {
  maxPasskeysPerUser: 10,
  challengeTtlMs: 5 * 60 * 1000,
  rpId: process.env.PASSKEY_RP_ID || 'localhost',
  rpName: process.env.PASSKEY_RP_NAME || 'RevealUI',
  origin: process.env.PASSKEY_ORIGIN || 'http://localhost:4000',
};

let config: PasskeyConfig = { ...DEFAULT_CONFIG };
let _productionChecked = false;

export function configurePasskey(overrides: Partial<PasskeyConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
  _productionChecked = false;
}

export function resetPasskeyConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

function assertProductionConfig(): void {
  if (_productionChecked) return;
  _productionChecked = true;
  if (process.env.NODE_ENV === 'production' && config.rpId === 'localhost') {
    throw new Error(
      'Passkey rpId is "localhost" in production. Set PASSKEY_RP_ID or call configurePasskey() at startup.',
    );
  }
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Generate WebAuthn registration options for a user.
 *
 * The returned object should be passed to the browser's navigator.credentials.create().
 * The challenge is embedded in the options and should be stored server-side
 * for verification.
 *
 * @param userId - User's database ID
 * @param userEmail - User's email (used as userName in WebAuthn)
 * @param existingCredentialIds - Credential IDs to exclude (prevent re-registration)
 */
export async function generateRegistrationChallenge(
  userId: string,
  userEmail: string,
  existingCredentialIds?: string[],
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  assertProductionConfig();
  const excludeCredentials = existingCredentialIds?.map((id) => ({
    id,
  }));

  // Encode userId as Uint8Array for WebAuthn userID field
  const userIdBytes = new TextEncoder().encode(userId);

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: userEmail,
    userID: userIdBytes,
    userDisplayName: userEmail,
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    timeout: config.challengeTtlMs,
  });

  return options;
}

/**
 * Verify a WebAuthn registration response from the browser.
 *
 * @param response - The RegistrationResponseJSON from the browser
 * @param expectedChallenge - The challenge from generateRegistrationChallenge
 * @param expectedOrigin - Override origin (defaults to config.origin)
 * @returns Verified registration data including credential info
 * @throws If verification fails
 */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  expectedOrigin?: string | string[],
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: expectedOrigin ?? config.origin,
    expectedRPID: config.rpId,
  });

  if (!(verification.verified && verification.registrationInfo)) {
    throw new Error('Passkey registration verification failed');
  }

  return verification;
}

// =============================================================================
// Credential Storage
// =============================================================================

/**
 * Store a verified passkey credential in the database.
 *
 * Enforces the per-user passkey limit before insertion.
 *
 * @param userId - User's database ID
 * @param credential - Verified credential from verifyRegistration
 * @param deviceName - Optional user-friendly name (e.g., "MacBook Pro Touch ID")
 * @returns The stored passkey record
 */
export async function storePasskey(
  userId: string,
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: string[];
    aaguid?: string;
    backedUp?: boolean;
  },
  deviceName?: string,
): Promise<{
  id: string;
  userId: string;
  credentialId: string;
  deviceName: string | null;
  createdAt: Date;
}> {
  const db = getClient();

  // Enforce per-user passkey limit
  const [result] = await db
    .select({ total: count() })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));

  const currentCount = result?.total ?? 0;
  if (currentCount >= config.maxPasskeysPerUser) {
    throw new Error(`Maximum of ${config.maxPasskeysPerUser} passkeys per user reached`);
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(passkeys).values({
    id,
    userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? null,
    aaguid: credential.aaguid ?? null,
    deviceName: deviceName ?? null,
    backedUp: credential.backedUp ?? false,
    createdAt: now,
  });

  return {
    id,
    userId,
    credentialId: credential.id,
    deviceName: deviceName ?? null,
    createdAt: now,
  };
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Generate WebAuthn authentication options.
 *
 * The returned object should be passed to the browser's navigator.credentials.get().
 *
 * @param allowCredentials - Optional list of credential IDs to allow
 */
export async function generateAuthenticationChallenge(
  allowCredentials?: { id: string; transports?: string[] }[],
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  assertProductionConfig();
  const options = await generateAuthenticationOptions({
    rpID: config.rpId,
    allowCredentials: allowCredentials?.map((cred) => ({
      id: cred.id,
      transports: cred.transports as (
        | 'ble'
        | 'cable'
        | 'hybrid'
        | 'internal'
        | 'nfc'
        | 'smart-card'
        | 'usb'
      )[],
    })),
    timeout: config.challengeTtlMs,
    userVerification: 'preferred',
  });

  return options;
}

/**
 * Verify a WebAuthn authentication response and update the credential counter.
 *
 * @param response - The AuthenticationResponseJSON from the browser
 * @param credential - The stored credential (id, publicKey, counter)
 * @param expectedChallenge - The challenge from generateAuthenticationChallenge
 * @param expectedOrigin - Override origin (defaults to config.origin)
 * @returns Verification result with new counter value
 */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  credential: WebAuthnCredential,
  expectedChallenge: string,
  expectedOrigin?: string | string[],
): Promise<{
  verified: boolean;
  newCounter: number;
}> {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: expectedOrigin ?? config.origin,
    expectedRPID: [config.rpId],
    credential,
  });

  if (verification.verified) {
    // Update counter and lastUsedAt in the database
    const db = getClient();
    await db
      .update(passkeys)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(passkeys.credentialId, credential.id));
  }

  return {
    verified: verification.verified,
    newCounter: verification.authenticationInfo.newCounter,
  };
}

// =============================================================================
// Management
// =============================================================================

/**
 * List all passkeys for a user (safe for client  -  excludes publicKey and counter).
 */
export async function listPasskeys(userId: string): Promise<
  {
    id: string;
    credentialId: string;
    deviceName: string | null;
    backedUp: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }[]
> {
  const db = getClient();

  const rows = await db
    .select({
      id: passkeys.id,
      credentialId: passkeys.credentialId,
      deviceName: passkeys.deviceName,
      backedUp: passkeys.backedUp,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));

  return rows;
}

/**
 * Delete a passkey. Blocks deletion if it's the user's last sign-in method.
 *
 * @param userId - User's database ID
 * @param passkeyId - The passkey record ID to delete
 * @throws If this is the user's only sign-in method
 */
export async function deletePasskey(userId: string, passkeyId: string): Promise<void> {
  const { passkeyCount, hasPassword } = await countUserCredentials(userId);

  if (passkeyCount <= 1 && !hasPassword) {
    throw new Error('Cannot delete last sign-in method');
  }

  const db = getClient();
  await db.delete(passkeys).where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)));
}

/**
 * Rename a passkey's device name.
 *
 * @param userId - User's database ID
 * @param passkeyId - The passkey record ID to rename
 * @param name - New friendly name
 */
export async function renamePasskey(
  userId: string,
  passkeyId: string,
  name: string,
): Promise<void> {
  const db = getClient();
  await db
    .update(passkeys)
    .set({ deviceName: name })
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, userId)));
}

/**
 * Count a user's sign-in credentials (passkeys + password).
 *
 * @param userId - User's database ID
 * @returns Passkey count and whether user has a password set
 */
export async function countUserCredentials(
  userId: string,
): Promise<{ passkeyCount: number; hasPassword: boolean }> {
  const db = getClient();

  const [passkeyResult] = await db
    .select({ total: count() })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));

  const [userResult] = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    passkeyCount: passkeyResult?.total ?? 0,
    hasPassword: userResult?.password != null,
  };
}
