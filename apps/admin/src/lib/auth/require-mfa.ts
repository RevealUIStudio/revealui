/**
 * Next.js helper: session + MFA enforcement (fleet-redundancy C11).
 */

import { checkSessionMfa, getSession, type MfaEnforcementOptions } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

export type MfaGateResult =
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: NextResponse };

/**
 * Require an authenticated session and MFA for admin/owner (or listed ops).
 */
export async function requireSessionWithMfa(
  request: NextRequest,
  options?: MfaEnforcementOptions & { operation?: string },
): Promise<MfaGateResult> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const mfa = checkSessionMfa(session, options);
  if (!mfa.allowed) {
    return {
      ok: false,
      response: NextResponse.json(mfa.body ?? { error: 'MFA required' }, {
        status: mfa.status ?? 403,
      }),
    };
  }

  return { ok: true, session };
}
