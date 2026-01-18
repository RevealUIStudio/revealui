/**
 * Auth Types
 *
 * Type definitions for authentication system.
 */

import type { Session as DbSession, User as DbUser } from '@revealui/db/schema'

export type User = DbUser
export type Session = DbSession

export interface AuthSession {
  session: Session
  user: User
}

export interface SignInResult {
  success: boolean
  user?: User
  sessionToken?: string
  error?: string
}

export interface SignUpResult {
  success: boolean
  user?: User
  sessionToken?: string
  error?: string
}
