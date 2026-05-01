/**
 * Agent task quota middleware (Track B  -  metered billing).
 *
 * For authenticated users:
 *   - Looks up current billing cycle row in agent_task_usage
 *   - Returns 429 if count >= tier quota (or 402 + x402 payment if X402_ENABLED=true)
 *   - Atomically increments count before passing through
 *
 * For unauthenticated requests: passes through (feature gate handles auth separately).
 * For enterprise (Forge) tier: increments for metering but never blocks.
 *
 * x402 payment path (Phase 5.2):
 *   When X402_ENABLED=true and quota is exceeded:
 *   - No X-PAYMENT-PAYLOAD header → HTTP 402 with X-PAYMENT-REQUIRED header
 *   - Valid X-PAYMENT-PAYLOAD header → verify via Coinbase facilitator → allow through
 *   - Invalid X-PAYMENT-PAYLOAD header → HTTP 402 with error detail
 */

import { getMaxAgentTasks } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { trackX402PaymentRequired } from '@revealui/core/observability/metrics';
import { getClient } from '@revealui/db';
import { agentCreditBalance, agentTaskUsage } from '@revealui/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import {
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
  verifyPayment,
} from './x402.js';

/** Tracks consecutive DB write failures for observability. */
let quotaWriteFailures = 0;
const FAILURE_LOG_INTERVAL = 10;

function onQuotaWriteError(err: unknown): void {
  quotaWriteFailures++;
  if (quotaWriteFailures % FAILURE_LOG_INTERVAL === 1) {
    logger.warn('Task quota DB write failed', {
      consecutiveFailures: quotaWriteFailures,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

interface RequestEntitlements {
  limits?: {
    maxAgentTasks?: number;
  };
}

interface TaskQuotaEnv {
  Variables: {
    user: UserContext | undefined;
    entitlements?: RequestEntitlements | undefined;
    aiAccessMode?: 'local' | undefined;
  };
}

/** Returns the UTC timestamp for the start of the current calendar month. */
function cycleStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function requireTaskQuota(
  c: Context<TaskQuotaEnv>,
  next: Next,
  // biome-ignore lint/suspicious/noConfusingVoidType: Hono middleware must return Response | void
): Promise<Response | void> {
  const user = c.get('user');
  if (!user) {
    // No auth  -  feature gate already handles this; just pass through
    return next();
  }

  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const quota = requestEntitlements?.limits?.maxAgentTasks ?? getMaxAgentTasks();
  const db = getClient();
  const cycle = cycleStart();

  if (quota === Infinity) {
    // Enterprise/Forge: increment for metering, never block
    void db
      .insert(agentTaskUsage)
      .values({ userId: user.id, cycleStart: cycle, count: 1, overage: 0 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
      })
      .catch(onQuotaWriteError);
    return next();
  }

  // Fetch current count for this billing cycle
  const [row] = await db
    .select({ count: agentTaskUsage.count })
    .from(agentTaskUsage)
    .where(and(eq(agentTaskUsage.userId, user.id), eq(agentTaskUsage.cycleStart, cycle)))
    .limit(1);

  const current = row?.count ?? 0;

  if (current >= quota) {
    // Check prepaid credit balance before blocking (Track B)
    try {
      const [creditRow] = await db
        .select({ balance: agentCreditBalance.balance })
        .from(agentCreditBalance)
        .where(and(eq(agentCreditBalance.userId, user.id), gt(agentCreditBalance.balance, 0)))
        .limit(1);

      if (creditRow && creditRow.balance > 0) {
        // Decrement one credit  -  awaited because a silent failure means free tasks
        try {
          await db
            .update(agentCreditBalance)
            .set({
              balance: sql`${agentCreditBalance.balance} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(agentCreditBalance.userId, user.id));
        } catch (err) {
          // Credit deduction failed  -  block the request to prevent free usage
          logger.error(
            'Credit deduction failed  -  blocking task',
            err instanceof Error ? err : undefined,
            { userId: user.id },
          );
          return c.json({ error: 'Billing error  -  please retry.' }, 503);
        }

        // Increment usage count for metering (fire-and-forget  -  credit already deducted)
        void db
          .insert(agentTaskUsage)
          .values({ userId: user.id, cycleStart: cycle, count: current + 1, overage: 1 })
          .onConflictDoUpdate({
            target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
            set: {
              count: sql`${agentTaskUsage.count} + 1`,
              overage: sql`${agentTaskUsage.overage} + 1`,
              updatedAt: new Date(),
            },
          })
          .catch(onQuotaWriteError);

        return next();
      }
    } catch {
      // Credit check failed  -  fall through to normal quota enforcement
    }

    // Track overage for billing reports (fire-and-forget)
    void db
      .insert(agentTaskUsage)
      .values({ userId: user.id, cycleStart: cycle, count: current, overage: 1 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { overage: sql`${agentTaskUsage.overage} + 1`, updatedAt: new Date() },
      })
      .catch(onQuotaWriteError);

    const x402 = getX402Config();
    const resetAt = new Date(
      Date.UTC(cycle.getUTCFullYear(), cycle.getUTCMonth() + 1, 1),
    ).toISOString();

    if (x402.enabled && x402.receivingAddress) {
      // x402 payment path  -  agents can pay USDC per task instead of hard-blocking
      const parsedUrl = new URL(c.req.url);
      const resource = `${parsedUrl.origin}${parsedUrl.pathname}`;
      const payloadHeader = c.req.header('X-PAYMENT-PAYLOAD');

      if (payloadHeader) {
        // Verify the payment proof the agent sent
        const result = await verifyPayment(
          payloadHeader,
          resource,
          { userId: user.id, amountUsd: x402.pricePerTask },
          'task-quota',
        );

        if (result.valid) {
          logger.info('x402 payment accepted  -  task quota bypassed', {
            userId: user.id,
            resource,
            used: current,
          });
          // Allow through without incrementing quota (it's a paid overage call)
          return next();
        }

        return c.json(
          {
            payment_required: true,
            error: result.error,
            amount: x402.pricePerTask,
            currency: 'USDC',
          },
          402,
        );
      }

      // No payment header  -  return 402 with x402 payment requirements
      const paymentRequired = buildPaymentRequired(resource);
      trackX402PaymentRequired('task-quota', getAdvertisedCurrencyLabel());
      return c.json(
        {
          payment_required: true,
          amount: x402.pricePerTask,
          currency: 'USDC',
          address: x402.receivingAddress,
          used: current,
          quota,
          resetAt,
        },
        402,
        { 'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired) },
      );
    }

    // x402 disabled → existing 429 behavior (no behavioral change for subscribers)
    return c.json(
      {
        error: 'Agent task quota exceeded for this billing cycle.',
        used: current,
        quota,
        resetAt,
      },
      429,
    );
  }

  // Increment usage count  -  awaited to ensure metering accuracy.
  // On failure, allow the request but log for reconciliation.
  try {
    await db
      .insert(agentTaskUsage)
      .values({ userId: user.id, cycleStart: cycle, count: 1, overage: 0 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
      });
    quotaWriteFailures = 0; // Reset on success
  } catch (err) {
    onQuotaWriteError(err);
    // Allow the request  -  one lost increment is better than blocking paid users.
    // The failure counter + logs enable reconciliation.
  }

  return next();
}
