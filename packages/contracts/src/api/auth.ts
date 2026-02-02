/**
 * Authentication API Contracts
 *
 * Validation contracts for authentication endpoints
 */

import { z } from 'zod/v4'
import { createContract } from '../foundation/contract.js'

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
    .transform((name) => name.trim().replace(/\s+/g, ' ')),
})

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>

export const SignUpRequestContract = createContract({
  name: 'SignUpRequest',
  version: '1',
  description: 'Validates user sign-up request data',
  schema: SignUpRequestSchema,
})

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
})

export type SignInRequest = z.infer<typeof SignInRequestSchema>

export const SignInRequestContract = createContract({
  name: 'SignInRequest',
  version: '1',
  description: 'Validates user sign-in request data',
  schema: SignInRequestSchema,
})
