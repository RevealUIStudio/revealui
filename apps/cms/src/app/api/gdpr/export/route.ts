export const runtime = 'nodejs'

// Import the actual CMS config with all collections using alias
import config from '@reveal-config'
import { getRevealUI } from '@revealui/core'
import { type NextRequest, NextResponse } from 'next/server'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/**
 * GDPR Data Export Endpoint
 * Allows users to export their personal data in JSON format
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

    if (!body || typeof body !== 'object') {
      return createValidationErrorResponse('Request body must be an object', 'body', body)
    }

    const { userId, email } = body as { userId?: string; email?: string }

    if (!(userId || email)) {
      return createValidationErrorResponse('User ID or email is required', 'body', {
        userId: !!userId,
        email: !!email,
      })
    }

    const revealui = await getRevealUI({
      config,
    })

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

    // Export user data (excluding sensitive fields)
    const exportData = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      roles: userData.roles,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      // Add other non-sensitive user data
    }

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
