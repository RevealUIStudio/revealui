/**
 * Billing Subscription API Route
 *
 * GET /api/billing/subscription
 *
 * Returns the current user's subscription/license status.
 * Proxies to the Hono API or queries NeonDB directly.
 */

import { getSession } from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db'
import { licenses } from '@revealui/db/schema'
import { desc, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getClient()
    const [license] = await db
      .select({
        tier: licenses.tier,
        status: licenses.status,
        expiresAt: licenses.expiresAt,
      })
      .from(licenses)
      .where(eq(licenses.userId, session.user.id))
      .orderBy(desc(licenses.createdAt))
      .limit(1)

    if (!license) {
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        expiresAt: null,
      })
    }

    return NextResponse.json({
      tier: license.tier,
      status: license.status,
      expiresAt: license.expiresAt?.toISOString() ?? null,
    })
  } catch (error) {
    logger.error('Error fetching subscription', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
