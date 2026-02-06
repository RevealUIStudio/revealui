import { logger } from '@revealui/core/observability/logger'
import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const errorHandler: ErrorHandler = (err, c) => {
  logger.error('API Error:', err instanceof Error ? err : new Error(String(err)))

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
      },
      err.status,
    )
  }

  // Handle validation errors
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: 'Validation failed',
        details: err.message,
      },
      400,
    )
  }

  // Handle generic errors
  // Do not leak internal error messages to clients - use generic message instead
  return c.json(
    {
      error: 'An error occurred while processing your request',
    },
    500,
  )
}
