/**
 * AI Feature Gate — shared guard for CMS API routes that require Pro license.
 *
 * Usage in a Next.js API route handler:
 *   const gate = checkAIFeatureGate();
 *   if (gate) return gate;
 */

import { isFeatureEnabled } from '@revealui/core/features';
import { NextResponse } from 'next/server';

/**
 * Returns a 403 NextResponse if AI features are not enabled (no Pro license).
 * Returns null if the request should proceed.
 */
export function checkAIFeatureGate(): NextResponse | null {
  if (!isFeatureEnabled('ai')) {
    return NextResponse.json({ error: 'AI features require a Pro license' }, { status: 403 });
  }
  return null;
}
