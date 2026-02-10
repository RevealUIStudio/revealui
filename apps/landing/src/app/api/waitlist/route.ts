/**
 * Waitlist API Endpoint
 *
 * Stores email addresses for product waitlist with proper database persistence.
 *
 * PRODUCTION BLOCKER #3 - FIXED:
 * - Previously used in-memory storage (lost on cold starts)
 * - Now uses database with proper persistence
 * - Includes rate limiting by IP (5 requests per hour)
 * - Email validation and duplicate detection
 * - No GET endpoint (was GDPR violation)
 */

import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db/client'
import { waitlist } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Simple in-memory rate limiting (resets on cold start, which is fine for basic protection)
// For production, consider using a database-backed rate limiter or Vercel Edge Config
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT_MAX = 5 // requests
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  // Clean up old entries (prevent memory leak)
  if (rateLimitMap.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < cutoff) {
        rateLimitMap.delete(key)
      }
    }
  }

  if (!record || record.resetAt < now) {
    // No record or expired - create new
    const resetAt = now + RATE_LIMIT_WINDOW
    rateLimitMap.set(ip, { count: 1, resetAt })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt }
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  // Increment count
  record.count++
  rateLimitMap.set(ip, record)
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetAt: record.resetAt }
}

const WaitlistSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  source: z.string().max(100).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Get IP address for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Rate limiting
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 1000 / 60)
      return NextResponse.json(
        {
          error: `Too many requests. Please try again in ${resetInMinutes} minutes.`,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetAt),
          },
        },
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = WaitlistSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.issues,
        },
        { status: 400 },
      )
    }

    const { email, source } = validation.data

    // Get database client
    const db = getClient()

    // Check if email already exists
    const existing = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1)

    if (existing.length > 0) {
      // Email already on waitlist - return success (don't leak information)
      logger.info('Duplicate waitlist signup attempt', { email: `${email.substring(0, 3)}***` })
      return NextResponse.json(
        {
          success: true,
          message: 'Thank you for your interest! We will notify you when we launch.',
        },
        {
          status: 200,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        },
      )
    }

    // Insert new waitlist entry
    await db.insert(waitlist).values({
      email,
      source: source || 'landing-page',
      referrer: request.headers.get('referer') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: ip !== 'unknown' ? ip : undefined,
    })

    logger.info('New waitlist signup', {
      email: `${email.substring(0, 3)}***`,
      source: source || 'landing-page',
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for joining our waitlist! We will notify you when we launch.',
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      },
    )
  } catch (error) {
    logger.error('Waitlist signup error', error instanceof Error ? error : new Error(String(error)))

    // Don't expose internal error details to user
    return NextResponse.json(
      {
        error: 'An error occurred while processing your request. Please try again later.',
      },
      { status: 500 },
    )
  }
}

/**
 * GET endpoint removed for security
 *
 * Previously exposed all email addresses without authentication (GDPR violation).
 * For admin access to waitlist data, use a separate authenticated endpoint.
 */
export function GET() {
  return NextResponse.json(
    {
      error:
        'This endpoint is not available. For admin access, please use the authenticated admin panel.',
    },
    { status: 410 }, // 410 Gone
  )
}
