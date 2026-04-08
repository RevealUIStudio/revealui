/**
 * ElectricSQL Shape Proxy Utilities
 *
 * Server-side utilities for proxying ElectricSQL shape requests with authentication
 * and row-level filtering. This enables secure, authenticated sync for TanStack DB.
 */

import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client';
import { logger } from '@revealui/utils/logger';
import { NextResponse } from 'next/server';

/**
 * Gets the ElectricSQL service URL from environment variables.
 */
function getElectricUrl(): string {
  const url = process.env.ELECTRIC_SERVICE_URL || process.env.ELECTRIC_URL;
  if (!url) {
    throw new Error('ELECTRIC_SERVICE_URL is not set');
  }
  return url;
}

/**
 * Prepares the ElectricSQL proxy URL from a request URL.
 * Copies over Electric-specific query params and adds auth if configured.
 *
 * @param requestUrl - The incoming request URL
 * @returns The prepared ElectricSQL origin URL
 */
export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl);
  const electricUrl = getElectricUrl();
  const originUrl = new URL(`${electricUrl}/v1/shape`);

  // Copy Electric-specific query params
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value);
    }
  });

  // Add Electric authentication if configured
  if (process.env.ELECTRIC_SECRET) {
    originUrl.searchParams.set('secret', process.env.ELECTRIC_SECRET);
  }
  // Add Electric Cloud source ID if configured (Cloud-only, not needed for self-hosted)
  if (process.env.ELECTRIC_SOURCE_ID) {
    originUrl.searchParams.set('source_id', process.env.ELECTRIC_SOURCE_ID);
  }

  return originUrl;
}

/**
 * Proxies a request to ElectricSQL and returns the response.
 *
 * @param originUrl - The prepared ElectricSQL URL
 * @returns The proxied NextResponse
 */
export async function proxyElectricRequest(originUrl: URL): Promise<NextResponse> {
  try {
    const response = await fetch(originUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('vary', 'cookie');

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      logger.error('ElectricSQL proxy timeout', { url: originUrl.pathname });
      return NextResponse.json({ error: 'Electric service timeout' }, { status: 504 });
    }
    throw error;
  }
}
