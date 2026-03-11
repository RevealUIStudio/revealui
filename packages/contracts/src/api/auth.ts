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
    .transform((name) =>
      name
        .replace(/<[^>]*>/g, '')
        .trim()
        .replace(/\s+/g, ' '),
    ),
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
