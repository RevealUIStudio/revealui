import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'dashboard',
    timestamp: new Date().toISOString(),
  })
}
