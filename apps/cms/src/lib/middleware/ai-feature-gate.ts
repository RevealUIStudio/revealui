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
 * Returns a 403 NextResponse if AI features are not enabled (no Pro license).
 * Returns null if the request should proceed.
 */
export function checkAIFeatureGate(): NextResponse | null {
  if (!isFeatureEnabled('ai')) {
    return NextResponse.json({ error: 'AI features require a Pro license' }, { status: 403 });
  }
  return null;
}

/**
 * Returns a 403 NextResponse if AI Memory features are not enabled (no Max license).
 * AI Memory routes (episodic, working, context, vector search) require Max ($149/mo),
 * not Pro ($49/mo).
 */
export function checkAIMemoryFeatureGate(): NextResponse | null {
  if (!isFeatureEnabled('aiMemory')) {
    return NextResponse.json(
      { error: 'AI Memory features require a Max license' },
      { status: 403 },
    );
  }
  return null;
}
