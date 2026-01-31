# RevealUI Framework - Overview

**Purpose**: Comprehensive framework overview covering features, architecture, integrations, types, payments, and theming
**Last Updated**: January 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [Core Framework Features](#core-framework-features)
3. [Framework Architecture](#framework-architecture)
4. [Third-Party Integrations](#third-party-integrations)
5. [Type System](#type-system)
6. [Payment Processing](#payment-processing)
7. [RevealUI Theme System](#revealui-theme-system)

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

**Status**: 🔴 **Active Development - NOT Production Ready**

Before using in production, please review:
- [Production Readiness Assessment](../PRODUCTION_READINESS.md)
- [Current Status](../STATUS.md)
- [Production Roadmap](../PRODUCTION_ROADMAP.md)

---

## Core Framework Features

### CMS Features (@revealui/core)

#### Collections System
- **Collections System**: Define and manage content collections
- **Globals System**: Site-wide settings and configuration
- **Fields System**: Rich field type system with validation
- **Access Control**: Field-level and collection-level permissions (`anyone`, `authenticated`)
- **Hooks System**: `beforeChange`, `afterChange`, `beforeValidate`, `afterRead` hooks
- **Relationship Management**: Automatic relationship population and traversal
- **Query Builder**: Advanced query system with `where`, `select`, `sort`, `limit`, `depth`
- **Pagination**: Built-in pagination support
- **Localization**: Multi-locale support with fallback locales
- **Versions**: Version control for documents
- **Draft/Publish**: Draft and published document states

#### Field Types

- Text fields
- Number fields
- Textarea fields
- Select fields
- Checkbox fields
- Email fields
- JSON fields
- Array fields
- Group fields
- Blocks (rich content blocks)
- Rich Text (Lexical editor)
- Relationship fields
- Upload fields (media)
- Date fields
- Code fields

#### Database Adapters

- **PGlite Adapter**: For local development and testing (in-memory PostgreSQL)
- **Universal Postgres Adapter**: Supports Neon, Supabase, Vercel Postgres
- **Transaction Pooling**: Automatic support for Supabase serverless (port 6543)
- **Dual Database Architecture**: Separate REST and Vector databases

#### Rich Text Editor (Lexical)

- Lexical-based rich text editor
- **Features**: Bold, Italic, Underline, Headings, Links, Code blocks, Lists, Tables
- **Plugins**: Fixed toolbar, Tree view, Image upload, Floating toolbar
- **Image Nodes**: Custom image handling with upload support
- **HTML Export**: Server-side HTML rendering (RSC)
- **Client-side Editor**: React component for browser editing

#### Storage Adapters

- **Vercel Blob Storage**: For media files
- Extensible storage adapter system

#### API Features

- **REST API**: Automatic REST endpoint generation
- **Route Handlers**: Custom route handler support
- **Error Handling**: Standardized error responses
- **Request Context**: Full request context in hooks

#### Admin UI

- **Admin Dashboard**: Full-featured admin interface
- **Collection List**: Browse and manage collections
- **Document Form**: Create/edit documents with rich forms
- **Custom Components**: Extensible component system
- **Live Preview**: Preview changes in real-time
- **Custom Graphics**: Brandable icons and logos

#### Plugins System

- **Form Builder Plugin**: Dynamic form creation
- **Nested Docs Plugin**: Hierarchical document structures
- **Redirects Plugin**: URL redirect management
- **Plugin Extension System**: Register custom field types and extensions

#### Utilities

- **Deep Clone**: Deep object cloning
- **LRU Cache**: In-memory caching
- **Logger**: Structured logging system
- **Type Guards**: Runtime type checking
- **Config Validation**: Runtime config validation
- **Field Traversal**: Traverse and transform field values

#### Type System

- **Type Generation**: Auto-generated TypeScript types
- **Type Inference**: Automatic type inference from config
- **CMS Types**: PayloadCMS-compatible types
- **Generated Types**: Database, Supabase, Neon types

#### Next.js Integration

- **Next.js 16 Support**: Async params and searchParams
- **Server Components**: RSC support for rich text
- **API Routes**: Automatic API route generation
- **withRevealUI HOC**: Wrap Next.js apps with RevealUI
- **Utilities**: Helper functions for Next.js integration

### AI System (@revealui/ai)

#### Memory Management

- **Working Memory**: Short-term, session-based memory
- **Episodic Memory**: Long-term, event-based memory with vector search
- **Semantic Memory**: Vector-based similarity search
- **Memory Persistence**: CRDT-based persistent state
- **Memory Embeddings**: Vector embeddings for semantic search

#### CRDT Types

- **LWW Register**: Last-Write-Wins register
- **OR-Set**: Observed-Remove Set
- **PN-Counter**: Positive-Negative Counter
- **Vector Clock**: Event ordering and causality

#### LLM Providers

- **OpenAI**: GPT models support
- **Anthropic**: Claude models support
- **Provider Abstraction**: Pluggable LLM provider system
- **Client Interface**: Unified LLM client interface

#### Agent System

- **Agent Orchestration**: Multi-agent coordination
- **Agent Context**: Session and agent context management
- **Agent Memory**: Persistent agent memory across sessions
- **Node ID Service**: Unique node identification for distributed systems

#### Tools System

- **Tool Registry**: Register and manage tools
- **MCP Adapter**: Model Context Protocol integration
- **Tool Execution**: Execute tools with agent context

#### React Hooks

- **useAgentContext**: Access agent context in React
- **useWorkingMemory**: Access working memory in React
- **useEpisodicMemory**: Access episodic memory in React

#### Vector Search

- **pgvector Integration**: PostgreSQL vector similarity search
- **Embedding Generation**: Automatic embedding generation
- **Similarity Search**: Semantic similarity queries

### Authentication (@revealui/auth)

#### Authentication Features

- **Database-backed Sessions**: Persistent session storage
- **Better Auth Patterns**: Modern auth patterns
- **Password Hashing**: bcrypt password hashing
- **Session Management**: Create, validate, destroy sessions
- **User Management**: User CRUD operations

#### Server/Client Separation

- **Server Exports**: Server-side auth utilities
- **Client Exports**: Client-side auth utilities
- **React Exports**: React hooks and components

### Database (@revealui/db)

#### Schema System

- **Drizzle ORM**: Type-safe ORM with Drizzle
- **Table Definitions**: Users, Sessions, Sites, Pages, Agents, CMS tables
- **Relations**: Automatic relation definitions
- **Migrations**: Drizzle Kit migrations

#### Tables

- **Users**: User accounts and profiles
- **Sessions**: User sessions
- **Sites**: Multi-site support
- **Site Collaborators**: Site collaboration management
- **Pages**: Page management with revisions
- **Page Revisions**: Version history for pages
- **Agent Contexts**: AI agent context storage
- **Agent Memories**: Persistent agent memories
- **Agent Actions**: Agent action logging
- **Conversations**: Chat conversations
- **CRDT Operations**: CRDT operation logs
- **Node ID Mappings**: Distributed node ID management
- **Media**: CMS media library
- **Posts**: Blog posts
- **Rate Limits**: Rate limiting tracking
- **Failed Attempts**: Login attempt tracking

#### Database Clients

- **Dual Client Support**: Separate REST and Vector clients
- **Neon Database**: Serverless Postgres support
- **Supabase Database**: Supabase Postgres support
- **Type Generation**: Auto-generated database types

#### Type System

- **Database Types**: Full Database type structure
- **Table Types**: Row, Insert, Update types for each table
- **Relationship Types**: Relationship type definitions

### Sync System (@revealui/sync)

#### Real-time Sync

- **Electric SQL**: Real-time sync with Electric SQL
- **Cross-tab Sync**: Memory sharing across browser tabs
- **Session Sync**: Session-based synchronization
- **Offline-first**: Offline-first architecture

#### React Integration

- **Electric Provider**: React context provider for sync
- **useElectric Hook**: Access Electric client in React
- **Automatic Sync**: Automatic state synchronization

### Services Package

#### Stripe Integration

- **Stripe Client**: Type-safe Stripe API client
- **Checkout Sessions**: Create payment checkout sessions
- **Portal Links**: Create customer portal links
- **Webhooks**: Stripe webhook handling
- **Product Management**: Update products and prices

#### Supabase Integration

- **Supabase Client**: Server, client, and web clients
- **Type Generation**: Auto-generated Supabase types
- **Configuration**: TOML-based configuration

#### API Utilities

- **Error Handling**: Standardized API error responses
- **Logger**: Service-level logging

### Presentation Layer (@revealui/presentation)

#### UI Components

- **Button**: Button component with variants
- **Input**: Text input fields
- **Textarea**: Multi-line text input
- **Select**: Dropdown selection
- **Checkbox**: Checkbox input
- **Radio**: Radio button groups
- **Switch**: Toggle switch
- **Dialog**: Modal dialogs
- **Dropdown**: Dropdown menus
- **Combobox**: Autocomplete combobox
- **Listbox**: Selectable lists
- **Avatar**: User avatar display
- **Badge**: Status badges
- **Alert**: Alert messages
- **Heading**: Typography headings
- **Text**: Typography text
- **Link**: Navigation links
- **Table**: Data tables
- **Pagination**: Pagination controls
- **Navbar**: Navigation bars
- **Sidebar**: Sidebar navigation
- **Sidebar Layout**: Layout with sidebar
- **Stacked Layout**: Stacked layout system
- **Fieldset**: Form fieldsets
- **Label**: Form labels
- **Form Label**: Enhanced form labels
- **Description List**: Key-value lists
- **Divider**: Visual dividers

#### Primitives

- **Box**: Layout box primitive
- **Flex**: Flexbox layout
- **Grid**: Grid layout
- **Slot**: Slot primitive for composition
- **Text**: Text primitive
- **Heading**: Heading primitive

#### Utilities

- **Class Name Utility (cn)**: Tailwind class merging

### Configuration (@revealui/config)

#### Environment Configuration

- **Environment Detection**: Automatic environment detection
- **Config Validation**: Zod-based config validation
- **Type-safe Config**: TypeScript-validated configuration
- **Dotenv Support**: Environment variable loading

### Apps

#### CMS App (Next.js 16)

- **Next.js 16**: Latest Next.js with async params
- **Admin Dashboard**: Full admin interface
- **API Routes**: REST API endpoints
- **Frontend Pages**: Public-facing pages
- **Post Preview**: Post preview system
- **Health Endpoints**: Health check endpoints
- **Auth Routes**: Authentication endpoints
- **GDPR Routes**: Data export and deletion
- **Chat API**: AI chat endpoints
- **Memory API**: Agent memory endpoints

#### Web App (RevealUI + Vite)

- **RevealUI Framework**: RevealUI-powered frontend
- **Vite Build**: Fast Vite-based builds
- **React 19**: Latest React with compiler
- **Page Routing**: File-based routing
- **Server-side Rendering**: SSR support
- **Static Generation**: SSG support

#### Docs App

- **Documentation Site**: Auto-generated docs site
- **Markdown Support**: Markdown rendering
- **Syntax Highlighting**: Code syntax highlighting
- **Search**: Documentation search
- **Navigation**: Auto-generated navigation

### Development Tools

#### Build System

- **Turborepo**: Monorepo build orchestration
- **TypeScript**: Strict TypeScript compilation
- **ESM Modules**: ES Modules throughout
- **Turbopack**: Next.js 16 default bundler
- **Vite**: Frontend build tool

#### Code Quality

- **Biome**: Fast formatter and linter
- **ESLint**: Additional linting
- **Type Checking**: Comprehensive type checking

#### Testing

- **Vitest**: Fast unit testing
- **Integration Tests**: Full integration test suite
- **E2E Tests**: End-to-end testing
- **Coverage Reports**: Test coverage tracking

#### Scripts & Automation

- **Database Scripts**: Reset, migrate, seed databases
- **Type Generation**: Generate types from schemas
- **Code Analysis**: Code quality analysis
- **Validation Scripts**: Pre-launch validation
- **Performance Testing**: Performance benchmarks
- **Security Testing**: Security validation

#### Documentation Tools

- **Docs Lifecycle**: Automated documentation management
- **Stale Detection**: Detect outdated documentation
- **Reference Validation**: Validate code references
- **Duplicate Detection**: Find duplicate documentation
- **Archive Management**: Archive old documentation
- **Accuracy Validation**: Validate documentation accuracy

### Infrastructure Features

#### Multi-tenancy

- **Tenants**: Multi-tenant support
- **Tenant Isolation**: Data isolation per tenant
- **Tenant Domains**: Custom domain per tenant

#### Rate Limiting

- **Rate Limit Tables**: Track rate limits
- **Failed Attempts**: Track failed login attempts
- **Automatic Cleanup**: Cleanup old rate limit data

#### Security

- **CORS**: Configurable CORS
- **CSRF**: CSRF protection
- **JWT**: JSON Web Token support
- **Password Validation**: Password strength requirements
- **Session Security**: Secure session management

#### Monitoring & Observability

- **Sentry Integration**: Error tracking
- **Health Checks**: Live and ready health endpoints
- **Logging**: Structured logging throughout
- **Performance Tracking**: Performance monitoring

#### Deployment

- **Vercel Support**: Vercel deployment configuration
- **Docker**: Docker Compose for services
- **Environment Detection**: Automatic environment detection
- **Standalone Builds**: Standalone Next.js builds

### Integration Features

#### MCP (Model Context Protocol)

- **Vercel MCP**: Vercel integration via MCP
- **Stripe MCP**: Stripe integration via MCP
- **Neon MCP**: Neon database integration via MCP
- **Supabase MCP**: Supabase integration via MCP
- **Playwright MCP**: Playwright testing via MCP
- **Next Devtools MCP**: Next.js devtools via MCP

#### External Services

- **Stripe**: Payment processing
- **Supabase**: Database and auth services
- **Neon**: Serverless Postgres
- **Vercel**: Deployment and storage
- **Electric SQL**: Real-time sync

### Developer Experience

#### Type Safety

- **Full TypeScript**: 100% TypeScript coverage
- **Generated Types**: Auto-generated types from schemas
- **Type Inference**: Automatic type inference
- **Strict Mode**: TypeScript strict mode enabled

#### Developer Tools

- **Hot Reload**: Fast refresh in development
- **Type Checking**: Real-time type checking
- **Linting**: Real-time linting
- **Formatting**: Auto-formatting with Biome

#### Monorepo Features

- **pnpm Workspaces**: pnpm workspace management
- **Turborepo**: Fast monorepo builds
- **Shared Packages**: Reusable package system
- **Workspace Protocol**: Internal package linking

### Configuration Files

#### RevealUI Config

- **Shared Config**: Root-level shared configuration
- **Environment Overrides**: Environment-specific configs
- **CMS Config**: CMS-specific configuration
- **Web Config**: Web app configuration

#### Build Configs

- **Next.js Config**: Next.js configuration
- **Vite Config**: Vite configuration
- **Tailwind Config**: Tailwind CSS configuration
- **TypeScript Config**: TypeScript configuration
- **Turbo Config**: Turborepo configuration

---

## Framework Architecture

### Project Structure

```
revealui/
├── apps/
│   ├── cms/              # Next.js 16 CMS application
│   │   ├── src/
│   │   │   ├── app/      # Next.js app directory (routes)
│   │   │   ├── lib/      # CMS-specific code
│   │   │   └── components/  # CMS components
│   │   └── revealui.config.ts  # CMS configuration
│   └── web/              # RevealUI web application
│       ├── src/
│       │   ├── pages/    # Page routes
│       │   └── components/  # React components
│       └── vite.config.ts
├── packages/
│   ├── revealui/         # Core CMS framework
│   │   ├── src/
│   │   │   ├── core/     # Core CMS functionality
│   │   │   ├── client/   # Client-side code
│   │   │   └── types/    # TypeScript types
│   ├── db/               # Database schemas (Drizzle ORM)
│   ├── schema/           # Zod validation schemas
│   ├── presentation/     # Shared UI components
│   ├── services/         # External services (Stripe, Supabase)
│   └── ai/               # AI/memory system
├── docs/                 # Documentation
├── scripts/              # Utility scripts
└── package.json          # Root package configuration
```

### Key Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 | UI library with Server Components |
| **Framework** | Next.js 16 | SSR/SSG framework for CMS |
| **Styling** | Tailwind CSS v4 | Utility-first CSS framework |
| **CMS** | @revealui/core | Native headless CMS |
| **Database** | NeonDB Postgres | PostgreSQL database hosting |
| **ORM** | Drizzle ORM | Type-safe database queries |
| **Storage** | Vercel Blob | Media file storage |
| **Auth** | RevealUI Auth | Session-based authentication |
| **Payments** | Stripe | Payment processing |
| **TypeScript** | TypeScript 5.9 | Type safety throughout |

### How It Works

1. **CMS (Next.js App)**: `apps/cms` is a Next.js application that provides the admin interface and API endpoints
2. **Content Management**: Content is stored in NeonDB Postgres using Drizzle ORM
3. **Media Storage**: Images and files are stored in Vercel Blob Storage
4. **API**: REST API endpoints in `apps/cms/src/app/api/` handle content operations
5. **Frontend**: The web app (`apps/web`) or any frontend can consume the API

### Core Concepts

#### Collections

Collections are like database tables. Common collections include:
- **Users** - User accounts and authentication
- **Posts** - Blog posts or articles
- **Pages** - Static pages
- **Media** - Uploaded images and files
- **Categories** - Content categorization

#### Fields

Fields define what data a collection can store. Common field types:
- **Text** - Single-line text
- **Textarea** - Multi-line text
- **Rich Text** - Formatted text with Lexical editor
- **Number** - Numeric values
- **Date** - Date/time values
- **Relationship** - Links to other collections
- **Upload** - File/media uploads
- **JSON** - Structured JSON data

#### Access Control

RevealUI supports role-based access control:
- **Super Admin** - Full system access
- **Admin** - Collection and content management
- **User** - Basic access

#### API Access

Content is accessible via REST API:
- `GET /api/posts` - List all posts
- `GET /api/posts/:id` - Get specific post
- `POST /api/posts` - Create new post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

---

## Third-Party Integrations

### Stripe Payment Integration

#### Architecture

```
Frontend → CMS API → Stripe API
    ↓
Stripe Webhooks → CMS Webhook Handler → Database
```

#### Components

**Located in:** `packages/services/src/`

1. **Stripe Client** (`stripe/stripeClient.ts`)
   - Configured Stripe SDK instance
   - Uses `STRIPE_SECRET_KEY` from environment

2. **Webhook Handler** (`api/webhooks/index.ts`)
   - Receives Stripe webhook events
   - Verifies webhook signatures
   - Processes relevant events

3. **Payment Utilities** (`api/utils.ts`)
   - `createPaymentIntent` - Creates Stripe payment intents
   - `createCheckoutSession` - Creates checkout sessions
   - `manageSubscriptionStatusChange` - Updates subscription status
   - `upsertProductRecord` - Syncs products from Stripe
   - `upsertPriceRecord` - Syncs prices from Stripe

#### Supported Events

```typescript
const relevantEvents = new Set([
  "product.created",
  "product.updated",
  "price.created",
  "price.updated",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
])
```

#### Configuration

**Environment Variables:**
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_IS_TEST_KEY=true
```

**RevealUI CMS Collections:**
- `Products` - Synced with Stripe products
- `Prices` - Synced with Stripe prices
- `Orders` - Customer orders
- `Subscriptions` - Customer subscriptions

#### Usage Example

```typescript
// Create checkout session
const response = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    price: { id: 'price_xxx' },
    quantity: 1,
    metadata: { customField: 'value' }
  })
})

const { sessionId } = await response.json()

// Redirect to Stripe Checkout
const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY)
await stripe.redirectToCheckout({ sessionId })
```

#### Security Considerations

- ✅ Webhook signatures verified
- ✅ Prices fetched from Stripe API (not client-provided)
- ✅ Customer IDs validated
- ⚠️ Ensure webhook secret properly configured

### Supabase Database Integration

#### Architecture

```
RevealUI CMS → Drizzle ORM (Neon HTTP) → Supabase Postgres (Transaction Pooling)
```

#### Configuration

**Located in:** `revealui.config.ts`

```typescript
import { universalPostgresAdapter } from "@revealui/core/database"

export default buildConfig({
  db: universalPostgresAdapter({
    connectionString: process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI || "",
  }),
})
```

#### Connection String: Transaction Pooling (Recommended)

For Next.js serverless environments, use **Transaction Pooling** (port 6543):

**Why Transaction Pooling?**
- ✅ Ideal for serverless/edge functions (many transient connections)
- ✅ Works automatically with `@neondatabase/serverless` (no prepared statements needed)
- ✅ Prevents connection exhaustion in high-concurrency scenarios
- ✅ Supports both IPv4 and IPv6

#### Environment Variables

```env
# Supabase Client (for auth, real-time, storage)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Database Connection - Transaction Pooling (port 6543)
POSTGRES_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres?sslmode=require

# Alternative (using pooler endpoint)
# POSTGRES_URL=postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require

# Legacy fallback
SUPABASE_DATABASE_URI=postgresql://postgres:xxx@db.xxx.supabase.co:6543/postgres
```

**Important Notes:**
- Use port **6543** for transaction pooling (not 5432)
- Get the connection string from Supabase Dashboard → Settings → Database → Connection Pooling → Transaction mode
- The Neon HTTP driver automatically works with transaction pooling (no `prepare: false` needed)

**Reference:** [Supabase Drizzle Connection Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-drizzle)

#### Database Schema

RevealUI CMS automatically creates and manages database schema:
- Tables for each collection
- Indexes on queried fields
- Relationship foreign keys
- Version history tables (for drafts)

#### Client Usage

**Server-side Supabase Client:**
```typescript
// packages/services/src/supabase/utils/server.ts
import { createServerClient } from '@supabase/ssr'

const supabase = createServerClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { cookies: /* cookie handling */ }
)
```

### Cloud Storage Integration

#### Current Setup

**Cloudinary** for media storage:
- Configured in CSP (`apps/cms/csp.js`)
- Image domains in `next.config.mjs`

#### RevealUI CMS Media Collection

**Located in:** `apps/cms/src/lib/collections/Media/index.ts`

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    // Upload configuration
    staticURL: '/media',
    mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
  },
  fields: [
    // Media fields
  ],
}
```

