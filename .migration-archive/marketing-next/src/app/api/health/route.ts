import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'landing',
    timestamp: new Date().toISOString(),
  });
}
