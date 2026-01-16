# Frameworks Used in RevealUI

This document lists all frameworks, libraries, and tools used to build the RevealUI framework.

## Core Web Frameworks

### Frontend Frameworks
- **React 19.2.0** - Core UI framework with React Compiler
- **Next.js 16.0.10** - Full-stack React framework for the CMS app
- **RevealUI** - Custom framework for the web app (SSR/SSG)

### Build Tools & Bundlers
- **Vite 7.2.4** - Build tool and dev server for web app and services
- **Turbo 2.7.2** - Monorepo build system and task runner
- **tsup 8.0.0** - TypeScript bundler for packages
- **Webpack** - Used by Next.js for production builds
- **Babel** - Transpiler (via React Compiler plugin)

## Styling Frameworks

### CSS Frameworks
- **Tailwind CSS 4.1.17** - Utility-first CSS framework
- **PostCSS 8.5.6** - CSS post-processor
- **Sass 1.94.2** - CSS preprocessor (used in web app)

### Tailwind Plugins
- **@tailwindcss/aspect-ratio** - Aspect ratio utilities
- **@tailwindcss/forms** - Form styling utilities
- **@tailwindcss/typography** - Typography plugin

## Database & ORM Frameworks

### Database Systems
- **PostgreSQL** - Primary database (via NeonDB)
- **Better SQLite3 12.4.6** - SQLite adapter for development/fallback
- **NeonDB** - Serverless Postgres database

### ORM & Query Builders
- **Drizzle ORM 0.44.7** - TypeScript ORM
- **Drizzle Kit 0.31.7** - Database migrations and schema management
- **@neondatabase/serverless** - Neon serverless driver

## Testing Frameworks

### Test Runners
- **Vitest 4.0.14** - Unit and integration testing
- **@vitest/ui** - Vitest UI interface
- **@vitest/coverage-v8** - Code coverage

### E2E Testing
- **Playwright 1.57.0** - End-to-end testing framework

### Testing Utilities
- **@testing-library/react 16.3.0** - React component testing
- **@testing-library/jest-dom 6.9.1** - DOM matchers
- **@testing-library/user-event 14.6.1** - User interaction simulation
- **jsdom 27.2.0** - DOM implementation for Node.js

## Rich Text Editor

### Lexical Framework
- **Lexical 0.38.2** - Extensible text editor framework
- **@lexical/clipboard** - Clipboard operations
- **@lexical/code** - Code block support
- **@lexical/link** - Link functionality
- **@lexical/list** - List support
- **@lexical/react** - React bindings
- **@lexical/rich-text** - Rich text features
- **@lexical/selection** - Selection handling
- **@lexical/table** - Table support
- **@lexical/utils** - Utility functions

### Code Highlighting
- **prism-react-renderer 2.4.1** - Syntax highlighting
- **PrismJS** - Code syntax highlighting (used in Lexical)

## Form Handling & Validation

### Form Management
- **React Hook Form 7.66.1** - Form state management

### Validation
- **Zod 4.1.13** - Schema validation library

## HTTP & API Frameworks

### Server Frameworks
- **Hono 4.10.7** - Fast web framework for the web app
- **@hono/node-server** - Node.js adapter for Hono
- **@hono/vite-dev-server** - Vite dev server integration
- **Next.js API Routes** - API endpoints for CMS app

### Middleware
- **@universal-middleware/core** - Universal middleware system
- **@universal-middleware/hono** - Hono middleware adapter

## Authentication & Security

### Authentication
- **jsonwebtoken 9.0.2** - JWT token generation/verification
- **bcryptjs 2.4.3** - Password hashing

### Security Tools
- **@sentry/nextjs 10.27.0** - Error tracking for Next.js
- **@sentry/react 10.27.0** - Error tracking for React
- **@sentry/vite-plugin** - Vite plugin for Sentry

## Third-Party Services & Integrations

### Payment Processing
- **Stripe 20.0.0** - Payment processing
- **@stripe/stripe-js 8.5.3** - Stripe.js client library

### Database & Backend Services
- **Supabase 2.62.5** - Backend-as-a-Service
- **@supabase/supabase-js 2.84.0** - Supabase JavaScript client
- **@supabase/ssr 0.7.0** - Supabase SSR utilities