#### Vercel Blob Storage (Alternative)

To switch to Vercel Blob Storage:

1. Configure in `revealui.config.ts`:
   ```typescript
   import { vercelBlobStorage } from '@revealui/core/storage'

   plugins: [
     vercelBlobStorage({
       collections: {
         media: true,
       },
       token: process.env.BLOB_READ_WRITE_TOKEN || '',
     }),
   ]
   ```

2. Add environment variable:
   ```env
   BLOB_READ_WRITE_TOKEN=vercel_blob_xxx
   ```

### ElectricSQL Integration

#### Overview

ElectricSQL enables local-first real-time sync for agent context, memories, and conversations.

**Important**: ElectricSQL is **NOT used for core RevealUI collections**. It is only used for agent-related tables:
- `agent_contexts`
- `agent_memories`
- `agent_conversations`

Core RevealUI collections (users, posts, pages, etc.) use standard Drizzle ORM with PostgreSQL.

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RevealUI Architecture                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Core Collections │         │ Agent Tables     │     │
│  │  (Posts, Pages,   │         │ (Contexts,       │     │
│  │   Users, etc.)    │         │  Memories)       │     │
│  └──────────────────┘         └──────────────────┘     │
│         │                               │                │
│         │                               │                │
│         ▼                               ▼                │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Drizzle ORM +   │         │  ElectricSQL +   │     │
│  │  PostgreSQL      │         │  PostgreSQL      │     │
│  │  (Direct)        │         │  (Synced)        │     │
│  └──────────────────┘         └──────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Features

