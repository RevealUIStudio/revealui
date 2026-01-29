import config from '@revealui/config'
import { getRevealUI } from '@revealui/core'
import { type NextRequest, NextResponse } from 'next/server'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/**
 * GDPR Right to Deletion Endpoint
 * Allows users to request deletion of their personal data
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

    const { userId, email, confirmation } = body as {
      userId?: string
      email?: string
      confirmation?: string
    }

    if (!(userId || email)) {
      return createValidationErrorResponse('User ID or email is required', 'body', {
        userId: !!userId,
        email: !!email,
      })
    }

    if (confirmation !== 'DELETE') {
      return createValidationErrorResponse(
        "Please confirm deletion by sending 'DELETE' in the confirmation field",
        'confirmation',
        confirmation,
        {
          expected: 'DELETE',
        },
      )
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

    const foundUser = user.docs[0]
    if (!foundUser) {
      return createApplicationErrorResponse('User not found', 'USER_NOT_FOUND', 404, {
        userId,
        email,
      })
    }

    const userIdToDelete = foundUser.id

    // Delete user data
    await revealui.delete({
      collection: 'users',
      id: userIdToDelete,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'User data deleted successfully',
        deletedAt: new Date().toISOString(),
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
