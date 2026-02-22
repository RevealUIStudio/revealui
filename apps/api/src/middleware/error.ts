import { logger } from '@revealui/core/observability/logger'
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export interface APIErrorResponse {
  success: false
  error: string
  code: string
  details?: unknown
  requestId?: string
}

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') as string | undefined
  const error = err instanceof Error ? err : new Error(String(err))
  logger.error('API Error', error, { requestId })

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false as const,
        error: err.message,
        code: `HTTP_${err.status}`,
        requestId,
      } satisfies APIErrorResponse,
      err.status,
    )
  }

  // Handle validation errors
  if (err.name === 'ZodError') {
    let details: unknown
    try {
      details = JSON.parse(err.message)
    } catch {
      details = err.message
    }
    return c.json(
      {
        success: false as const,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details,
        requestId,
      } satisfies APIErrorResponse,
      400,
    )
  }

  // Handle generic errors — do not leak internal messages
  return c.json(
    {
      success: false as const,
      error: 'An error occurred while processing your request',
      code: 'INTERNAL_ERROR',
      requestId,
    } satisfies APIErrorResponse,
    500,
  )
}
