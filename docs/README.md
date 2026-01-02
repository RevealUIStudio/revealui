# RevealUI Framework Documentation

**Last Updated**: January 2, 2026

Welcome to the RevealUI Framework documentation! This guide will help you navigate all available documentation.

## Quick Links

- [CI/CD Guide](./CI-CD-GUIDE.md) - Deployment with NeonDB and Vercel
- [Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration reference
- [Deployment Runbook](./DEPLOYMENT-RUNBOOK.md) - Production deployment guide
- [Development Plan](./migration/DETAILED-PLAN.md) - Current roadmap

## Documentation Structure

### Getting Started

- **[CI/CD Guide](./CI-CD-GUIDE.md)** - Deploy to production with NeonDB Postgres
- **[Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md)** - All configuration options

### Architecture & Planning

- **[CRDT Plan](./migration/GRADE-A-CRDT-PLAN.md)** - Memory system implementation roadmap
- **[Codebase Assessment](./migration/CODEBASE-ASSESSMENT.md)** - Current state overview

### Deployment & Operations

- **[Deployment Runbook](./DEPLOYMENT-RUNBOOK.md)** - Complete deployment guide
- **[Rollback Procedure](./ROLLBACK-PROCEDURE.md)** - Emergency rollback steps

### Testing & Quality

- **[Testing Strategy](./TESTING-STRATEGY.md)** - Testing guidelines
- **[Lint Errors Report](./LINT_ERRORS_REPORT.md)** - Current lint status

### Architecture

- **[Multi-tenant Architecture](./MULTI-TENANT-ARCHITECTURE.md)** - Multi-tenant patterns
- **[Custom Integrations](./CUSTOM-INTEGRATIONS.md)** - Third-party integrations
- **[Known Limitations](./KNOWN-LIMITATIONS.md)** - Current limitations

## Key Technologies

- **React 19** with React Compiler
- **Next.js 16** for the CMS app
- **Vite + Hono** for the web builder app
- **NeonDB Postgres** for database
- **Lexical** (vanilla) for rich text editing
- **Vercel Blob** for media storage
- **Stripe** for payments
- **TypeScript** (strict mode)
- **Tailwind CSS 4.0**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     RevealUI Framework                          │
├─────────────────────────────────────────────────────────────────┤
│  apps/cms          │  apps/web                                  │
│  (Next.js 16)      │  (Vite + Hono SSR)                        │
│  RevealUI CMS      │  Builder/Preview                          │
├─────────────────────────────────────────────────────────────────┤
│  @revealui/cms     │  @revealui/schema  │  packages/services   │
│  (CMS Framework)   │  (Zod Contracts)   │  (Stripe/Supabase)   │
├─────────────────────────────────────────────────────────────────┤
│  NeonDB Postgres   │  Vercel Blob Storage                       │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

| Package | Purpose | Status |
|---------|---------|--------|
| `@revealui/cms` | CMS framework | ✅ Working |
| `@revealui/schema` | Zod schemas | ✅ Working |
| `packages/services` | Stripe, Supabase | ✅ Working |
| `apps/cms` | Next.js CMS app | ✅ Compiles |
| `apps/web` | Vite builder app | ✅ Builds |

## Documentation by Use Case

### I want to...

**Deploy to production:**
1. Read [CI/CD Guide](./CI-CD-GUIDE.md)
2. Configure [Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md)
3. Follow [Deployment Runbook](./DEPLOYMENT-RUNBOOK.md)

**Understand the codebase:**
1. Read [Codebase Assessment](./migration/CODEBASE-ASSESSMENT.md)
2. Review package structure above

## External Resources

- [React 19 Documentation](https://react.dev)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [NeonDB Documentation](https://neon.tech/docs)
- [Lexical Documentation](https://lexical.dev)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com)

## Contributing

Found an error or want to improve the documentation? See our [Contributing Guide](../CONTRIBUTING.md).

---

**Need help?** Check out our [GitHub Discussions](https://github.com/RevealUIStudio/reveal/discussions) or [open an issue](https://github.com/RevealUIStudio/reveal/issues).
