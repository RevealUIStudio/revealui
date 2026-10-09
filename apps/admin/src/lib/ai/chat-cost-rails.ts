/**
 * Cost rails for admin POST /api/chat.
 *
 * Order: kill switch, COGS breaker, budget reserve, shared monthly task quota.
 * After each model call, write one usage_meters row (llm.chat, cloud cost)
 * and one llm_call_receipts row. Defaults are unchanged: breaker off, budgets off.
 */

import { randomUUID } from 'node:crypto';
import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { isAiDisabled, LLM_CHAT_METER_NAME } from '@revealui/core/ai-runtime-guards';
import { cogsBreakerFlagsFromEnv, decideCogsBreakerTrip } from '@revealui/core/cogs-breaker';
import { getMaxAgentTasks } from '@revealui/core/license';
import {
  accountEntitlements,
  accountMarginDaily,
  type BudgetDecision,
  type BudgetMode,
  currentBudgetsMode,
  llmCallReceipts,
  recordBudgetSpend,
  reserveBudget,
  usageMeters,
} from '@revealui/db';
import { type AdmitAgentTaskResult, admitAgentTask } from '@revealui/db/agent-task-quota';
import type { Database } from '@revealui/db/client';
import { logger } from '@revealui/utils/logger';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { resolveActiveMembership } from '@/lib/access/resolve-membership';
import { buildLlmCallReceipt } from './chat-receipt';

export const ADMIN_CHAT_ROUTE = 'admin.chat';

/** Process env bag. Matches the COGS and budget helpers, which read string flags. */
type RuntimeEnv = Record<string, string | undefined>;

export interface AdminChatAccountContext {
  accountId: string | null;
  tier: string;
  quota: number;
  alreadyTripped: boolean;
  costCents: number;
}

export interface EnforceAdminChatRailsInput {
  userId: string;
  db: Database;
  now?: Date;
  env?: RuntimeEnv;
  loadContext?: (db: Database, userId: string, now: Date) => Promise<AdminChatAccountContext>;
  admit?: (
    db: Database,
    input: { userId: string; quota: number; now?: Date },
  ) => Promise<AdmitAgentTaskResult>;
  reserve?: (input: { accountId: string; mode: BudgetMode; now: Date }) => Promise<BudgetDecision>;
}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function entitlementUsable(
  status: string | null | undefined,
  graceUntil: Date | null | undefined,
  nowMs: number,
): boolean {
  if (status === 'active' || status === 'trialing') return true;
  if (status !== 'past_due' && status !== 'canceled') return false;
  return graceUntil != null && graceUntil.getTime() > nowMs;
}

export async function loadAdminChatAccountContext(
  db: Database,
  userId: string,
  now: Date,
): Promise<AdminChatAccountContext> {
  const fallbackQuota = getMaxAgentTasks();
  const membership = await resolveActiveMembership(db, userId, null);
  if (!membership?.accountId) {
    return {
      accountId: null,
      tier: 'free',
      quota: fallbackQuota,
      alreadyTripped: false,
      costCents: 0,
    };
  }

  const [entitlement] = await db
    .select({
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
      graceUntil: accountEntitlements.graceUntil,
      limits: accountEntitlements.limits,
      cogsBreakerTrippedAt: accountEntitlements.cogsBreakerTrippedAt,
    })
    .from(accountEntitlements)
    .where(
      and(
        eq(accountEntitlements.accountId, membership.accountId),
        eq(accountEntitlements.mode, getConfiguredStripeMode()),
      ),
    )
    .limit(1);

  const [margin] = await db
    .select({ costCents: accountMarginDaily.costCents })
    .from(accountMarginDaily)
    .where(
      and(
        eq(accountMarginDaily.accountId, membership.accountId),
        eq(accountMarginDaily.periodDate, utcDate(now)),
      ),
    )
    .limit(1);

  const usable = entitlement
    ? entitlementUsable(entitlement.status, entitlement.graceUntil, now.getTime())
    : false;
  const tier = usable ? (entitlement?.tier ?? 'free') : 'free';
  const alreadyTripped = tier === 'free' && entitlement?.cogsBreakerTrippedAt != null;
  let quota = fallbackQuota;
  if (usable && entitlement) {
    const stored = entitlement.limits?.maxAgentTasks;
    if (alreadyTripped) quota = 0;
    else if (typeof stored === 'number') quota = stored;
  }

  return {
    accountId: membership.accountId,
    tier,
    quota,
    alreadyTripped,
    costCents: margin?.costCents ?? 0,
  };
}