- ✅ Cross-tab synchronization
- ✅ Cross-session persistence
- ✅ Real-time updates via subscriptions
- ✅ Offline-first support
- ✅ TypeScript type safety

#### Setup

See [INTEGRATIONS.md](./INTEGRATIONS.md) for complete setup instructions.

### Other Integrations

- **Email Integration (SMTP)** - Email templates and notifications
- **YouTube API Integration** - Fetch video data for content
- **Reveal UI Framework Integration** - Custom UI framework
- **RevealUI CMS Plugins** - Form builder, nested docs, redirects
- **Localization** - Multi-locale support
- **Custom Hooks** - RevealUI CMS hooks system
- **Content Security Policy (CSP)** - Security headers and policies
- **Vercel Deployment Integration** - Deployment configuration
- **Monitoring & Logging** - Sentry error tracking, health checks

For complete integration details, see [INTEGRATIONS.md](./INTEGRATIONS.md).

---

## Type System

### Overview

The RevealUI type system extends base types from `@revealui/contracts/cms` with RevealUI-specific features.

### Import Paths

All types are available from `@revealui/core/types`:

```typescript
// Unified export (all types)
import type { Config, Page, Post, User } from '@revealui/core/types'

// Specific categories
import type { Post } from '@revealui/core/types/cms'
import type { User } from '@revealui/core/types/schema'
import type { RevealConfig } from '@revealui/core/types/core'
import type { Database } from '@revealui/core/types/generated'
```

