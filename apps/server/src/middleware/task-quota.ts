/**
 * Agent task quota middleware (Track B  -  metered billing).
 *
 * For authenticated users:
 *   - Reserves one plan-quota slot with a single conditional upsert
 *   - Returns 429 if that slot is already taken (or 402 + x402 payment if X402_ENABLED=true)
 *   - Prepaid credits are spent only after the plan slot is refused
 *
 * For unauthenticated requests: passes through (feature gate handles auth separately).
 * For enterprise (Forge) tier: increments for metering but never blocks.
 *
 * The reservation itself lives in `@revealui/db/agent-task-quota` so admin chat
 * counts against the same monthly row.
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
import { admitAgentTask } from '@revealui/db/agent-task-quota';
import type { Context, Next } from 'hono';
import {
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
  verifyPayment,
} from './x402.js';

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

export async function requireTaskQuota<E extends TaskQuotaEnv>(
  c: Context<E>,
  next: Next,
  // biome-ignore lint/suspicious/noConfusingVoidType: Hono middleware must return Response | void
): Promise<Response | void> {
  const user = c.get('user');
  if (!user) {
    // No auth. Feature gate already handles this; just pass through.
    return next();
  }

  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const quota = requestEntitlements?.limits?.maxAgentTasks ?? getMaxAgentTasks();
  const db = getClient();
  const admission = await admitAgentTask(db, { userId: user.id, quota });

  if (admission.admitted) {
    return next();
  }
  if (admission.reason === 'billing_error') {
    return c.json({ error: 'Billing error  -  please retry.' }, 503);
  }

  const current = admission.used;
  const x402 = getX402Config();
  const resetAt = admission.resetAt;

  if (x402.enabled && x402.receivingAddress) {
    const parsedUrl = new URL(c.req.url);
    const resource = `${parsedUrl.origin}${parsedUrl.pathname}`;
    const payloadHeader = c.req.header('X-PAYMENT-PAYLOAD');

    if (payloadHeader) {
      const result = await verifyPayment(payloadHeader, resource, 'task-quota');

      if (result.valid) {
        logger.info('x402 payment accepted  -  task quota bypassed', {
          userId: user.id,
          resource,
          used: current,
        });
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

    const paymentRequired = buildPaymentRequired(resource);
    trackX402PaymentRequired('task-quota', getAdvertisedCurrencyLabel());
    return c.json(
      {
        payment_required: true,
        amount: x402.pricePerTask,
        currency: 'USDC',
        address: x402.receivingAddress,
        used: current,
        quota: admission.quota,
        resetAt,
      },
      402,
      { 'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired) },
    );
  }

  return c.json(
    {
      error: 'Agent task quota exceeded for this billing cycle.',
      used: current,
      quota: admission.quota,
      resetAt,
    },
    429,
  );
}
