export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getRevealUI } from '@revealui/core'
import { NextResponse } from 'next/server'
// Import the actual CMS config with all collections using alias
import config from '@reveal-config'

/**
 * Readiness probe endpoint
 * Checks if the service is ready to accept traffic
 * Returns 200 if ready, 503 if not ready
 */
export async function GET() {
  try {
    // Check if database is accessible
    const revealui = await getRevealUI({
      config: config,
    })

    await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    })

    return NextResponse.json(
      {
        status: 'ready',
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 },
    )
  }
}
