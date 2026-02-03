# RevealUI API

Centralized backend API server for RevealUI applications.

## Features

- **Hono Framework** - Fast, lightweight web framework
- **Type-safe** - Full TypeScript support
- **Edge-ready** - Deployable to Vercel Edge or Cloudflare Workers
- **Database integration** - Drizzle ORM with PostgreSQL
- **Validation** - Zod schemas for request validation
- **CORS enabled** - Configured for cross-origin requests

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm typecheck

# Build for production
pnpm build
```

## API Endpoints

### Health Check
- `GET /health` - Returns service health status

## Environment Variables

See `.env.example` for required environment variables.

## Deployment

This API is configured for deployment to Vercel. See `vercel.json` for configuration.
