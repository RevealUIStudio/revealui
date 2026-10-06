export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { validateDocument } from '@revealui/core/utils/stored-json-fields';
import { withReadOnlyRepeatableRead } from '@revealui/db/client';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCollectionReadExecutor } from '@/lib/db/collectionReadExecutor';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { writeGDPRAuditEntry } from '@/lib/utils/gdpr-audit';
import { extractRequestContext } from '@/lib/utils/request-context';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';

export const dynamic = 'force-dynamic';

const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 1_000;
const exportPageSchema = z.object({
  docs: z.array(z.unknown()),
  hasNextPage: z.boolean(),
  page: z.number().int().positive(),
  totalDocs: z.number().int().nonnegative(),
});

class ExportTooLargeError extends Error {}

async function readCompleteCollection(
  revealui: Awaited<ReturnType<typeof getRevealUIInstance>>,
  collection: 'conversations' | 'orders' | 'subscriptions',
  where: { userId?: { equals: string }; customerId?: { equals: string } },
  remainingBytes: number,
) {
  const docs: ReturnType<typeof validateDocument>[] = [];
  let serializedDocBytes = 0;
  let expectedTotal: number | undefined;

  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    // RevealUI storage is an external data boundary. Validate page metadata
    // here, then validate every complete document before adding it to export.
    const result = exportPageSchema.parse(
      await revealui.find({ collection, where, limit: EXPORT_PAGE_SIZE, page }),
    );
    if (result.page !== page || result.docs.length > EXPORT_PAGE_SIZE) {
      throw new Error(`Invalid ${collection} export pagination response`);
    }
    if (expectedTotal !== undefined && result.totalDocs !== expectedTotal) {
      throw new Error(`${collection} changed while the export was being read`);
    }
    expectedTotal = result.totalDocs;

    const pageDocs = result.docs.map((doc, index) =>
      validateDocument(doc, `${collection} export page ${page} document ${index + 1}`),
    );
    const pageJson = JSON.stringify(pageDocs);
    const pageContentBytes = Buffer.byteLength(pageJson, 'utf8') - 2;
    const separatorBytes = docs.length > 0 && pageDocs.length > 0 ? 1 : 0;
    serializedDocBytes += pageContentBytes + separatorBytes;
    if (serializedDocBytes + 2 > remainingBytes) {
      throw new ExportTooLargeError(`${collection} exceeds the available export size limit`);
    }
    docs.push(...pageDocs);

    if (!result.hasNextPage) {
      if (docs.length !== expectedTotal) {
        throw new Error(`Incomplete ${collection} export: expected ${expectedTotal} records`);
      }
      return { docs, serializedDocBytes: serializedDocBytes + 2 };
    }
    if (pageDocs.length === 0 || docs.length >= expectedTotal) {
      throw new Error(`Invalid ${collection} export pagination state`);
    }
  }

  throw new ExportTooLargeError(`${collection} exceeds the supported export page limit`);
}

/**
 * GDPR Data Export Endpoint
 *
 * Returns the data held for the authenticated user, without accepting a
 * caller-selected user ID. Writes an audit entry on every successful export.
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

    // Required collections fail the whole export; a partial export could be
    // mistaken for a complete copy of the user's data.
    const { conversations, orders, subscriptions } = await withReadOnlyRepeatableRead(
      async (executor) =>
        withCollectionReadExecutor(executor, async () => {
          const conversationsResult = await readCompleteCollection(
            revealui,
            'conversations',
            { userId: { equals: userIdStr } },
            MAX_EXPORT_BYTES,
          );
          const ordersResult = await readCompleteCollection(
            revealui,
            'orders',
            { customerId: { equals: userIdStr } },
            MAX_EXPORT_BYTES - conversationsResult.serializedDocBytes,
          );
          const subscriptionsResult = await readCompleteCollection(
            revealui,
            'subscriptions',
            { userId: { equals: userIdStr } },
            MAX_EXPORT_BYTES -
              conversationsResult.serializedDocBytes -
              ordersResult.serializedDocBytes,
          );
          return {
            conversations: conversationsResult.docs,
            orders: ordersResult.docs,
            subscriptions: subscriptionsResult.docs,
          };
        }),
    );

    // Guard the complete envelope as well as the accumulated document bytes.
    const totalRecords = conversations.length + orders.length + subscriptions.length;
    const exportBytes = Buffer.byteLength(
      JSON.stringify({ conversations, orders, subscriptions }),
      'utf8',
    );
    if (exportBytes > MAX_EXPORT_BYTES) {
      throw new ExportTooLargeError(
        `Export too large (${totalRecords} records, ~${Math.round(exportBytes / 1024 / 1024)}MB). Contact support for a bulk export.`,
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
    if (error instanceof ExportTooLargeError) {
      return createApplicationErrorResponse(error.message, 'EXPORT_TOO_LARGE', 413);
    }
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
