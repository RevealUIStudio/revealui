/**
 * Persist GAP-162 USDC-on-Base refund and dispute decisions.
 * Amounts are insert-only. A second refund for the same attempt is ignored.
 */

import { randomUUID } from 'node:crypto';

import type { getClient } from '@revealui/db';
import {
  marketplaceAgents,
  paymentAttempts,
  publisherEarnings,
  revmarketDisputes,
  revmarketRefunds,
  taskSubmissions,
} from '@revealui/db/schema';
import { and, eq, gte, inArray, isNull } from 'drizzle-orm';

import {
  DEFAULT_REFUND_CONFIG,
  initialPaymentAttempt,
  type PlannedRefund,
  planAttemptRefunds,
  planCancelRefunds,
  planDisputeOpen,
  planJoshuaDecision,
  planPublisherReply,
  type RefundPaymentAttempt,
} from './revmarket-refund-policy.js';

type Db = ReturnType<typeof getClient>;

export async function recordInitialAttempt(
  db: Db,
  input: { customerId: string; taskId: string; amountUsdc: string; charged: boolean },
): Promise<void> {
  const attempt = initialPaymentAttempt({ charged: input.charged });
  await db
    .insert(paymentAttempts)
    .values({
      id: randomUUID(),
      customerId: input.customerId,
      taskId: input.taskId,
      amountUsdc: input.amountUsdc,
      asset: attempt.asset,
      status: attempt.status,
      attemptNo: attempt.attemptNo,
    })
    .onConflictDoNothing({ target: [paymentAttempts.taskId, paymentAttempts.attemptNo] });
}

async function loadAttempts(db: Db, taskId: string): Promise<RefundPaymentAttempt[]> {
  const rows = await db
    .select({
      id: paymentAttempts.id,
      attemptNo: paymentAttempts.attemptNo,
      amountUsdc: paymentAttempts.amountUsdc,
      status: paymentAttempts.status,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.taskId, taskId));

  return rows.flatMap((row) => {
    if (row.status !== 'paid' && row.status !== 'not_charged') return [];
    return [
      {
        id: row.id,
        attemptNo: row.attemptNo,
        amountUsdc: row.amountUsdc,
        status: row.status,
      },
    ];
  });
}

async function loadPriorAuto(db: Db, customerId: string) {
  const rows = await db
    .select({
      amountUsdCents: revmarketRefunds.amountUsdCents,
      createdAt: revmarketRefunds.createdAt,
      kind: revmarketRefunds.kind,
    })
    .from(revmarketRefunds)
    .where(eq(revmarketRefunds.customerId, customerId));

  return rows.flatMap((row) => {
    if (row.kind !== 'auto_fail' && row.kind !== 'cancel') return [];
    return [{ amountUsdCents: row.amountUsdCents, createdAt: row.createdAt }];
  });
}

async function insertRefunds(
  db: Db,
  input: { customerId: string; taskId: string; refunds: readonly PlannedRefund[] },
): Promise<void> {
  if (input.refunds.length === 0) return;
  await db
    .insert(revmarketRefunds)
    .values(
      input.refunds.map((refund) => ({
        id: randomUUID(),
        paymentAttemptId: refund.paymentAttemptId,
        customerId: input.customerId,
        taskId: input.taskId,
        reason: refund.reason,
        kind: refund.kind,
        amountUsdc: refund.amountUsdc,
        amountUsdCents: refund.amountUsdCents,
        status: refund.sender === 'joshua' ? 'awaiting_joshua' : 'auto',
      })),
    )
    .onConflictDoNothing({ target: revmarketRefunds.paymentAttemptId });
}

export async function bookTerminalFailureRefunds(
  db: Db,
  input: { taskId: string; customerId: string; now: Date },
): Promise<void> {
  const attempts = await loadAttempts(db, input.taskId);
  const priorAutoRefunds = await loadPriorAuto(db, input.customerId);
  const refunds = planAttemptRefunds({
    attempts,
    priorAutoRefunds,
    now: input.now,
    baseKind: 'auto_fail',
  });
  await insertRefunds(db, { customerId: input.customerId, taskId: input.taskId, refunds });
}

export async function bookCancelRefunds(
  db: Db,
  input: { taskId: string; customerId: string; phase: string; now: Date },
): Promise<void> {
  const attempts = await loadAttempts(db, input.taskId);
  const priorAutoRefunds = await loadPriorAuto(db, input.customerId);
  const plan = planCancelRefunds({
    phase: input.phase,
    attempts,
    priorAutoRefunds,
    now: input.now,
  });
  if (!plan.refundable) return;
  await insertRefunds(db, {
    customerId: input.customerId,
    taskId: input.taskId,
    refunds: plan.refunds,
  });
}

