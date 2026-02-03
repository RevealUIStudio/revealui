/**
 * Auth Types
 *
 * Type definitions for authentication system.
 */

import type { SessionsRow, UsersRow } from '@revealui/contracts/generated'

export type User = UsersRow
export type Session = SessionsRow

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
