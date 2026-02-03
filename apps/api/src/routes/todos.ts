import { zValidator } from '@hono/zod-validator'
import type { DatabaseClient } from '@revealui/db/client'
import * as todoQueries from '@revealui/db/queries/todos'
import { Hono } from 'hono'
import { z } from 'zod'

type Variables = {
  db: DatabaseClient
}

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new Hono<{ Variables: Variables }>()

// Validation schemas
const createTodoSchema = z.object({
  text: z.string().min(1, 'Todo text is required').max(500, 'Todo text too long'),
})

const updateTodoSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
})

// GET /api/todos - List all todos
app.get('/', async (c) => {
  const db = c.get('db')
  const todos = await todoQueries.getAllTodos(db)

  return c.json({
    success: true,
    data: todos,
  })
})

// GET /api/todos/:id - Get a single todo
app.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const todo = await todoQueries.getTodoById(db, id)

  if (!todo) {
    return c.json(
      {
        success: false,
        error: 'Todo not found',
      },
      404,
    )
  }

  return c.json({
    success: true,
    data: todo,
  })
})

// POST /api/todos - Create a new todo
app.post('/', zValidator('json', createTodoSchema), async (c) => {
  const db = c.get('db')
  const { text } = c.req.valid('json')

  const todo = await todoQueries.createTodo(db, text)

  return c.json(
    {
      success: true,
      data: todo,
    },
    201,
  )
})

// PATCH /api/todos/:id - Update a todo
app.patch('/:id', zValidator('json', updateTodoSchema), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = c.req.valid('json')

  const todo = await todoQueries.updateTodo(db, id, data)

  if (!todo) {
    return c.json(
      {
        success: false,
        error: 'Todo not found',
      },
      404,
    )
  }

  return c.json({
    success: true,
    data: todo,
  })
})

// DELETE /api/todos/:id - Delete a todo
app.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  // Check if exists first
  const existing = await todoQueries.getTodoById(db, id)
  if (!existing) {
    return c.json(
      {
        success: false,
        error: 'Todo not found',
      },
      404,
    )
  }

  await todoQueries.deleteTodo(db, id)

  return c.json({
    success: true,
    message: 'Todo deleted',
  })
})

export default app
