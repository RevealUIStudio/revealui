import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ElectricHealthOk {
  ok: true;
  latencyMs: number;
  electricVersion?: string;
}

interface ElectricHealthFail {
  ok: false;
  error: string;
  latencyMs?: number;
}

function getElectricServiceUrl(): string {
  const url = process.env.ELECTRIC_SERVICE_URL || process.env.ELECTRIC_URL;
  if (!url) {
    throw new Error('ELECTRIC_SERVICE_URL is not set');
  }
  return url;
}

export async function GET(): Promise<NextResponse<ElectricHealthOk | ElectricHealthFail>> {
  const start = Date.now();

  let electricUrl: string;
  try {
    electricUrl = getElectricServiceUrl();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Electric service URL not configured' },
      { status: 503 },
    );
  }

  const healthUrl = `${electricUrl}/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5_000),
      headers: process.env.ELECTRIC_SECRET
        ? { Authorization: `Bearer ${process.env.ELECTRIC_SECRET}` }
        : {},
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Electric health check returned HTTP ${response.status}`, latencyMs },
        { status: 503 },
      );
    }

    let electricVersion: string | undefined;
    try {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body.version === 'string') {
        electricVersion = body.version;
      }
    } catch {
      // JSON parse failure is non-fatal — Electric responded 200, that's what matters
    }

    return NextResponse.json({ ok: true, latencyMs, electricVersion }, { status: 200 });
  } catch (error) {
    const latencyMs = Date.now() - start;
    const isDomTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isDomTimeout || isAbort) {
      return NextResponse.json(
        { ok: false, error: 'Electric health check timed out (5s)', latencyMs },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'Electric health check failed', latencyMs },
      { status: 503 },
    );
  }
}
