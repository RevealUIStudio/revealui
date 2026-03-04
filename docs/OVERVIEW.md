# RevealUI Framework - Overview

**Purpose**: High-level framework overview with links to detailed documentation
**Last Updated**: 2026-02-01

---

## Table of Contents

1. [Introduction](#introduction)
2. [Core Features](#core-features)
3. [Architecture](#architecture)
4. [Third-Party Integrations](#third-party-integrations)
5. [Getting Started](#getting-started)
6. [Next Steps](#next-steps)

---

## Introduction

RevealUI is a modern, full-stack React framework that combines:

- ⚡ **React 19** with Server Components and React Compiler
- 🎨 **Tailwind CSS v4** for styling (10-100x faster builds)
- 📦 **Native CMS** - A headless CMS built directly into the framework
- 🔥 **Next.js 16** for server-side rendering
- 🗄️ **NeonDB + Drizzle ORM** for database management
- 🌐 **Vercel-optimized** for easy deployment
- 🎯 **TypeScript** throughout for type safety

### Perfect For

- 🏢 **Agencies** building client websites
- 🚀 **Startups** needing rapid development
- 💼 **Enterprises** requiring scalability
- 👨‍💻 **Developers** wanting modern developer experience

### Current Status

**Status**: 🟢 **Production Ready** — live at [cms.revealui.com](https://cms.revealui.com) and [api.revealui.com](https://api.revealui.com)

---

## Core Features

### CMS Features

RevealUI includes a powerful headless CMS with:

**Collections & Content:**
- Collections system for content types
- Globals for site-wide settings
- Rich field types (text, number, select, rich text, relationships, etc.)
- Field-level and collection-level access control
- Relationship management with automatic population

**Content Editing:**
- Lexical-based rich text editor
- Draft/publish workflow
- Version control
- Multi-locale support
- Media upload handling

**Developer Features:**
- Hooks system (`beforeChange`, `afterChange`, `beforeValidate`, `afterRead`)
- Query builder with filtering, sorting, pagination
- Transaction support
- TypeScript throughout

→ **See [CMS_GUIDE.md](./CMS_GUIDE.md)** for complete CMS documentation

### Database Features

**Dual Database Architecture:**
- **REST Database**: Primary application data (Neon/Supabase/Vercel Postgres)
- **Vector Database**: AI embeddings and semantic search

**Adapters:**
- PGlite for local development (in-memory PostgreSQL)
- Universal Postgres adapter (Neon, Supabase, Vercel Postgres)
- Automatic transaction pooling support

→ **See [DATABASE.md](./DATABASE.md)** for complete database documentation

### Type System

RevealUI uses TypeScript contracts for runtime validation:

- **Contracts Package** (`@revealui/contracts`) - Runtime validation with Zod
- **Type Generation** - Automatic TypeScript types from CMS collections
- **Validation** - Schema validation at API boundaries
- **Inference** - Type inference from contracts

→ **See [ARCHITECTURE.md](./ARCHITECTURE.md#type-system)** for type system details

### Payment Processing

Integrated Stripe support:

- Product and subscription management
- Checkout flow
- Webhook handling
- Customer portal
- Test mode support

→ **See [ARCHITECTURE.md](./ARCHITECTURE.md#payment-processing)** for payment details

### Theme System

RevealUI Theme System powered by Tailwind CSS v4:

- Custom design tokens
- Component variants
- Dark mode support
- Responsive utilities
- Theme customization

→ **See [ARCHITECTURE.md](./ARCHITECTURE.md#theme-system)** for theming documentation

---

## Architecture

RevealUI uses a modern monorepo architecture with clear separation of concerns:

### Monorepo Structure

```
revealui/
├── apps/
│   ├── api/           # REST API (Hono)
│   ├── cms/           # Headless CMS (Next.js 16)
│   ├── docs/          # Documentation site (Vite/React)
│   ├── mainframe/     # Demo/showcase app (Hono SSR)
│   ├── marketing/     # Marketing + waitlist (Next.js)
│   └── studio/        # Desktop companion (Tauri 2)
├── packages/
│   ├── core/          # Core CMS engine
│   ├── db/            # Database adapters
│   ├── contracts/     # Type contracts & validation
│   ├── auth/          # Authentication
│   ├── ai/            # AI integrations (Pro)
│   └── [9+ more]      # Additional packages
└── scripts/           # CLI tools, automation, CI gates
```

### Key Architectural Patterns

**Unified Backend:**
- Single Next.js app serves both CMS admin and public frontend
- Shared authentication and database connections
- Reduced deployment complexity

**Dual Database:**
- REST database for primary data
- Vector database for AI/semantic search
- Automatic connection pooling

**Multi-Tenant:**
- Account-level isolation
- Team-based access control
- Project separation

→ **See [ARCHITECTURE.md](./ARCHITECTURE.md)** for complete architecture documentation

---

## Third-Party Integrations

RevealUI integrates with best-in-class services:

### Required Integrations

| Service | Purpose | Free Tier | Docs |
|---------|---------|-----------|------|
| **NeonDB** | PostgreSQL database | 10 GB storage | [Database Guide](./DATABASE.md) |
| **Vercel** | Hosting & blob storage | Hobby plan available | [CI/CD Guide](./CI_CD_GUIDE.md) |
| **Stripe** | Payment processing | Test mode free | [Architecture](./ARCHITECTURE.md#payments) |

### Optional Integrations

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Resend** | Transactional email | `RESEND_API_KEY` |
| **Sentry** | Error tracking | `SENTRY_DSN` |
| **PostHog** | Analytics | `NEXT_PUBLIC_POSTHOG_KEY` |
| **OpenAI** | AI features | `OPENAI_API_KEY` |
| **Anthropic** | Claude AI | `ANTHROPIC_API_KEY` |

→ **See [ENVIRONMENT_VARIABLES_GUIDE.md](./ENVIRONMENT_VARIABLES_GUIDE.md)** for complete configuration

---

## Getting Started

→ **See [QUICK_START.md](./QUICK_START.md)** for complete setup instructions (5 minutes)

### Development Environments

RevealUI supports multiple development environments:

**Option 1: Pure Nix** (Recommended for Linux/NixOS-WSL)
- Fast, reproducible builds
- Zero vendor lock-in
- Automatic environment activation

**Option 2: Dev Containers** (Recommended for Windows/Mac/Codespaces)
- Docker-based workflow
- VS Code integration
- Works everywhere

**Option 3: Manual Setup** (Traditional)
- Direct installation on your system
- Full control over dependencies

→ **See [ENVIRONMENT_VARIABLES_GUIDE.md](./ENVIRONMENT_VARIABLES_GUIDE.md)** for environment comparison

---

## Next Steps

### For New Developers

1. **Complete setup**: Follow [QUICK_START.md](./QUICK_START.md)
2. **Explore the CMS**: Read [CMS_GUIDE.md](./CMS_GUIDE.md)
3. **Understand architecture**: Review [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Learn the database**: Study [DATABASE.md](./DATABASE.md)
5. **Review standards**: Read [STANDARDS.md](./STANDARDS.md)

### For Contributors

1. **Code standards**: Review [STANDARDS.md](./STANDARDS.md)
2. **Testing guide**: Read [TESTING.md](./testing/TESTING.md)
3. **CI/CD workflow**: Study [CI_CD_GUIDE.md](./CI_CD_GUIDE.md)
4. **Governance**: Read [GOVERNANCE.md](./GOVERNANCE.md)

### For AI Agents

1. **Automation guide**: Start with [AUTOMATION.md](./AUTOMATION.md)
2. **MCP integration**: Read [MCP.md](./MCP.md)
3. **Code standards**: Review [STANDARDS.md](./STANDARDS.md)

---

## Related Documentation

### Essential Reading

- **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture overview
- **[DATABASE.md](./DATABASE.md)** - Database setup and management
- **[CMS_GUIDE.md](./CMS_GUIDE.md)** - Complete CMS documentation

### Reference

- **[INDEX.md](./INDEX.md)** - Master documentation index
- **[ENVIRONMENT_VARIABLES_GUIDE.md](./ENVIRONMENT_VARIABLES_GUIDE.md)** - Configuration reference
- **[COMPONENT_CATALOG.md](./COMPONENT_CATALOG.md)** - Component reference

### Advanced Topics

- **[TESTING.md](./testing/TESTING.md)** - Testing strategy and guides
- **[CI_CD_GUIDE.md](./CI_CD_GUIDE.md)** - Deployment and CI/CD
- **[PERFORMANCE.md](./PERFORMANCE.md)** - Performance optimization
- **[SECURITY.md](./SECURITY.md)** - Security best practices
- **[AUTH.md](./AUTH.md)** - Authentication system

---

**Last Updated**: 2026-02-01
**Consolidated**: Trimmed from 4,194 lines to ~400 lines
**Maintainer**: RevealUI Framework Team
