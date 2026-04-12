/**
 * Authentication API Contracts
 *
 * Validation contracts for authentication endpoints
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';

/**
 * Sign-up request validation
 *
 * Validates user registration data with:
 * - Email format validation and sanitization
 * - Password strength requirements (min 8 chars)
 * - Name validation and sanitization
 */
export const SignUpRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform((email) => email.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform((name) => {
      // Strip HTML tags iteratively to handle nested/malformed markup like <scr<script>ipt>
      let clean = name;
      let prev: string;
      do {
        prev = clean;
        clean = clean.replace(/<[^>]*>/g, '');
      } while (clean !== prev);
      return clean.trim().replace(/\s+/g, ' ');
    }),
  tosAccepted: z.literal(true, {
    error: 'You must accept the Terms of Service to create an account.',
  }),
});

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;

export const SignUpRequestContract = createContract({
  name: 'SignUpRequest',
  version: '1',
  description: 'Validates user sign-up request data',
  schema: SignUpRequestSchema,
});

/**
 * Sign-in request validation
 */
export const SignInRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform((email) => email.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

export type SignInRequest = z.infer<typeof SignInRequestSchema>;

export const SignInRequestContract = createContract({
  name: 'SignInRequest',
  version: '1',
  description: 'Validates user sign-in request data',
  schema: SignInRequestSchema,
});

/**
 * Password reset request validation
 */
export const PasswordResetRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .transform((email) => email.toLowerCase().trim()),
});

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetRequestContract = createContract({
  name: 'PasswordResetRequest',
  version: '1',
  description: 'Validates password reset request data',
  schema: PasswordResetRequestSchema,
});

/**
 * Password reset with token validation
 */
export const PasswordResetTokenSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type PasswordResetToken = z.infer<typeof PasswordResetTokenSchema>;

export const PasswordResetTokenContract = createContract({
  name: 'PasswordResetToken',
  version: '1',
  description: 'Validates password reset with token data',
  schema: PasswordResetTokenSchema,
});

// =============================================================================
// MFA/2FA Contracts
// =============================================================================

/**
 * MFA setup initiation  -  returns TOTP secret and provisioning URI
 */
export const MFASetupResponseSchema = z.object({
  secret: z.string().min(1),
  uri: z.string().min(1),
  backupCodes: z.array(z.string()),
});

export type MFASetupResponse = z.infer<typeof MFASetupResponseSchema>;

/**
 * MFA verification  -  validate a 6-digit TOTP code
 */
export const MFAVerifyRequestSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must be numeric'),
});

export type MFAVerifyRequest = z.infer<typeof MFAVerifyRequestSchema>;

export const MFAVerifyRequestContract = createContract({
  name: 'MFAVerifyRequest',
  version: '1',
  description: 'Validates MFA TOTP verification code',
  schema: MFAVerifyRequestSchema,
});

/**
 * MFA disable  -  requires password or passkey re-authentication
 */
export const MFADisableRequestSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('password'),
    password: z.string().min(1, 'Password is required'),
  }),
  z.object({
    method: z.literal('passkey'),
    authenticationResponse: z.record(z.string(), z.unknown()),
  }),
]);

export type MFADisableRequest = z.infer<typeof MFADisableRequestSchema>;

export const MFADisableRequestContract = createContract({
  name: 'MFADisableRequest',
  version: '2',
  description: 'Validates MFA disable request (requires password or passkey re-auth)',
  schema: MFADisableRequestSchema,
});

/**
 * MFA backup code verification  -  used when TOTP device is unavailable
 */
export const MFABackupCodeRequestSchema = z.object({
  code: z
    .string()
    .min(8, 'Backup code must be at least 8 characters')
    .max(16, 'Backup code must be at most 16 characters'),
});

export type MFABackupCodeRequest = z.infer<typeof MFABackupCodeRequestSchema>;

export const MFABackupCodeRequestContract = createContract({
  name: 'MFABackupCodeRequest',
  version: '1',
  description: 'Validates MFA backup code for account recovery',
  schema: MFABackupCodeRequestSchema,
});

// =============================================================================
// Passkey Contracts
// =============================================================================

/**
 * Passkey registration options request
 * Empty when authenticated (adding to existing account),
 * includes email+name when registering a new passwordless account
 */
export const PasskeyRegisterOptionsRequestSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
});

export type PasskeyRegisterOptionsRequest = z.infer<typeof PasskeyRegisterOptionsRequestSchema>;

/**
 * Passkey registration verification  -  attestation response from browser
 */
export const PasskeyRegisterVerifyRequestSchema = z.object({
  attestationResponse: z.record(z.string(), z.unknown()),
  deviceName: z.string().max(100).optional(),
});

export type PasskeyRegisterVerifyRequest = z.infer<typeof PasskeyRegisterVerifyRequestSchema>;

/**
 * Passkey authentication options  -  no input needed
 */
export const PasskeyAuthenticateOptionsRequestSchema = z.object({});

export type PasskeyAuthenticateOptionsRequest = z.infer<
  typeof PasskeyAuthenticateOptionsRequestSchema
>;

/**
 * Passkey authentication verification  -  assertion response from browser
 */
export const PasskeyAuthenticateVerifyRequestSchema = z.object({
  authenticationResponse: z.record(z.string(), z.unknown()),
});

export type PasskeyAuthenticateVerifyRequest = z.infer<
  typeof PasskeyAuthenticateVerifyRequestSchema
>;

/**
 * Passkey list response
 */
export const PasskeyListResponseSchema = z.object({
  passkeys: z.array(
    z.object({
      id: z.string(),
      deviceName: z.string().nullable(),
      aaguid: z.string().nullable(),
      backedUp: z.boolean(),
      createdAt: z.string(),
      lastUsedAt: z.string().nullable(),
    }),
  ),
});

export type PasskeyListResponse = z.infer<typeof PasskeyListResponseSchema>;

/**
 * Passkey rename request
 */
export const PasskeyUpdateRequestSchema = z.object({
  deviceName: z.string().min(1).max(100),
});

export type PasskeyUpdateRequest = z.infer<typeof PasskeyUpdateRequestSchema>;

// =============================================================================
// Recovery Contracts
// =============================================================================

/**
 * Account recovery request  -  send magic link email
 */
export const RecoveryRequestSchema = z.object({
  email: z.string().email(),
});

export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;

/**
 * Account recovery verification  -  validate magic link token
 */
export const RecoveryVerifyRequestSchema = z.object({
  token: z.string().min(1),
});

export type RecoveryVerifyRequest = z.infer<typeof RecoveryVerifyRequestSchema>;
