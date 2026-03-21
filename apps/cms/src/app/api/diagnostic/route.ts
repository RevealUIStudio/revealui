/**
 * Minimal diagnostic endpoint — no RevealUI imports.
 *
 * If this route returns 200 but other routes return 500, the issue is in
 * the RevealUI module graph (revealui.config.ts, @revealui/core, etc.).
 * If this route ALSO returns 500, the issue is in Next.js infrastructure
 * or middleware.
 *
 * DELETE THIS FILE after diagnosis. Not for production use.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_VARS = [
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'POSTGRES_URL',
  'DATABASE_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
  'RESEND_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'NEXT_PUBLIC_ELECTRIC_SERVICE_URL',
  'CRON_SECRET',
] as const;

export async function GET(): Promise<NextResponse> {
  const envStatus: Record<string, string> = {};
  for (const key of REQUIRED_VARS) {
    const val = process.env[key];
    if (!val) {
      envStatus[key] = 'MISSING';
    } else if (val.length < 5) {
      envStatus[key] = `SET (${val.length} chars — suspiciously short)`;
    } else {
      envStatus[key] = `SET (${val.length} chars)`;
    }
  }

  // Test DB connectivity via Neon HTTP API (no npm import needed)
  let dbTest = 'skipped';
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (pgUrl) {
    try {
      // Extract host from connection string for Neon HTTP endpoint
      const urlMatch = pgUrl.match(/:\/\/[^@]+@([^/]+)/);
      const host = urlMatch?.[1];
      if (host) {
        const httpUrl = `https://${host}/sql`;
        const resp = await fetch(httpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Neon-Connection-String': pgUrl,
          },
          body: JSON.stringify({ query: 'SELECT 1 AS ok' }),
        });
        dbTest = resp.ok ? `connected (HTTP ${resp.status})` : `FAILED (HTTP ${resp.status})`;
      } else {
        dbTest = 'could not parse host from POSTGRES_URL';
      }
    } catch (err) {
      dbTest = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }
  } else {
    dbTest = 'no POSTGRES_URL or DATABASE_URL';
  }

  return NextResponse.json({
    ok: true,
    node: process.version,
    env: process.env.NODE_ENV,
    envStatus,
    dbTest,
    timestamp: new Date().toISOString(),
  });
}
