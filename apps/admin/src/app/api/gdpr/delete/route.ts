export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { users } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { writeGDPRAuditEntry } from '@/lib/utilities/gdpr-audit';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';

/** Collections that hold data linked to a user  -  deleted in cascade order. */
const CASCADED_COLLECTIONS = ['conversations', 'orders', 'subscriptions', 'events'] as const;

/**
 * Delete all documents in a collection belonging to a user.
 * Fetches page 1 repeatedly until no more matching docs remain  -  deleted records
 * drop out of the result set so the next fetch naturally advances the window.
 */
async function deleteAllUserDocs(
  revealui: Awaited<ReturnType<typeof getRevealUIInstance>>,
  collection: string,
  userId: string,
): Promise<number> {
  let totalDeleted = 0;
  // Batch size: large enough to be efficient, small enough to avoid memory spikes.
  const Batch = 100;
  while (true) {
    const found = await revealui.find({
      collection,
      where: { user: { equals: userId } },
      limit: Batch,
    });
    if (found.docs.length === 0) break;
    await Promise.all(found.docs.map((doc) => revealui.delete({ collection, id: String(doc.id) })));
    totalDeleted += found.docs.length;
  }
  return totalDeleted;
}

/**
 * GDPR Right to Deletion Endpoint
 *
 * Deletes the authenticated user's record **and** all personally-identifiable
 * data held in related collections (cascade delete).
 * Requires session auth  -  users can only delete their own data.
 * Writes an audit entry on completion.
 */
async function gdprDeleteHandler(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    const revealui = await getRevealUIInstance();

    // Users can only delete their own account
    const userIdToDelete = session.user.id;

    // -------------------------------------------------------------------------
    // Cascade delete: remove related records before removing the user row so
    // foreign-key constraints are satisfied and no orphaned PII remains.
    // Paginated: loops until no more matching records exist  -  handles users
    // with more than 100 records in any collection (no 1000-record cap).
    // -------------------------------------------------------------------------
    const cascadeResults = await Promise.allSettled(
      CASCADED_COLLECTIONS.map(async (collection) => {
        const deleted = await deleteAllUserDocs(revealui, collection, userIdToDelete);
        return { collection, deleted };
      }),
    );

    const cascadeSummary = cascadeResults.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            collection: CASCADED_COLLECTIONS[i],
            error: String((r as PromiseRejectedResult).reason),
          },
    );

    // Abort if any cascade failed  -  orphaned PII is worse than a retry
    const failedCascades = cascadeResults.filter((r) => r.status === 'rejected');
    if (failedCascades.length > 0) {
      await writeGDPRAuditEntry(revealui, {
        action: 'delete',
        userId: userIdToDelete,
        requestedBy: session.user.email ?? session.user.id,
        collections: ['users', ...CASCADED_COLLECTIONS],
        timestamp: new Date().toISOString(),
        metadata: { cascadeSummary, aborted: true },
      });

      return NextResponse.json(
        {
          success: false,
          error:
            'Cascade deletion partially failed  -  user record preserved to prevent orphaned data',
          cascadeSummary,
        },
        { status: 500 },
      );
    }

    // Clean up Stripe customer record (GDPR: remove PII from third-party systems)
    //
    // GAP-131: Stripe access goes through the shared `protectedStripe` wrapper
    // from `@revealui/services` (DB-backed circuit breaker, retry, single API
    // version pin). The admin app pulls services via dynamic import (Pro peer
    // dep) so the runtime degrades gracefully if services isn't installed.
    //
    // Failure handling: this remains NON-BLOCKING for the user deletion.
    // GDPR mandates we delete the user record even if a third-party (Stripe)
    // cleanup fails. The error is logged at ERROR with enough context for an
    // operator to manually retry the Stripe-side `customers.del` (or a
    // sweeper cron to pick it up). When the circuit breaker is OPEN the
    // wrapper throws a recognisable "Stripe circuit breaker is OPEN" error;
    // the same log path captures it so the retry surface is uniform.
    let stripeCustomerId: string | null | undefined;
    try {
      const db = getClient();
      const [userRow] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, userIdToDelete));
      stripeCustomerId = userRow?.stripeCustomerId;

      if (stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
        const services = await import('@revealui/services').catch(() => null);
        if (!services) {
          logger.error(
            'Stripe customer cleanup skipped during GDPR delete — @revealui/services not installed',
            {
              userId: userIdToDelete,
              stripeCustomerId,
              action: 'manual-cleanup-required',
            },
          );
        } else {
          await services.protectedStripe.customers.del(stripeCustomerId);
        }
      }
    } catch (stripeErr) {
      // Non-blocking: Stripe cleanup failure should not prevent user deletion.
      // The log includes stripeCustomerId so a sweeper cron / operator can
      // replay the deletion when the breaker closes / Stripe recovers.
      const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      logger.error('Stripe customer cleanup failed during GDPR delete', {
        userId: userIdToDelete,
        stripeCustomerId,
        breakerOpen: message.includes('circuit breaker is OPEN'),
        error: message,
        action: 'manual-cleanup-required',
      });
    }

    // Delete the user record itself (only after all cascades succeeded)
    await revealui.delete({
      collection: 'users',
      id: userIdToDelete,
    });

    // Write immutable audit trail entry
    await writeGDPRAuditEntry(revealui, {
      action: 'delete',
      userId: userIdToDelete,
      requestedBy: session.user.email ?? session.user.id,
      collections: ['users', ...CASCADED_COLLECTIONS],
      timestamp: new Date().toISOString(),
      metadata: { cascadeSummary },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'User data deleted successfully',
        deletedAt: new Date().toISOString(),
        cascadeSummary,
      },
      { status: 200 },
    );
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/gdpr/delete',
      operation: 'gdpr_delete',
    });
  }
}

// Rate-limited deletion: 2 requests per hour (destructive operation)
export const POST = withRateLimit(gdprDeleteHandler, {
  maxAttempts: 2,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'gdpr-delete',
});
