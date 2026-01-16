#!/usr/bin/env tsx
/**
 * OpenAPI 3.2.0 Specification Generator
 *
 * Generates OpenAPI 3.2.0 specification for RevealUI REST API.
 * This is the most modern version of the OpenAPI standard (as of 2025).
 *
 * Usage:
 *   pnpm tsx scripts/generate-openapi-spec.ts
 *   or
 *   pnpm generate:openapi
 *
 * Output: openapi.json (OpenAPI 3.2.0 spec)
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workspaceRoot = join(__dirname, '..')

/**
 * OpenAPI 3.2.0 Specification
 * 
 * Most modern version of OpenAPI standard (as of 2025).
 * Key features:
 * - Full JSON Schema 2020-12 support
 * - Hierarchical tags
 * - Enhanced webhooks support
 * - Improved streaming support
 * - Backward compatible with 3.1.x
 */
const openAPISpec = {
  openapi: '3.2.0', // Most modern version (2025)
  info: {
    title: 'RevealUI REST API',
    version: '1.0.0',
    description: 'RevealUI Framework REST API - Modern React 19 Framework with Next.js 16',
    contact: {
      name: 'RevealUI',
      url: 'https://revealui.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000/api',
      description: 'Local development server',
    },
    {
      url: 'https://api.revealui.com/api',
      description: 'Production API server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management',
    },
    {
      name: 'Users',
      description: 'User management operations',
    },
    {
      name: 'Sites',
      description: 'Site management operations',
    },
    {
      name: 'Pages',
      description: 'Page content management',
    },
    {
      name: 'Media',
      description: 'Media file management',
    },
    {
      name: 'Posts',
      description: 'Blog post management',
    },
    {
      name: 'Memory',
      description: 'AI memory operations (episodic, working, vector)',
    },
    {
      name: 'Shapes',
      description: 'ElectricSQL shape subscriptions',
    },
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns API health status',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness check',
        description: 'Returns API readiness status',
        operationId: 'getReadiness',
        responses: {
          '200': {
            description: 'API is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ready' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/sign-in': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in',
        description: 'Authenticate user and create session',
        operationId: 'signIn',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sign in successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    session: { $ref: '#/components/schemas/Session' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
          },
        },
      },
    },
    '/auth/sign-up': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign up',
        description: 'Create new user account',
        operationId: 'signUp',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
          },
        },
      },
    },
    '/auth/sign-out': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign out',
        description: 'End user session',
        operationId: 'signOut',
        responses: {
          '200': {
            description: 'Sign out successful',
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Returns authenticated user information',
        operationId: 'getCurrentUser',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'User information',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/memory/search': {
      post: {
        tags: ['Memory'],
        summary: 'Search memories',
        description: 'Vector similarity search for agent memories',
        operationId: 'searchMemories',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string' },
                  limit: { type: 'integer', default: 10 },
                  threshold: { type: 'number', default: 0.7 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AgentMemory' },
                },
              },
            },
          },
        },
      },
    },
    '/shapes/agent-contexts': {
      get: {
        tags: ['Shapes'],
        summary: 'Subscribe to agent contexts',
        description: 'ElectricSQL shape subscription for agent contexts',
        operationId: 'subscribeAgentContexts',
        responses: {
          '200': {
            description: 'Shape subscription established',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    shape: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/shapes/conversations': {
      get: {
        tags: ['Shapes'],
        summary: 'Subscribe to conversations',
        description: 'ElectricSQL shape subscription for conversations',
        operationId: 'subscribeConversations',
        responses: {
          '200': {
            description: 'Shape subscription established',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token authentication',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
          status: { type: 'string', enum: ['active', 'inactive'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name'],
      },
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'userId', 'expiresAt'],
      },
      AgentMemory: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          type: {
            type: 'string',
            enum: ['fact', 'preference', 'decision', 'feedback', 'example', 'correction', 'skill', 'warning'],
          },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'content', 'type'],
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
        required: ['error', 'message'],
      },
    },
  },
  // OpenAPI 3.2.0 features
  jsonSchemaDialect: 'https://spec.openapis.org/oas/3.2/dialect/base', // JSON Schema 2020-12
}

async function main() {
  console.log('📝 Generating OpenAPI 3.2.0 Specification...\n')

  const outputPath = join(workspaceRoot, 'openapi.json')
  
  try {
    writeFileSync(
      outputPath,
      JSON.stringify(openAPISpec, null, 2),
      'utf-8',
    )
    
    console.log('✅ OpenAPI 3.2.0 specification generated successfully!')
    console.log(`   Output: ${outputPath}\n`)
    console.log('📋 Next steps:')
    console.log('   - Review openapi.json')
    console.log('   - Use with Swagger UI: pnpm dlx @redocly/cli preview-docs openapi.json')
    console.log('   - Validate: pnpm dlx @redocly/cli lint openapi.json\n')
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI spec:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
