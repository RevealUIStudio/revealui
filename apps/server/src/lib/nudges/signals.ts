/**
 * Nudge signal fetcher — the DB-touching half of trigger evaluation
 * (GAP-300 §7). Kept separate from ./triggers.ts so the tier + milestone
 * gating logic stays unit-testable without a database.
 *
 * Signal sources, all existing tables extended rather than duplicated:
 *   - conversations/messages  -  free-tier local chat (aiLocal surface)
 *   - pages/products          -  content existence, scoped via site ownership
 *   - account_entitlements    -  tier resolution (mirrors account-entitlement.ts)
 *   - usage_meters            -  governed agent actions (source='agent')
 *   - workspace_inference_configs  -  per-site inference config
 *   - sites                   -  tenant count for the Enterprise nudge
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import type { LicenseTier } from '@revealui/core/license';
import type { DatabaseClient } from '@revealui/db/client';
import {
  accountEntitlements,
  accountMemberships,
  conversations,
  messages,
  pages,
  products,
  sites,
  usageMeters,
  users,
  workspaceInferenceConfigs,
} from '@revealui/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import type { NudgeSignals } from './triggers.js';

function isHealthyStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing';
}

export interface NudgeContext {
  tier: LicenseTier;
  signals: NudgeSignals;
}

/**
 * Resolves the account entitlement tier for a user, mirroring the
 * grace-expiry fail-safe in `../account-entitlement.ts`. Fails closed to
 * 'free' whenever there is no active membership, no entitlement row, or a
 * grace-expired subscription — the same rule the AI-feature gate uses.
 */
async function resolveAccountAndTier(
  db: DatabaseClient,
  userId: string,
): Promise<{ accountId: string | null; tier: LicenseTier }> {
  const [membership] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .limit(1);

  if (!membership?.accountId) return { accountId: null, tier: 'free' };

  const [entitlement] = await db
    .select({
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
      graceUntil: accountEntitlements.graceUntil,
    })
    .from(accountEntitlements)
    .where(
      and(
        eq(accountEntitlements.accountId, membership.accountId),
        eq(accountEntitlements.mode, getConfiguredStripeMode()),
      ),
    )
    .limit(1);

  if (!entitlement) return { accountId: membership.accountId, tier: 'free' };

  const status = entitlement.status ?? null;
  const graceUntil = entitlement.graceUntil ?? null;
  const graceActive = graceUntil != null && graceUntil.getTime() > Date.now();
  const graceExpired = status !== null && !isHealthyStatus(status) && !graceActive;
  if (graceExpired) return { accountId: membership.accountId, tier: 'free' };

  const tier = (entitlement.tier as LicenseTier | undefined) ?? 'free';
  return { accountId: membership.accountId, tier };
}

async function hasAssistantReply(db: DatabaseClient, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), eq(messages.role, 'assistant')))
    .limit(1);
  return !!row;
}

async function countUserChatMessages(db: DatabaseClient, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), eq(messages.role, 'user')));
  return Number(row?.total ?? 0);
}

async function hasPageOrProduct(db: DatabaseClient, userId: string): Promise<boolean> {
  const [pageRow] = await db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.ownerId, userId), isNull(pages.deletedAt), isNull(sites.deletedAt)))
    .limit(1);
  if (pageRow) return true;

  const [productRow] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.ownerId, userId), isNull(products.deletedAt)))
    .limit(1);
  return !!productRow;
}

async function hasAgentAction(db: DatabaseClient, accountId: string | null): Promise<boolean> {
  if (!accountId) return false;
  const [row] = await db
    .select({ id: usageMeters.id })
    .from(usageMeters)
    .where(and(eq(usageMeters.accountId, accountId), eq(usageMeters.source, 'agent')))
    .limit(1);
  return !!row;
}

async function hasInferenceConfig(db: DatabaseClient, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceInferenceConfigs.id })
    .from(workspaceInferenceConfigs)
    .innerJoin(sites, eq(workspaceInferenceConfigs.workspaceId, sites.id))
    .where(and(eq(sites.ownerId, userId), isNull(sites.deletedAt)))
    .limit(1);
  return !!row;
}

async function accountAgeMs(db: DatabaseClient, userId: string): Promise<number> {
  const [row] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return 0;
  return Date.now() - row.createdAt.getTime();
}

async function countSites(db: DatabaseClient, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(sites)
    .where(and(eq(sites.ownerId, userId), isNull(sites.deletedAt)));
  return Number(row?.total ?? 0);
}

/** Resolves the authenticated user's tier and the signals `buildCandidates` needs. */
export async function fetchNudgeContext(db: DatabaseClient, userId: string): Promise<NudgeContext> {
  const { accountId, tier } = await resolveAccountAndTier(db, userId);

  const [
    assistantReply,
    userChatMessageCount,
    pageOrProduct,
    agentAction,
    inferenceConfig,
    ageMs,
    siteCount,
  ] = await Promise.all([
    hasAssistantReply(db, userId),
    countUserChatMessages(db, userId),
    hasPageOrProduct(db, userId),
    hasAgentAction(db, accountId),
    hasInferenceConfig(db, userId),
    accountAgeMs(db, userId),
    countSites(db, userId),
  ]);

  return {
    tier,
    signals: {
      hasAssistantReply: assistantReply,
      userChatMessageCount,
      hasPageOrProduct: pageOrProduct,
      hasAgentAction: agentAction,
      hasInferenceConfig: inferenceConfig,
      accountAgeMs: ageMs,
      siteCount,
    },
  };
}
