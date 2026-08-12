/**
 * AI Feature Gate Middleware
 *
 * Provides gate functions for AI-related API routes.
 * - `checkAIFeatureGate(userId)` checks the `ai` feature (Pro tier, $49/mo)
 * - `checkAIMemoryFeatureGate(userId)` checks the `aiMemory` feature (Max tier, $299/mo)
 *
 * Resolution (GAP-476):
 * 1. Fail closed if no userId
 * 2. Account entitlements via membership + account_entitlements
 * 3. Fallback to process-level isFeatureEnabled (fleet/self-host JWT license)
 * 4. Dev bypass only when REVEALUI_ALLOW_DEV_FEATURE_BYPASS=1 (not NODE_ENV)
 */

import { type FeatureFlags, isFeatureEnabled } from '@revealui/core/features';
import { getClient } from '@revealui/db/client';
import { NextResponse } from 'next/server';
import { accountHasFeature } from '@/lib/access/account-feature';

function allowDevFeatureBypass(): boolean {
  return process.env.REVEALUI_ALLOW_DEV_FEATURE_BYPASS === '1';
}

async function userHasFeature(
  userId: string | null | undefined,
  featureKey: keyof FeatureFlags,
): Promise<boolean> {
  if (!userId) return false;
  if (allowDevFeatureBypass()) return true;

  const db = getClient();
  if (await accountHasFeature(db, userId, featureKey)) return true;

  // Fleet / single-tenant self-host: process license JWT
  return isFeatureEnabled(featureKey);
}

/**
 * Returns a 403 NextResponse if AI features are not enabled for this user.
 * Returns null if the request should proceed.
 * Call only after AuthN with session.user.id.
 */
export async function checkAIFeatureGate(
  userId: string | null | undefined,
): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await userHasFeature(userId, 'ai')) return null;
  return NextResponse.json({ error: 'AI features require a Pro license' }, { status: 403 });
}

/**
 * Returns a 403 NextResponse if AI Memory features are not enabled for this user.
 * AI Memory routes (episodic, working, context, vector search) require Max ($299/mo).
 * Call only after AuthN with session.user.id.
 */
export async function checkAIMemoryFeatureGate(
  userId: string | null | undefined,
): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await userHasFeature(userId, 'aiMemory')) return null;
  return NextResponse.json({ error: 'AI Memory features require a Max license' }, { status: 403 });
}