### Architecture

#### Base Types (from @revealui/contracts/cms)

- **CollectionConfig**: Base collection configuration with `slug` and `fields` properties
- **Field**: Base field configuration with `type`, `name`, `label`, `required`, etc.
- **GlobalConfig**: Base global configuration

#### Extended Types (this package)

- **RevealCollectionConfig**: Extends `CollectionConfig` with RevealUI hooks
- **RevealUIField**: Extends `Field` with RevealUI-specific features
- **RevealGlobalConfig**: Extends `GlobalConfig` with RevealUI hooks

### Type Definitions

#### RevealCollectionConfig

```typescript
export type RevealCollectionConfig = CollectionConfig & {
  hooks?: RevealCollectionHooks
}
```

**Key Properties** (inherited from `CollectionConfig`):
- `slug: string` - Collection identifier
- `fields: Field[]` - Array of field configurations

**Usage**:
```typescript
const collection: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    { type: 'text', name: 'title' }
  ],
  hooks: {
    afterChange: [async (args) => { /* ... */ }]
  }
}

// TypeScript correctly infers these properties:
const slug = collection.slug // string
const fields = collection.fields // Field[]
```

#### RevealUIField

```typescript
export type RevealUIField = Field & {
  revealUI?: {
    searchable?: boolean
    auditLog?: boolean
    tenantScoped?: boolean
    permissions?: string[]
    validation?: RevealUIValidationRule[]
  }
}
```

