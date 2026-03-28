/**
 * Auth Types
 *
 * Type definitions for authentication system.
 * Uses concrete interfaces instead of z.infer<> aliases for
 * clear type definitions and better IDE support.
 */

/**
 * User row type matching the users table schema.
 * Structurally compatible with UsersRow from @revealui/contracts/generated.
 */
export interface User {
  id: string;
  schemaVersion: string;
  type: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  password: string | null;
  role: string;
  status: string;
  agentModel: string | null;
  agentCapabilities: string[] | null;
  agentConfig: unknown;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  mfaVerifiedAt: Date | null;
  preferences: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date | null;
  _json?: unknown;
}

/**
 * Session row type matching the sessions table schema.
 * Structurally compatible with SessionsRow from @revealui/contracts/generated.
 */
export interface Session {
  id: string;
  schemaVersion: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  persistent: boolean | null;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface AuthSession {
  session: Session;
  user: User;
}

/** Discriminated union for sign-in outcomes. Check `success` first, then `reason` for failure details. */
export type SignInResult =
  | { success: true; requiresMfa?: false; user: User; sessionToken: string }
  | { success: true; requiresMfa: true; mfaUserId: string }
  | {
      success: false;
      reason:
        | 'invalid_credentials'
        | 'account_locked'
        | 'rate_limited'
        | 'database_error'
        | 'session_error'
        | 'email_not_verified'
        | 'unexpected_error';
      error: string;
    };

export interface SignUpResult {
  success: boolean;
  user?: User;
  sessionToken?: string;
  error?: string;
}
