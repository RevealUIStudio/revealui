/**
 * Email Verification API Route
 *
 * GET /api/auth/verify-email?token=<token>
 *
 * Verifies a user's email address using the token sent during signup.
 * Redirects to the login page with a success/error message.
 */

import { createHash } from 'node:crypto'
import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db'
import { users } from '@revealui/db/schema'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token')
  const baseUrl = request.nextUrl.origin

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_token`)
  }

  try {
    const db = getClient()

    // Hash the incoming raw token to compare against the stored hash.
    // Tokens generated before this fix were stored as UUIDs (plaintext).
    // For backwards compatibility: try the hashed lookup first; if not found,
    // fall back to direct match (legacy plaintext tokens).
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(
        and(
          or(
            eq(users.emailVerificationToken, tokenHash),
            eq(users.emailVerificationToken, token), // legacy plaintext tokens
          ),
          or(
            isNull(users.emailVerificationTokenExpiresAt),
            gt(users.emailVerificationTokenExpiresAt, new Date()),
          ),
        ),
      )
      .limit(1)

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`)
    }

    if (user.emailVerified) {
      return NextResponse.redirect(`${baseUrl}/login?message=already_verified`)
    }

    // Mark email as verified
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return NextResponse.redirect(`${baseUrl}/login?message=email_verified`)
  } catch (error) {
    logger.error('Email verification failed', { error })
    return NextResponse.redirect(`${baseUrl}/login?error=verification_failed`)
  }
}