**Key Properties** (inherited from `Field`):
- `type: FieldType` - Field type (text, number, etc.)
- `name?: string` - Field name
- `label?: string | false | unknown` - Field label
- `required?: boolean` - Whether field is required

**Usage**:
```typescript
const field: RevealUIField = {
  type: 'text',
  name: 'title',
  label: 'Title',
  required: true,
  revealUI: {
    searchable: true
  }
}

// TypeScript correctly infers these properties:
const type = field.type // FieldType
const name = field.name // string | undefined
const label = field.label // string | false | unknown
const required = field.required // boolean | undefined
```

### Why Intersection Types?

We use intersection types (`&`) instead of `extends` interfaces because:

1. **Better Type Inference**: Intersection types preserve all properties from base types, ensuring TypeScript can infer properties correctly even when base types use `Omit` utility types.

2. **No Property Loss**: When base types use `Omit<BaseType, 'keys'>`, extending with `interface` can cause TypeScript to lose track of omitted properties. Intersection types merge all properties correctly.

3. **Consistency**: All extended types use the same pattern, making the codebase easier to understand and maintain.

### Type Safety

All types are fully type-safe:
- No type assertions (`as`) should be needed in normal usage
- IDE autocomplete works correctly for all properties
- Type errors are caught at compile time
- All properties from base types are properly inferred

