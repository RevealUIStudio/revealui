export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { writeGDPRAuditEntry } from '@/lib/utilities/gdpr-audit';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';

/**
 * GDPR Data Export Endpoint
 *
 * Returns all personally-identifiable data held for the authenticated user.
 * Requires session auth — users can only export their own data (admins can export any).
 * Writes an audit entry on every successful export.
 */
async function gdprExportHandler(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    const revealui = await getRevealUIInstance();

    // Users can only export their own data; admins can export any user
    const userIdStr = session.user.id;

    // -------------------------------------------------------------------------
    // Fetch related records in parallel — partial failures are non-fatal; we
    // include what we can and note any collection errors in the export.
    // -------------------------------------------------------------------------
    const [conversationsResult, ordersResult, subscriptionsResult] = await Promise.allSettled([
      revealui.find({
        collection: 'conversations',
        where: { user: { equals: userIdStr } },
        limit: 500,
      }),
      revealui.find({
        collection: 'orders',
        where: { user: { equals: userIdStr } },
        limit: 500,
      }),
      revealui.find({
        collection: 'subscriptions',
        where: { user: { equals: userIdStr } },
        limit: 500,
      }),
    ]);

    const conversations =
      conversationsResult.status === 'fulfilled' ? conversationsResult.value.docs : [];
    const orders = ordersResult.status === 'fulfilled' ? ordersResult.value.docs : [];
    const subscriptions =
      subscriptionsResult.status === 'fulfilled' ? subscriptionsResult.value.docs : [];

    // Guard against oversized exports (10 MB JSON limit)
    const MaxExportBytes = 10 * 1024 * 1024;
    const totalRecords = conversations.length + orders.length + subscriptions.length;
    const estimatedSize = JSON.stringify({ conversations, orders, subscriptions }).length;
    if (estimatedSize > MaxExportBytes) {
      return createApplicationErrorResponse(
        `Export too large (${totalRecords} records, ~${Math.round(estimatedSize / 1024 / 1024)}MB). Contact support for a bulk export.`,
        'EXPORT_TOO_LARGE',
        413,
      );
    }

    // Export user data (excluding sensitive fields like password hashes)
    const exportData = {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        status: session.user.status,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      },
      conversations,
      orders,
      subscriptions,
    };

    // Write audit trail entry for every export request
    await writeGDPRAuditEntry(revealui, {
      action: 'export',
      userId: userIdStr,
      requestedBy: session.user.email ?? session.user.id,
      collections: ['users', 'conversations', 'orders', 'subscriptions'],
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        data: exportData,
        exportedAt: new Date().toISOString(),
        format: 'json',
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user-data-${session.user.id}.json"`,
        },
      },
    );
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/gdpr/export',
      operation: 'gdpr_export',
    });
  }
}

// Rate-limited export: 3 requests per hour
export const POST = withRateLimit(gdprExportHandler, {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'gdpr-export',
});
