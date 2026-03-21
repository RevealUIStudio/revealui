/**
 * Recovery Session Guard
 *
 * Recovery sessions (created via magic link) are restricted to password-change
 * and sign-out operations only. This guard rejects recovery sessions from
 * accessing sensitive account management endpoints (MFA, passkeys, OAuth linking).
 */

import type { SessionData } from '@revealui/auth/server';
import { isRecoverySession } from '@revealui/auth/server';
import { NextResponse } from 'next/server';

/**
 * Returns a 403 response if the session is a recovery session, or null if the
 * session has full access. Use at the top of route handlers that should be
 * blocked during recovery.
 *
 * @example
 * ```ts
 * const blocked = rejectRecoverySession(session);
 * if (blocked) return blocked;
 * ```
 */
export function rejectRecoverySession(session: SessionData | null): NextResponse | null {
  if (isRecoverySession(session)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Recovery sessions can only be used to change your password. Please sign in fully to access this feature.',
        code: 'RECOVERY_SESSION_RESTRICTED',
      },
      { status: 403 },
    );
  }
  return null;
}