---

## Payment Processing

### Stripe Integration

RevealUI uses Stripe for payment processing with comprehensive webhook handling and database synchronization.

#### Architecture

```
Frontend → CMS API → Stripe API
    ↓
Stripe Webhooks → CMS Webhook Handler → Database
```

#### Supported Payment Methods

- Credit/Debit Cards
- Digital Wallets (Apple Pay, Google Pay)
- Bank Transfers
- Subscriptions (recurring payments)

#### Features

1. **Checkout Sessions**
   - Secure payment processing
   - Customer portal for subscriptions
   - Automatic tax calculation
   - Discount codes and coupons

2. **Webhook Handling**
   - Real-time event processing
   - Signature verification
   - Product/price synchronization
   - Subscription lifecycle management

3. **Database Integration**
   - Automatic product sync
   - Subscription status updates
   - Order tracking
   - Payment history

#### Setup

See [PAYMENTS.md](./PAYMENTS.md) for complete setup instructions including:
- Stripe account configuration
- Webhook setup
- Environment variables
- Testing with test mode

#### Security

- ✅ Webhook signature verification
- ✅ Server-side price validation
- ✅ Secure customer ID handling
- ✅ PCI compliance (through Stripe)

For detailed payment integration guide, see [PAYMENTS.md](./PAYMENTS.md).

