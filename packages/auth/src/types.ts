/**
 * Auth Types
 *
 * Type definitions for authentication system.
 * Uses concrete interfaces instead of z.infer<> aliases to ensure
 * ESLint type-checked rules can resolve all types.
 */

/**
 * User row type matching the users table schema.
 * Structurally compatible with UsersRow from @revealui/contracts/generated.
 */
export interface User {
  id: string
  schemaVersion: string
  type: string
  name: string
  email: string | null
  avatarUrl: string | null
  password: string | null
  role: string
  status: string
  agentModel: string | null
  agentCapabilities: string[] | null
  agentConfig: unknown
  preferences: unknown
  createdAt: Date
  updatedAt: Date
  lastActiveAt: Date | null
  _json?: unknown
}

/**
 * Session row type matching the sessions table schema.
 * Structurally compatible with SessionsRow from @revealui/contracts/generated.
 */
export interface Session {
  id: string
  schemaVersion: string
  userId: string
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  persistent: boolean | null
  lastActivityAt: Date
  createdAt: Date
  expiresAt: Date
}

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