function completedAtOf(meta: { completedAt?: string } | null, fallback: Date): Date {
  if (meta?.completedAt) {
    const parsed = new Date(meta.completedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

export async function openTaskDispute(
  db: Db,
  input: { taskId: string; userId: string; isAdmin: boolean; reason: string; now: Date },
): Promise<
  | { ok: true; disputeId: string; abuseFlag: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string }
> {
  const [task] = await db
    .select({
      id: taskSubmissions.id,
      submitterId: taskSubmissions.submitterId,
      status: taskSubmissions.status,
      executionMeta: taskSubmissions.executionMeta,
      updatedAt: taskSubmissions.updatedAt,
    })
    .from(taskSubmissions)
    .where(eq(taskSubmissions.id, input.taskId))
    .limit(1);

  if (!task) return { ok: false, status: 404, error: 'Task not found' };
  if (task.submitterId !== input.userId && !input.isAdmin) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  const [existing] = await db
    .select({ id: revmarketDisputes.id })
    .from(revmarketDisputes)
    .where(eq(revmarketDisputes.taskId, input.taskId))
    .limit(1);
  if (existing) return { ok: false, status: 409, error: 'Dispute already open' };

  const since = new Date(input.now.getTime() - DEFAULT_REFUND_CONFIG.abuseWindowMs);
  const prior = await db
    .select({ id: revmarketDisputes.id })
    .from(revmarketDisputes)
    .where(
      and(
        eq(revmarketDisputes.customerId, task.submitterId),
        gte(revmarketDisputes.openedAt, since),
      ),
    );

  const plan = planDisputeOpen({
    phase: task.status,
    reason: input.reason,
    completedAt: completedAtOf(task.executionMeta, task.updatedAt),
    now: input.now,
    priorDisputeCount: prior.length,
  });
  if (!plan.ok) return { ok: false, status: 400, error: plan.error };

  const disputeId = randomUUID();
  await db.insert(revmarketDisputes).values({
    id: disputeId,
    taskId: task.id,
    customerId: task.submitterId,
    customerReason: plan.reason,
    joshuaDecision: 'pending',
    abuseFlag: plan.abuseFlag,
    openedAt: input.now,
    windowEndsAt: plan.windowEndsAt,
  });

  await db
    .update(publisherEarnings)
    .set({ status: plan.earningStatus })
    .where(and(eq(publisherEarnings.taskId, task.id), eq(publisherEarnings.status, 'accrued')));

  return { ok: true, disputeId, abuseFlag: plan.abuseFlag };
}

export async function replyToDispute(
  db: Db,
  input: { taskId: string; userId: string; reply: string },
): Promise<{ ok: true } | { ok: false; status: 400 | 403 | 404; error: string }> {
  const [dispute] = await db
    .select({
      id: revmarketDisputes.id,
      publisherReply: revmarketDisputes.publisherReply,
      taskId: revmarketDisputes.taskId,
    })
    .from(revmarketDisputes)
    .where(eq(revmarketDisputes.taskId, input.taskId))
    .limit(1);
  if (!dispute) return { ok: false, status: 404, error: 'Dispute not found' };

  const [task] = await db
    .select({ agentId: taskSubmissions.agentId })
    .from(taskSubmissions)
    .where(eq(taskSubmissions.id, dispute.taskId))
    .limit(1);
  if (!task?.agentId) return { ok: false, status: 403, error: 'Forbidden' };

  const [agent] = await db
    .select({ publisherId: marketplaceAgents.publisherId })
    .from(marketplaceAgents)
    .where(eq(marketplaceAgents.id, task.agentId))
    .limit(1);
  if (agent?.publisherId !== input.userId) return { ok: false, status: 403, error: 'Forbidden' };

  const plan = planPublisherReply({ existingReply: dispute.publisherReply, reply: input.reply });
  if (!plan.ok) return { ok: false, status: 400, error: plan.error };

  const [updated] = await db
    .update(revmarketDisputes)
    .set({ publisherReply: plan.reply })
    .where(and(eq(revmarketDisputes.id, dispute.id), isNull(revmarketDisputes.publisherReply)))
    .returning();
  if (!updated) return { ok: false, status: 400, error: 'publisher already replied' };
  return { ok: true };
}

export async function decideDispute(
  db: Db,
  input: { taskId: string; decision: 'refund' | 'deny'; now: Date },
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 409; error: string }> {
  const [dispute] = await db
    .select({
      id: revmarketDisputes.id,
      customerId: revmarketDisputes.customerId,
      customerReason: revmarketDisputes.customerReason,
      joshuaDecision: revmarketDisputes.joshuaDecision,
      taskId: revmarketDisputes.taskId,
    })
    .from(revmarketDisputes)
    .where(eq(revmarketDisputes.taskId, input.taskId))
    .limit(1);
  if (!dispute) return { ok: false, status: 404, error: 'Dispute not found' };
  if (dispute.joshuaDecision !== 'pending') {
    return { ok: false, status: 409, error: 'Dispute already decided' };
  }

  const [earning] = await db
    .select({ status: publisherEarnings.status })
    .from(publisherEarnings)
    .where(eq(publisherEarnings.taskId, dispute.taskId))
    .limit(1);
  const attempts = await loadAttempts(db, dispute.taskId);
  const plan = planJoshuaDecision({
    decision: input.decision,
    earningStatus: earning?.status ?? null,
    attempts,
    reason: dispute.customerReason,
  });

  const [decided] = await db
    .update(revmarketDisputes)
    .set({ joshuaDecision: plan.decision, decidedAt: input.now })
    .where(
      and(eq(revmarketDisputes.id, dispute.id), eq(revmarketDisputes.joshuaDecision, 'pending')),
    )
    .returning();
  if (!decided) return { ok: false, status: 409, error: 'Dispute already decided' };

  if (plan.decision === 'refund') {
    await insertRefunds(db, {
      customerId: dispute.customerId,
      taskId: dispute.taskId,
      refunds: plan.refunds,
    });
    await db
      .update(publisherEarnings)
      .set({ status: 'dropped' })
      .where(
        and(
          eq(publisherEarnings.taskId, dispute.taskId),
          inArray(publisherEarnings.status, ['accrued', 'held_for_dispute', 'paid']),
        ),
      );
    return { ok: true };
  }

  if (plan.nextEarningStatus === 'accrued') {
    await db
      .update(publisherEarnings)
      .set({ status: 'accrued' })
      .where(
        and(
          eq(publisherEarnings.taskId, dispute.taskId),
          eq(publisherEarnings.status, 'held_for_dispute'),
        ),
      );
  }
  return { ok: true };
}
