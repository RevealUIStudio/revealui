import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { DatabaseClient } from '@revealui/db/client'
import * as todoQueries from '@revealui/db/queries/todos'

type Variables = {
  db: DatabaseClient
}

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new OpenAPIHono<{ Variables: Variables }>()

// Schema definitions
const TodoSchema = z.object({
  id: z.string().openapi({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Todo unique identifier',
  }),
  text: z.string().openapi({
    example: 'Buy groceries',
    description: 'Todo description',
  }),
  completed: z.boolean().openapi({
    example: false,
    description: 'Whether the todo is completed',
  }),
  createdAt: z.any().openapi({
    type: 'string',
    format: 'date-time',
    example: '2024-01-01T00:00:00.000Z',
    description: 'Creation timestamp (ISO 8601)',
  }),
  updatedAt: z.any().openapi({
    type: 'string',
    format: 'date-time',
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last update timestamp (ISO 8601)',
  }),
})

const CreateTodoSchema = z.object({
  text: z.string().min(1, 'Todo text is required').max(500, 'Todo text too long').openapi({
    example: 'Buy groceries',
    description: 'Todo description',
  }),
})

const UpdateTodoSchema = z.object({
  text: z.string().min(1).max(500).optional().openapi({
    example: 'Buy groceries and cook dinner',
  }),
  completed: z.boolean().optional().openapi({
    example: true,
  }),
})

const ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().openapi({
    example: 'Todo not found',
  }),
})

const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: TodoSchema,
})

const ListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(TodoSchema),
})

// GET /api/todos - List all todos
const listTodosRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['todos'],
  summary: 'List all todos',
  description: 'Retrieve a list of all todos',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListResponseSchema,
        },
      },
      description: 'Successfully retrieved todos',
    },
  },
})

app.openapi(listTodosRoute, async (c) => {
  const db = c.get('db')
  const todos = await todoQueries.getAllTodos(db)

  return c.json({
    success: true,
    data: todos,
  })
})

// GET /api/todos/:id - Get a single todo
const getTodoRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['todos'],
  summary: 'Get a todo by ID',
  description: 'Retrieve a specific todo by its unique identifier',
  request: {
    params: z.object({
      id: z.string().openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: 'Successfully retrieved todo',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Todo not found',
    },
  },
})

app.openapi(getTodoRoute, async (c) => {
  const db = c.get('db')
  const { id } = c.req.valid('param')

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

  return c.json(
    {
      success: true,
      data: todo,
    },
    200,
  )
})

// POST /api/todos - Create a new todo
const createTodoRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['todos'],
  summary: 'Create a new todo',
  description: 'Create a new todo item',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTodoSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: 'Todo created successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
})

app.openapi(createTodoRoute, async (c) => {
  const db = c.get('db')
  const { text } = c.req.valid('json')

  const todo = await todoQueries.createTodo(db, text)

  if (!todo) {
    return c.json(
      {
        success: false,
        error: 'Failed to create todo',
      },
      500,
    )
  }

  return c.json(
    {
      success: true,
      data: todo,
    },
    201,
  )
})

// PATCH /api/todos/:id - Update a todo
const updateTodoRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['todos'],
  summary: 'Update a todo',
  description: 'Update an existing todo item',
  request: {
    params: z.object({
      id: z.string().openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateTodoSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: 'Todo updated successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Todo not found',
    },
  },
})

app.openapi(updateTodoRoute, async (c) => {
  const db = c.get('db')
  const { id } = c.req.valid('param')
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

  return c.json(
    {
      success: true,
      data: todo,
    },
    200,
  )
})

// DELETE /api/todos/:id - Delete a todo
const deleteTodoRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['todos'],
  summary: 'Delete a todo',
  description: 'Delete a todo item by its ID',
  request: {
    params: z.object({
      id: z.string().openapi({
        param: {
          name: 'id',
          in: 'path',
        },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({
              example: 'Todo deleted',
            }),
          }),
        },
      },
      description: 'Todo deleted successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Todo not found',
    },
  },
})

app.openapi(deleteTodoRoute, async (c) => {
  const db = c.get('db')
  const { id } = c.req.valid('param')

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

  return c.json(
    {
      success: true,
      message: 'Todo deleted',
    },
    200,
  )
})

export default app