### Vercel Services
- **@vercel/analytics 1.5.0** - Web analytics
- **@vercel/speed-insights 1.2.0** - Performance monitoring
- **@vercel/blob 0.23.4** - Blob storage
- **@vercel/postgres 0.9.0** - Postgres database
- **@vercel/node 5.5.12** - Vercel Node.js runtime

## UI Component Libraries

### Component Utilities
- **class-variance-authority 0.7.1** - Component variant management
- **Geist 1.5.1** - Font family

### UI Frameworks (for specific features)
- **Chakra UI 2.8.2** - Component library (used in Lexical devtools)
- **Framer Motion 11.1.5** - Animation library (used in Lexical devtools)
- **@emotion/react** - CSS-in-JS (used in Lexical devtools)
- **@emotion/styled** - Styled components (used in Lexical devtools)

## State Management

### State Libraries
- **Zustand 4.5.1** - Lightweight state management (used in Lexical devtools)
- **DataLoader 2.2.2** - Batching and caching data fetching

## Development Tools

### Type Checking & Compilation
- **TypeScript 5.9.3** - Type-safe JavaScript
- **tsx 4.20.6** - TypeScript execution

### Code Quality
- **Biome 2.3.7** - Linter and formatter
- **ESLint 9.39.1** - JavaScript linter
- **typescript-eslint 8.48.0** - TypeScript ESLint integration
- **eslint-plugin-react 7.37.5** - React ESLint rules

### Package Management
- **pnpm 9.14.2** - Fast, disk space efficient package manager
- **Changesets 2.29.7** - Version management and changelog generation

### Utilities
- **cross-env 10.1.0** - Cross-platform environment variables
- **dotenv 17.2.3** - Environment variable management
- **dotenv-cli 11.0.0** - CLI for dotenv
- **rimraf 6.1.2** - Cross-platform rm -rf
- **fast-glob 3.3.3** - Fast file globbing
- **deepmerge 4.3.1** - Deep object merging
- **to-snake-case 1.0.0** - String case conversion

## Image Processing

- **Sharp 0.34.5** - High-performance image processing

## Additional Libraries

### Code Highlighting & Syntax
- **Shiki** - Syntax highlighter (used in Lexical code blocks)
- **@shikijs/core, @shikijs/engine-javascript, @shikijs/langs, @shikijs/themes** - Shiki packages

### Browser Extensions (Lexical Devtools)
- **wxt 0.17.0** - Web Extension Toolkit
- **@webext-pegasus/rpc, @webext-pegasus/store-zustand, @webext-pegasus/transport** - Browser extension utilities

### Other Utilities
- **uuid 11.1.0** - UUID generation
- **react-error-boundary 3.1.4** - Error boundary component

## Summary by Category

| Category | Count | Key Frameworks |
|----------|-------|----------------|
| **Core Web** | 3 | React 19, Next.js 16, RevealUI |
| **Build Tools** | 5 | Vite, Turbo, tsup, Webpack, Babel |
| **Styling** | 3 | Tailwind CSS v4, PostCSS, Sass |
| **Database** | 3 | PostgreSQL, SQLite, Drizzle ORM |
| **Testing** | 4 | Vitest, Playwright, Testing Library |
| **Rich Text** | 10+ | Lexical ecosystem |
| **Forms/Validation** | 2 | React Hook Form, Zod |
| **HTTP/API** | 3 | Hono, Next.js API Routes |
| **Auth/Security** | 3 | JWT, bcryptjs, Sentry |
| **Services** | 6 | Stripe, Supabase, Vercel services |
| **UI Components** | 5 | CVA, Chakra UI, Framer Motion |
| **Dev Tools** | 8 | TypeScript, Biome, ESLint, pnpm |

## Total Framework Count

**Approximately 100+ frameworks, libraries, and tools** are used across the RevealUI monorepo, including:
- Core frameworks: 3
- Build tools: 5
- Styling: 3
- Database: 3
- Testing: 4
- Lexical packages: 28+
- Third-party services: 6
- Development tools: 8+
- Utility libraries: 40+

---

## Related Documentation

- [Component Mapping](./COMPONENT-MAPPING.md) - Component, business logic, schema mapping
- [Dependencies List](./DEPENDENCIES-LIST.md) - Complete dependencies
- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task

---

*Last updated: Based on package.json files across the monorepo*
