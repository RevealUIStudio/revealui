/**
 * Email Verification API Route
 *
 * GET /api/auth/verify-email?token=<token>
 *
 * Verifies a user's email address using the token sent during signup.
 * Redirects to the login page with a success/error message.
 */

import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db'
import { users } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'
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

    // Find user by verification token
    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.emailVerificationToken, token))
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
