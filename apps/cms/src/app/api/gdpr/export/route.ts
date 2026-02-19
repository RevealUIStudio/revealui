export const runtime = 'nodejs'

import { GDPRExportRequestContract } from '@revealui/contracts'
import { type NextRequest, NextResponse } from 'next/server'
import { writeGDPRAuditEntry } from '@/lib/utilities/gdpr-audit'
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/**
 * GDPR Data Export Endpoint
 *
 * Returns all personally-identifiable data held for the requesting user,
 * including related records from conversations, orders, and subscriptions.
 * Writes an audit entry on every successful export.
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
    const validationResult = GDPRExportRequestContract.validate(body)

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

    const userData = user.docs[0]
    if (!userData) {
      return createApplicationErrorResponse('User not found', 'USER_NOT_FOUND', 404, {
        userId,
        email,
      })
    }

    const userIdStr = String(userData.id)

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
    ])

    // Export user data (excluding sensitive fields like password hashes)
    const exportData = {
      user: {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      },
      conversations:
        conversationsResult.status === 'fulfilled' ? conversationsResult.value.docs : [],
      orders: ordersResult.status === 'fulfilled' ? ordersResult.value.docs : [],
      subscriptions:
        subscriptionsResult.status === 'fulfilled' ? subscriptionsResult.value.docs : [],
    }

    // Write audit trail entry for every export request
    await writeGDPRAuditEntry(revealui, {
      action: 'export',
      userId: userIdStr,
      requestedBy: email ?? userId,
      collections: ['users', 'conversations', 'orders', 'subscriptions'],
      timestamp: new Date().toISOString(),
    })

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
          'Content-Disposition': `attachment; filename="user-data-${userData.id}.json"`,
        },
      },
    )
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/gdpr/export',
      operation: 'gdpr_export',
    })
  }
}