---

## RevealUI Theme System

### Overview

The RevealUI theme provides a comprehensive design system with pre-built components for creating beautiful, consistent user interfaces.

### Theme Components

#### Base Elements

Located in: `apps/cms/src/components/revealui/elements/`

**Button Components**:
```typescript
import { ButtonLink, PlainButtonLink, SoftButtonLink } from '@/components/revealui/elements'

// Primary button
<ButtonLink href="/page" size="lg">Get Started</ButtonLink>

// Secondary button
<SoftButtonLink href="/page">Learn More</SoftButtonLink>

// Text button
<PlainButtonLink href="/page">View Details</PlainButtonLink>
```

**Layout Components**:
```typescript
import { Container, Section } from '@/components/revealui/elements'

<Section>
  <Container>
    {/* Your content with consistent max-width and padding */}
  </Container>
</Section>
```

**Typography Components**:
```typescript
import { Heading, Text, Eyebrow, Subheading } from '@/components/revealui/elements'

<Eyebrow>Featured</Eyebrow>
<Heading>Main Title</Heading>
<Subheading>Subtitle</Subheading>
<Text size="lg">Body text with consistent styling</Text>
```

#### Section Components

Located in: `apps/cms/src/components/revealui/sections/`

**Navbar**:
- Sticky header
- Centered logo
- Mobile menu with dialog
- Responsive design
- Dark mode support

