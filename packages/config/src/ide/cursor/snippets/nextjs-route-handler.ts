/**
 * Next.js 16 Route Handler Template
 *
 * Usage: Create API routes in apps/cms/src/app/api/
 */

import { type NextRequest, NextResponse } from 'next/server'

// Required for dynamic routes
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    // Handler logic here
    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const _body = await req.json()
    // Handler logic here
    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
