/**
 * AI Feature Gate Middleware
 *
 * Provides gate functions for AI-related API routes.
 * - `checkAIFeatureGate()` checks the `ai` feature (Pro tier, $49/mo)
 * - `checkAIMemoryFeatureGate()` checks the `aiMemory` feature (Max tier, $149/mo)
 */

import { isFeatureEnabled } from '@revealui/core/features';
import { NextResponse } from 'next/server';

/**
 * In development mode, all feature gates are open so developers can test
 * AI routes without a license key. Production always enforces licensing.
 */
const isDev = process.env.NODE_ENV === 'development';

/**
 * Returns a 403 NextResponse if AI features are not enabled (no Pro license).
 * Returns null if the request should proceed.
 * Bypassed in development mode.
 */
export function checkAIFeatureGate(): NextResponse | null {
  if (isDev) return null;
  if (!isFeatureEnabled('ai')) {
    return NextResponse.json({ error: 'AI features require a Pro license' }, { status: 403 });
  }
  return null;
}

/**
 * Returns a 403 NextResponse if AI Memory features are not enabled (no Max license).
 * AI Memory routes (episodic, working, context, vector search) require Max ($149/mo),
 * not Pro ($49/mo).
 * Bypassed in development mode.
 */
export function checkAIMemoryFeatureGate(): NextResponse | null {
  if (isDev) return null;
  if (!isFeatureEnabled('aiMemory')) {
    return NextResponse.json(
      { error: 'AI Memory features require a Max license' },
      { status: 403 },
    );
  }
  return null;
}
