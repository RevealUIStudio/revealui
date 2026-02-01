# @revealui/mcp

Model Context Protocol (MCP) server infrastructure and configuration for RevealUI.

## Overview

This package contains MCP server infrastructure, including database migrations and configuration for AI agent integrations.

**Note**: This package is private and used for internal MCP server management.

## Features

- **MCP Configuration**: Centralized MCP server configuration
- **Database Migrations**: SQL migrations for MCP-related tables
- **Test Utilities**: Testing infrastructure for MCP servers

## Structure

```
packages/mcp/
├── migrations/        # Database migrations for MCP tables
├── src/              # MCP server source code
└── __tests__/        # MCP server tests
```

## Migrations

Database migrations for MCP-related tables:

```bash
# Run migrations
pnpm --filter @revealui/mcp migrate
```

## Available MCP Servers

RevealUI includes 6 MCP servers:

1. **Vercel MCP** - Deployment and storage management
2. **Stripe MCP** - Payment processing
3. **Neon MCP** - Database operations
4. **Supabase MCP** - Supabase project management
5. **Playwright MCP** - Browser automation
6. **Next.js DevTools MCP** - Next.js debugging

See [MCP Guide](../../docs/MCP.md) for complete setup instructions.

## Environment Variables

```env
# MCP Server Configuration
VERCEL_API_KEY=vercel_...
STRIPE_SECRET_KEY=sk_test_...
NEON_API_KEY=neon_...
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
```

## Starting MCP Servers

```bash
# Start all servers
pnpm mcp:all

# Start individual servers
pnpm mcp:vercel
pnpm mcp:stripe
pnpm mcp:neon
pnpm mcp:supabase
pnpm mcp:playwright
pnpm mcp:next-devtools
```

## Configuration Files

- `.cursor/mcp-config.json` - Cursor IDE MCP configuration
- `.mcp/config.json` - Alternative MCP configuration location
- `packages/mcp/src/` - MCP server source code

## Development

```bash
# Run tests
pnpm --filter @revealui/mcp test
```

## Related Documentation

- [MCP Guide](../../docs/MCP.md) - Complete MCP setup and usage
- [Automation Guide](../../docs/AUTOMATION.md) - AI agent integration
- [Agent Quick Start](../../docs/AUTOMATION.md#quick-start-for-agents) - AI agent onboarding

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Anthropic MCP Servers](https://github.com/anthropics/mcp-servers)

## License

MIT
