export const runtime = 'nodejs'

// Import the actual CMS config with all collections using alias
import config from '@reveal-config'
import { GDPRDeleteRequestContract } from '@revealui/contracts'
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

    // Validate request body using contract
    const validationResult = GDPRDeleteRequestContract.validate(body)

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
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
