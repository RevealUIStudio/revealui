// TODO: stop using universal-middleware and directly integrate server middlewares instead. (Bati generates boilerplates that use universal-middleware https://github.com/magne4000/universal-middleware to make Bati's internal logic easier. This is temporary and will be removed soon.)
import type { Get, UniversalHandler } from '@universal-middleware/core'
import { z } from 'zod/v4'
import type { dbSqlite } from '../database/drizzle/db.js'
import * as drizzleQueries from '../database/drizzle/queries/todos.js'
import { createErrorResponse, createValidationErrorResponse } from './error-response.js'

// Validation schema for todo input
const todoInputSchema = z.object({
  text: z
    .string()
    .min(1, 'Todo text is required')
    .max(1000, 'Todo text must be less than 1000 characters')
    .trim(),
})

export const createTodoHandler: Get<
  [],
  UniversalHandler<Universal.Context & { db: ReturnType<typeof dbSqlite> }>
> = () => async (request, _context) => {
    try {
      // Parse and validate user input
      let rawData: unknown
      try {
        rawData = await request.json()
      } catch (jsonError) {
        return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
          parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
        })
      }

      const validationResult = todoInputSchema.safeParse(rawData)

      if (!validationResult.success) {
        return createValidationErrorResponse('Invalid input', 'body', rawData, {
          validationErrors: validationResult.error.errors,
        })
      }

      const newTodo = validationResult.data
      await drizzleQueries.insertTodo(_context.db, newTodo.text)

      return new Response(JSON.stringify({ status: 'OK' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    } catch (error) {
      // Use standardized error response utility
      return createErrorResponse(error, {
        endpoint: '/api/todos',
        operation: 'create_todo',
      })
    }
  }
