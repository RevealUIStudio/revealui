import { logger } from '@revealui/core/observability/logger'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * ⚠️ CRITICAL WARNING: WAITLIST ENDPOINT DISABLED
 *
 * This endpoint previously used in-memory storage which:
 * 1. Lost all data on serverless cold starts (Vercel/Lambda)
 * 2. Exposed all email addresses via unauthenticated GET (GDPR violation)
 *
 * This endpoint has been disabled until proper database storage is implemented.
 *
 * To re-enable:
 * 1. Add a `waitlist` table to the database schema
 * 2. Implement proper email storage with database persistence
 * 3. Remove or secure the GET endpoint with authentication
 * 4. Consider email notification integration (Resend/ConvertKit)
 *
 * See docs/PRODUCTION_BLOCKERS.md for details.
 */

export async function POST(_request: NextRequest) {
  logger.error('Waitlist endpoint called but is disabled - needs database implementation')
  return NextResponse.json(
    {
      error: 'Waitlist feature is currently unavailable. Please check back later.',
    },
    { status: 503 },
  )
}

/**
 * GET endpoint removed - previously exposed all emails without authentication (GDPR violation)
 */
export function GET() {
  return NextResponse.json(
    {
      error: 'This endpoint has been removed for security reasons.',
    },
    { status: 410 },
  )
}