function disabledResponse(): NextResponse {
  return NextResponse.json(
    { error: 'AI is temporarily disabled.', code: 'AI_DISABLED' },
    { status: 503 },
  );
}

export function adminChatDisabledResponse(env: RuntimeEnv = process.env): NextResponse | null {
  if (!isAiDisabled(env)) return null;
  return disabledResponse();
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'AI usage checks are unavailable. Please try again later.',
      code: 'RAILS_UNAVAILABLE',
    },
    { status: 503 },
  );
}

async function persistCogsTrip(
  db: Database,
  accountId: string,
  reason: string,
  now: Date,
): Promise<void> {
  await db
    .update(accountEntitlements)
    .set({
      cogsBreakerTrippedAt: now,
      cogsBreakerReason: reason,
      limits: { maxSites: 1, maxUsers: 1, maxAgentTasks: 0 },
      updatedAt: now,
    })
    .where(
      and(
        eq(accountEntitlements.accountId, accountId),
        isNull(accountEntitlements.cogsBreakerTrippedAt),
      ),
    );
}

async function defaultReserve(input: {
  accountId: string;
  mode: BudgetMode;
  now: Date;
  db: Database;
}): Promise<BudgetDecision> {
  return reserveBudget(input.db, {
    accountId: input.accountId,
    scopes: [{ scopeType: 'account', scopeId: input.accountId }],
    metric: 'tasks',
    units: 1,
    at: input.now,
    mode: input.mode,
    actorAgentId: 'admin:chat',
  });
}

/**
 * Pre-call rails. Returns a response when the call must not reach a model.
 * Returns the account id when the call may proceed.
 */
export async function enforceAdminChatRails(
  input: EnforceAdminChatRailsInput,
): Promise<NextResponse | { accountId: string | null }> {
  const env = input.env ?? process.env;
  if (isAiDisabled(env)) return disabledResponse();

  const now = input.now ?? new Date();
  const loadContext = input.loadContext ?? loadAdminChatAccountContext;
  let context: AdminChatAccountContext;
  try {
    context = await loadContext(input.db, input.userId, now);
  } catch (error) {
    logger.error(
      'Admin chat cost rails could not load account context',
      error instanceof Error ? error : undefined,
      { userId: input.userId },
    );
    return unavailableResponse();
  }

  const flags = cogsBreakerFlagsFromEnv(env);
  const breaker = decideCogsBreakerTrip({
    tier: context.tier,
    costCents: context.costCents,
    flags,
    alreadyTripped: context.alreadyTripped,
  });
  if (breaker.action === 'trip' || breaker.action === 'already_tripped') {
    if (breaker.action === 'trip' && context.accountId) {
      try {
        await persistCogsTrip(input.db, context.accountId, breaker.reason, now);
      } catch (error) {
        logger.error(
          'Admin chat COGS trip persist failed',
          error instanceof Error ? error : undefined,
          { accountId: context.accountId },
        );
      }
    }
    return NextResponse.json(
      { error: 'AI usage is paused for this account.', code: 'COGS_BREAKER_TRIPPED' },
      { status: 503 },
    );
  }

  const mode = currentBudgetsMode(env);
  if (!context.accountId && mode === 'enforce') {
    return NextResponse.json(
      { error: 'Account budget hard stop.', code: 'BUDGET_HARD_STOP' },
      { status: 429 },
    );
  }
  if (context.accountId && mode !== 'off') {
    try {
      const decision = input.reserve
        ? await input.reserve({ accountId: context.accountId, mode, now })
        : await defaultReserve({ accountId: context.accountId, mode, now, db: input.db });
      if (!decision.allowed) {
        return NextResponse.json(
          { error: 'Account budget hard stop.', code: 'BUDGET_HARD_STOP' },
          { status: 429 },
        );
      }
    } catch (error) {
      logger.error('Admin chat budget reserve failed', error instanceof Error ? error : undefined, {
        accountId: context.accountId,
        mode,
      });
      if (mode === 'enforce') return unavailableResponse();
    }
  }

  const admit = input.admit ?? admitAgentTask;
  let admission: AdmitAgentTaskResult;
  try {
    admission = await admit(input.db, { userId: input.userId, quota: context.quota, now });
  } catch (error) {
    logger.error('Admin chat task quota check failed', error instanceof Error ? error : undefined, {
      userId: input.userId,
    });
    return unavailableResponse();
  }
  if (!admission.admitted) {
    if (admission.reason === 'billing_error') {
      return NextResponse.json(
        { error: 'Billing error. Please retry.', code: 'BILLING_ERROR' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: 'Agent task quota exceeded for this billing cycle.',
        code: 'TASK_QUOTA_EXCEEDED',
        used: admission.used,
        quota: admission.quota,
        resetAt: admission.resetAt,
      },
      { status: 429 },
    );
  }

  return { accountId: context.accountId };
}

export async function estimateLlmCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): Promise<number> {
  const mod = await import('@revealui/ai/llm/cost').catch(() => null);
  if (!mod) return 0;
  const inputUsd = mod.estimateCost(promptTokens, model, 'input').estimatedCostUsd;
  const outputUsd = mod.estimateCost(completionTokens, model, 'output').estimatedCostUsd;
  const micros = Math.round((inputUsd + outputUsd) * 1_000_000);
  if (!Number.isSafeInteger(micros) || micros < 0) return 0;
  return micros;
}

