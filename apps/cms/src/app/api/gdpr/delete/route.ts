export const runtime = 'nodejs'

import { GDPRDeleteRequestContract } from '@revealui/contracts'
import { type NextRequest, NextResponse } from 'next/server'
import { writeGDPRAuditEntry } from '@/lib/utilities/gdpr-audit'
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/** Collections that hold data linked to a user — deleted in cascade order. */
const CASCADED_COLLECTIONS = ['conversations', 'orders', 'subscriptions', 'events'] as const

/**
 * GDPR Right to Deletion Endpoint
 *
 * Deletes the user record **and** all personally-identifiable data held in
 * related collections (cascade delete). Writes an audit entry on completion.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    // Validate request body using contract
    const validationResult = GDPRDeleteRequestContract.validate(body)

    if (!validationResult.success) {
      const firstIssue = validationResult.errors.issues[0]
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      )
    }

    const { userId, email } = validationResult.data

    const revealui = await getRevealUIInstance()

    // Find user by ID or email
    const user = await revealui.find({
      collection: 'users',
      where: userId ? { id: { equals: userId } } : { email: { equals: email } },
      limit: 1,
    })

    const foundUser = user.docs[0]
    if (!foundUser) {
      return createApplicationErrorResponse('User not found', 'USER_NOT_FOUND', 404, {
        userId,
        email,
      })
    }

    const userIdToDelete = String(foundUser.id)

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
      requestedBy: email ?? userId,
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
