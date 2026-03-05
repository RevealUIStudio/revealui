export const runtime = 'nodejs'

import { getSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/middleware/rate-limit'
import { writeGDPRAuditEntry } from '@/lib/utilities/gdpr-audit'
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton'
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/** Collections that hold data linked to a user — deleted in cascade order. */
const CASCADED_COLLECTIONS = ['conversations', 'orders', 'subscriptions', 'events'] as const

/**
 * GDPR Right to Deletion Endpoint
 *
 * Deletes the authenticated user's record **and** all personally-identifiable
 * data held in related collections (cascade delete).
 * Requires session auth — users can only delete their own data.
 * Writes an audit entry on completion.
 */
async function gdprDeleteHandler(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession(request.headers)
    if (!session) {
      return createApplicationErrorResponse('Authentication required', 'UNAUTHORIZED', 401)
    }

    const revealui = await getRevealUIInstance()

    // Users can only delete their own account
    const userIdToDelete = session.user.id

    // -------------------------------------------------------------------------
    // Cascade delete: remove related records before removing the user row so
    // foreign-key constraints are satisfied and no orphaned PII remains.
    // -------------------------------------------------------------------------
    const cascadeResults = await Promise.allSettled(
      CASCADED_COLLECTIONS.map((collection) =>
        revealui
          .find({
            collection,
            where: { user: { equals: userIdToDelete } },
            limit: 1000,
          })
          .then(async (found) => {
            await Promise.all(
              found.docs.map((doc) => revealui.delete({ collection, id: String(doc.id) })),
            )
            return { collection, deleted: found.docs.length }
          }),
      ),
    )

    const cascadeSummary = cascadeResults.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            collection: CASCADED_COLLECTIONS[i],
            error: String((r as PromiseRejectedResult).reason),
          },
    )

    // Delete the user record itself
    await revealui.delete({
      collection: 'users',
      id: userIdToDelete,
    })

    // Write immutable audit trail entry
    await writeGDPRAuditEntry(revealui, {
      action: 'delete',
      userId: userIdToDelete,
      requestedBy: session.user.email ?? session.user.id,
      collections: ['users', ...CASCADED_COLLECTIONS],
      timestamp: new Date().toISOString(),
      metadata: { cascadeSummary },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'User data deleted successfully',
        deletedAt: new Date().toISOString(),
        cascadeSummary,
      },
      { status: 200 },
    )
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/gdpr/delete',
      operation: 'gdpr_delete',
    })
  }
}

// Rate-limited deletion: 2 requests per hour (destructive operation)
export const POST = withRateLimit(gdprDeleteHandler, {
  maxAttempts: 2,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'gdpr-delete',
})