export interface RecordAdminChatCallInput {
  db: Database;
  userId: string;
  accountId: string | null;
  provider: string;
  model: string;
  keySource: 'byok' | 'site' | 'env';
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  errored: boolean;
  now?: Date;
  env?: RuntimeEnv;
  estimateMicros?: (
    model: string,
    promptTokens: number,
    completionTokens: number,
  ) => Promise<number>;
}

/** Persist the meter and receipt for one model invocation. Failures are logged. */
export async function recordAdminChatCall(input: RecordAdminChatCallInput): Promise<void> {
  const now = input.now ?? new Date();
  const env = input.env ?? process.env;
  const estimate = input.estimateMicros ?? estimateLlmCostMicros;
  let estimatedCostMicros = 0;
  try {
    estimatedCostMicros = await estimate(input.model, input.promptTokens, input.completionTokens);
  } catch (error) {
    logger.warn('Admin chat cost estimate failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const id = randomUUID();
  const receipt = buildLlmCallReceipt({
    id,
    userId: input.userId,
    accountId: input.accountId,
    route: ADMIN_CHAT_ROUTE,
    provider: input.provider,
    model: input.model,
    keySource: input.keySource,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    estimatedCostMicros,
    createdAt: now,
  });

  try {
    await input.db.insert(llmCallReceipts).values(receipt);
  } catch (error) {
    logger.error('Admin chat receipt write failed', error instanceof Error ? error : undefined, {
      userId: input.userId,
    });
  }

  if (input.accountId) {
    try {
      await input.db.insert(usageMeters).values({
        id: randomUUID(),
        accountId: input.accountId,
        meterName: LLM_CHAT_METER_NAME,
        quantity: 1,
        periodStart: now,
        source: 'user',
        idempotencyKey: id,
        durationMs: input.durationMs,
        errored: input.errored,
      });
    } catch (error) {
      logger.error(
        'Admin chat usage meter write failed',
        error instanceof Error ? error : undefined,
        { accountId: input.accountId },
      );
    }

    const mode = currentBudgetsMode(env);
    if (mode !== 'off' && estimatedCostMicros > 0) {
      try {
        await recordBudgetSpend(input.db, {
          accountId: input.accountId,
          scopes: [{ scopeType: 'account', scopeId: input.accountId }],
          metric: 'cost_micros',
          units: estimatedCostMicros,
          at: now,
          mode,
          actorAgentId: 'admin:chat',
        });
      } catch (error) {
        logger.error(
          'Admin chat budget cost record failed',
          error instanceof Error ? error : undefined,
          { accountId: input.accountId },
        );
      }
    }
  }
}