**Footer**:
- Newsletter signup form
- Link categories
- Social media icons
- Responsive grid layout

**Hero Sections**:
- Left-aligned with demo
- Centered with photo
- Announcement badges
- Call-to-action buttons

**Stats Section**:
- Large stat display
- Graph visualization
- Responsive grid

### Design System

#### Colors

Use Mist colors in Tailwind classes:

```typescript
// Backgrounds
<div className="bg-mist-100 dark:bg-mist-950">

// Text
<p className="text-mist-950 dark:text-white">

// Borders
<div className="border-mist-200 dark:border-mist-800">
```

**Available Colors**: `mist-50`, `mist-100`, `mist-200`, `mist-300`, `mist-400`, `mist-500`, `mist-600`, `mist-700`, `mist-800`, `mist-900`, `mist-950`

#### Typography

**Display Font** (Mona Sans):
```typescript
<h1 className="font-display">Display Heading</h1>
```

**Body Font** (Inter):
```typescript
<p className="font-sans">Body text</p>
```

### Integration with CMS

The theme is designed to work seamlessly with CMS data. Components accept CMS content as props and render with consistent styling.

**Example**:
```typescript
import { NavbarWithLinksActionsAndCenteredLogo } from '@/components/revealui/sections'

<NavbarWithLinksActionsAndCenteredLogo
  links={
    <>
      {header.navItems?.map((item, idx) => (
        <NavbarLink key={idx} href={getLinkUrl(item.link)}>
          {item.link.label}
        </NavbarLink>
      ))}
    </>
  }
  logo={<NavbarLogo href="/">Logo</NavbarLogo>}
  actions={<>...</>}
/>
```

For complete theme documentation, see [REVEALUI_THEME_USAGE_GUIDE.md](./REVEALUI_THEME_USAGE_GUIDE.md).

---

## Next Steps

### For New Users

1. **Read the Documentation**
   - [Quick Start Guide](./QUICK_START.md) - Quick reference
   - [Environment Variables Guide](../development/ENVIRONMENT_VARIABLES_GUIDE.md) - Complete env setup
   - [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) - Deploy to production

2. **Explore Examples**
   - [Basic Blog](../../examples/basic-blog/) - Simple blog example
   - [E-commerce](../../examples/e-commerce/) - Full e-commerce site
   - [Portfolio](../../examples/portfolio/) - Portfolio website

3. **Learn the Framework**
   - [Component Library](../../packages/core/README.md) - Available components
   - [API Documentation](../reference/) - API reference
   - [Architecture Guide](../development/) - System architecture

### Development Resources

- **Code Style**: [LLM Code Style Guide](../development/LLM_CODE_STYLE_GUIDE.md)
- **Testing**: [Testing Strategy](../development/testing/TESTING_STRATEGY.md)
- **Contributing**: [Contributing Guide](../../CONTRIBUTING.md)

### Deployment

When ready to deploy:

1. **Vercel** (Recommended)
   - [CI/CD Guide](../development/CI_CD_GUIDE.md)
   - [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)

2. **Self-Hosting**
   - [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) - Has self-hosting instructions

### Community & Support

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) - Ask questions
- 🐛 [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues) - Report bugs
- 📧 [Email Support](mailto:support@revealui.com) - Get help

---

## Related Documentation

- [Quick Start](./QUICK_START.md) - Get started in 5 minutes
- [CMS Guide](./CMS_GUIDE.md) - Complete CMS documentation
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) - Production deployment
- [Environment Setup](./ENVIRONMENT_SETUP.md) - Development environment setup
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Welcome to RevealUI Framework!** 🎉

**Last Updated**: January 2025
**Version**: 0.1.0
**Maintainer**: RevealUI Team
