# MCP Package Documentation Index

Complete documentation for RevealUI's Model Context Protocol integration.

## Quick Links

- **[Main Guide](./README.md)** - Complete MCP overview and setup
- **[Setup Guide](./SETUP.md)** - Step-by-step configuration
- **[Configuration Templates](../configs/README.md)** - Config file templates

## MCP Servers

### Code Validator
- **[Documentation](./servers/code-validator.md)** - Prevents AI-generated technical debt
- **Server:** `packages/mcp/src/servers/code-validator.ts`
- **Status:** ✅ Active (installed)

### External Services
- **Vercel** - Deployment and storage (`src/servers/vercel.ts`)
- **Stripe** - Payment processing (`src/servers/stripe.ts`)
- **Neon** - Database operations (`src/servers/neon.ts`)
- **Supabase** - Project management (`src/servers/supabase.ts`)
- **Playwright** - Browser automation (`src/servers/playwright.ts`)
- **Next.js DevTools** - Debugging (`src/servers/next-devtools.ts`)

## Package Structure

```
packages/mcp/
├── src/
│   ├── servers/          # MCP server implementations
│   ├── config/           # Configuration utilities
│   └── adapters/         # Database adapters
├── configs/              # Template configurations
│   ├── claude-template.json
│   └── README.md
├── docs/                 # This documentation
│   ├── README.md         # Main guide
│   ├── SETUP.md          # Setup instructions
│   └── servers/          # Per-server docs
├── migrations/           # Database migrations
└── package.json
```

## Getting Started

1. **[Read the main guide](./README.md)** - Understand MCP in RevealUI
2. **[Follow setup](./SETUP.md)** - Configure MCP for your IDE
3. **[Use templates](../configs/README.md)** - Apply config templates

## Common Tasks

### Enable Code Validator
```bash
# Already configured at:
~/.claude/config.json
```

### Add More Servers
```bash
# Edit config and enable servers
code ~/.claude/config.json

# Set required env vars
export VERCEL_API_KEY=...
export STRIPE_SECRET_KEY=...
```

### Test MCP Server
```bash
tsx packages/mcp/src/servers/code-validator.ts
# Should start and wait for input (Ctrl+C to exit)
```

## Related Documentation

- [Code Validation](./servers/code-validator.md) - Code validator guide
- [Main README](../README.md) - Package overview
- [Root MCP Guide](/docs/MCP.md) - Legacy (will be deprecated)

## Support

- Issues: [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)
- MCP Spec: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

---

**Last Updated:** 2026-02-04
