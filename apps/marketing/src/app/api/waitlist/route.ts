/**
 * Waitlist API Endpoint
 *
 * Stores email addresses for product waitlist with proper database persistence.
 * Rate limiting is DB-backed: counts signups from the same IP in the last hour,
 * so limits survive cold starts and Vercel function restarts.
 */

import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db/client'
import { waitlist } from '@revealui/db/schema'
import { and, count, eq, gte } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RATE_LIMIT_MAX = 5 // signups per IP per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Count waitlist rows from this IP in the rolling window.
 * Piggybacks on the DB connection already used by the route — no extra round-trip.
 */
async function checkRateLimit(
  ip: string,
  db: ReturnType<typeof getClient>,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const resetAt = windowStart.getTime() + RATE_LIMIT_WINDOW_MS

  const [row] = await db
    .select({ total: count() })
    .from(waitlist)
    .where(and(eq(waitlist.ipAddress, ip), gte(waitlist.createdAt, windowStart)))

  const total = row?.total ?? 0
  const remaining = Math.max(0, RATE_LIMIT_MAX - total)
  return { allowed: total < RATE_LIMIT_MAX, remaining, resetAt }
}

async function notifyFounder(email: string, source: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'RevealUI Waitlist <noreply@revealui.com>',
      to: 'founder@revealui.com',
      subject: `New waitlist signup: ${email}`,
      text: `New waitlist signup\n\nEmail: ${email}\nSource: ${source}\nTime: ${new Date().toISOString()}`,
    }),
  })
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

    // Parse and validate request body before hitting the DB
    const body: unknown = await request.json()
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

    // Get database client (shared for rate limit check + insert)
    const db = getClient()

    // DB-backed rate limit (survives cold starts)
    const rateLimit =
      ip !== 'unknown'
        ? await checkRateLimit(ip, db)
        : { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: 0 }
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

    // Notify founder — fire-and-forget, never blocks the response
    notifyFounder(email, source || 'landing-page').catch(() => {})

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
