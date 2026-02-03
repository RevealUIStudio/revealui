import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('API Error:', err)

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
  return c.json(
    {
      error: err.message || 'Internal server error',
    },
    500,
  )
}
