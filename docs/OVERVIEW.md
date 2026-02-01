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
8. [CMS Guide](#cms-guide)

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
- [Project Status](./PROJECT_STATUS.md)
- [Project Roadmap](./PROJECT_ROADMAP.md)

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

## CMS Guide

This comprehensive guide covers everything you need to know about using the RevealUI CMS, from frontend connection to content management and blog creation.

### CMS Guide Table of Contents

1. [CMS Overview](#cms-overview)
2. [Frontend Connection](#frontend-connection)
   - [CMS API Endpoints](#cms-api-endpoints)
   - [Environment Configuration](#environment-configuration)
   - [Creating API Client](#creating-api-client)
   - [Creating Fetch Functions](#creating-fetch-functions)
   - [Testing the Connection](#testing-the-connection)
3. [Content Management](#content-management)
   - [Collections Overview](#collections-overview)
   - [Content Creation Workflow](#content-creation-workflow)
   - [Content Best Practices](#content-best-practices)
4. [Blog Management](#blog-management)
   - [Accessing Admin Dashboard](#accessing-admin-dashboard)
   - [Creating Blog Posts](#creating-blog-posts)
   - [Publishing Posts](#publishing-posts)
   - [Managing Posts](#managing-posts)
5. [Content Examples](#content-examples)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference](#quick-reference)

---

### CMS Overview

Your RevealUI project consists of:
- **CMS App** (`apps/cms`): Next.js 16 app with RevealUI CMS backend
- **Frontend App** (`apps/web`): React 19 app (Vite-based) that consumes CMS data

The CMS provides a REST API for content delivery and includes collections for:
- **Pages**, **Posts** (blog), **Media**, **Heros**, **Cards**, **Contents**, **Events**, **Banners**
- **Products**, **Prices**, **Categories**, **Tags**, **Orders**, **Subscriptions**
- **Users**, **Tenants**, **Layouts**, **Videos**

---

### Frontend Connection

#### CMS API Endpoints

The CMS exposes a REST API at `/api/[...slug]/route.ts` using `handleRESTRequest` from `@revealui/core/api/rest`.

**Collections API**

```
GET    /api/collections/{collection}           - List all documents
GET    /api/collections/{collection}/{id}      - Get single document
POST   /api/collections/{collection}           - Create document
PATCH  /api/collections/{collection}/{id}      - Update document
DELETE /api/collections/{collection}/{id}      - Delete document
```

**Globals API**

```
GET    /api/globals/{global}                   - Get global
PATCH  /api/globals/{global}                   - Update global
```

**Query Parameters**

- `depth` - Relationship depth (e.g., `?depth=2`)
- `where` - Filter conditions (JSON)
- `limit` - Results per page
- `page` - Page number
- `sort` - Sort field
- `locale` - Locale for i18n

**Testing API Endpoints**

You can test the CMS API directly:

```bash
# Get all pages
curl http://localhost:4000/api/collections/pages

# Get a specific page
curl http://localhost:4000/api/collections/pages/{id}

# Get with filters
curl "http://localhost:4000/api/collections/posts?where[status][equals]=published&limit=10"

# Get with depth (relationships)
curl "http://localhost:4000/api/collections/pages?depth=2"
```

#### Environment Configuration

**CMS App Environment Variables**

Create `apps/cms/.env.local`:

```env
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
REVEALUI_WHITELISTORIGINS=http://localhost:3000,http://localhost:5173
REVEALUI_SECRET=your-secret-key
```

**Frontend App Environment Variables**

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_CMS_URL=http://localhost:4000
# OR
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
```

**CORS Configuration**

The CMS has CORS handling in:
- `apps/cms/src/proxy.ts` - Defines allowed origins
- `apps/cms/revealui.config.ts` - `cors` and `csrf` arrays

Ensure your frontend URL is in `REVEALUI_WHITELISTORIGINS`.

#### Creating API Client

Create a base API client function in your frontend app.

**File**: `apps/web/src/lib/api/client.ts`

```typescript
const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL || process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000';

export async function fetchFromCMS<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${CMS_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`CMS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

#### Creating Fetch Functions

Create fetch functions for each collection you need to access.

**fetchMainInfos**

**File**: `apps/web/src/lib/api/fetchMainInfos.ts`

```typescript
import { fetchFromCMS } from './client';

export interface MainInfo {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
}

export default async function fetchMainInfos(): Promise<MainInfo[]> {
  const response = await fetchFromCMS<{
    docs: MainInfo[];
    totalDocs: number;
  }>('/api/collections/contents?where[type][equals]=main-info&depth=1');

  return response.docs || [];
}
```

**fetchVideos**

**File**: `apps/web/src/lib/api/fetchVideos.ts`

```typescript
import { fetchFromCMS } from './client';

export interface Video {
  url: string;
}

export default async function fetchVideos(): Promise<Video[]> {
  const response = await fetchFromCMS<{
    docs: Array<{ url?: string; file?: { url?: string } }>;
  }>('/api/collections/videos?depth=1');

  return response.docs.map((doc) => ({
    url: doc.url || doc.file?.url || '',
  })).filter((v) => v.url);
}
```

**fetchCard**

**File**: `apps/web/src/lib/api/fetchCard.ts`

```typescript
import { fetchFromCMS } from './client';

export interface CardData {
  name: string;
  image: string;
  label: string;
  cta: string;
  href: string;
  loading?: 'eager' | 'lazy';
}

export default async function fetchCard(): Promise<CardData[]> {
  const response = await fetchFromCMS<{
    docs: CardData[];
  }>('/api/collections/cards?depth=1');

  return response.docs || [];
}
```

**fetchHero**

**File**: `apps/web/src/lib/api/fetchHero.ts`

```typescript
import { fetchFromCMS } from './client';

export interface HeroData {
  id: number;
  image: string;
  videos: string;
  altText: string;
  href: string;
}

export default async function fetchHero(): Promise<HeroData[]> {
  const response = await fetchFromCMS<{
    docs: HeroData[];
  }>('/api/collections/heros?depth=1');

  return response.docs || [];
}
```

**fetchEvents**

**File**: `apps/web/src/lib/api/fetchEvents.ts`

```typescript
import { fetchFromCMS } from './client';

export interface EventData {
  title: string;
  name: string;
  description: string;
  image: string;
  alt: string;
}

export default async function fetchEvents(): Promise<EventData[]> {
  const response = await fetchFromCMS<{
    docs: EventData[];
  }>('/api/collections/events?depth=1');

  return response.docs || [];
}
```

**fetchBanner**

**File**: `apps/web/src/lib/api/fetchBanner.ts`

```typescript
import { fetchFromCMS } from './client';

export interface BannerData {
  title: string;
  description: string;
  image: string;
  link: string;
  alt: string;
}

export default async function fetchBanner(): Promise<BannerData[]> {
  const response = await fetchFromCMS<{
    docs: BannerData[];
  }>('/api/collections/banners?depth=1');

  return response.docs || [];
}
```

**Updating Component Imports**

Update your components to import from the new location:

**In `apps/web/src/components/Home/Main.tsx`**:

```typescript
// Change from:
import fetchMainInfos from "revealui/core/targets/http/fetchMainInfos";

// To:
import fetchMainInfos from "@/lib/api/fetchMainInfos";
// Or using relative paths:
import fetchMainInfos from "../../lib/api/fetchMainInfos";
```

Apply the same pattern to:
- `apps/web/src/components/Home/Header.tsx`
- `apps/web/src/components/Home/Card.tsx`
- `apps/web/src/components/Home/Hero.tsx`
- `apps/web/src/components/Home/Section.tsx`
- `apps/web/src/components/Home/Content.tsx`

#### Testing the Connection

1. Start the CMS: `cd apps/cms && pnpm dev` (runs on port 4000)
2. Start the frontend: `cd apps/web && pnpm dev` (runs on port 5173 or 3000)
3. Check browser console for API errors
4. Verify data is loading in components

---

### Content Management

#### Collections Overview

Each collection serves a specific purpose on the frontend:

1. **Contents** → Main content sections with images (used by `HomeMain`)
2. **Cards** → Feature cards with CTAs (used by `HomeCard`)
3. **Heros** → Large hero sections with images/videos (used by `HomeHero`)
4. **Events** → Event listings with descriptions (used by `HomeSection`)
5. **Banners** → Promotional banners with stats (used by `HomeContent`)

**Home Page Content Flow**

1. **Hero Section** (from Heros) - Large visual impact
2. **Card Section** (from Cards) - Quick navigation
3. **Events Section** (from Events) - Featured content
4. **Main Content** (from Contents) - Detailed information
5. **Banner Section** (from Banners) - Call-to-action with stats

**Recommended Entry Counts**

- **Contents**: 1-3 entries
- **Cards**: 2-4 entries
- **Heros**: 1-2 entries
- **Events**: 1-3 entries
- **Banners**: 1 entry (only first is used)

#### Content Creation Workflow

**Step 1: Upload Media First**

1. Go to `http://localhost:4000/admin`
2. Navigate to **Media** collection
3. Upload all images you'll need:
   - Hero images (1920x1080 or larger)
   - Card images (800x600 or similar)
   - Event images (1200x800)
   - Banner images (1920x600)
4. Note the media IDs or names for reference

**Step 2: Create Content Entries**

1. **Contents**: Create 1-3 entries for main sections
2. **Cards**: Create 2-4 cards for different features
3. **Heros**: Create 1-2 hero sections
4. **Events**: Create 1-3 event entries
5. **Banners**: Create 1-2 banner entries

**Step 3: Link Media**

- When creating entries, select the uploaded media for image fields
- Ensure images are properly linked (not just text URLs)

**Step 4: Verify Frontend**

- Visit `http://localhost:3000` or `http://localhost:5173`
- Check that components display CMS data
- Verify images load correctly
- Test links and navigation

#### Collection Field Requirements

**Contents Collection**

**Component**: `HomeMain`
**Fetch Function**: `fetchMainInfos()`
**CMS Collection**: `contents`

**Required Fields**:
- `name` (text, required) - Used as `title`
- `description` (text) - Used for `subtitle` and `description`
- `image` (upload/relationship) - Main image

**Notes**:
- The `description` field is split: first sentence becomes `subtitle`, full text becomes `description`
- Multiple entries will be displayed as separate sections

**Cards Collection**

**Component**: `HomeCard`
**Fetch Function**: `fetchCard()`
**CMS Collection**: `cards`

**Required Fields**:
- `name` (text) - Card title
- `image` (upload/relationship) - Card image
- `label` (text) - Subtitle/label text
- `cta` (text) - Call-to-action button text
- `href` (text) - Link destination
- `loading` (radio: 'eager' or 'lazy') - Image loading strategy

**Notes**:
- Use `loading: "eager"` for above-the-fold cards
- Use `loading: "lazy"` for cards that may be below the fold
- Cards are displayed prominently, so use high-quality images

**Heros Collection**

**Component**: `HomeHero`
**Fetch Function**: `fetchHero()`
**CMS Collection**: `heros`

**Required Fields**:
- `href` (text) - Link destination (usually YouTube channel or video)
- `altText` (text) - Image alt text
- `image` (upload/relationship) - Hero image
- `video` (text) - Video URL

**Notes**:
- Hero images should be large and high-quality (recommended: 1920x1080 or larger)
- Video can be a YouTube URL or uploaded media file
- Multiple heroes will be displayed in sequence

**Events Collection**

**Component**: `HomeSection`
**Fetch Function**: `fetchEvents()`
**CMS Collection**: `events`

**Required Fields**:
- `title` (text) - Main heading (e.g., "EVENTS")
- `name` (text) - Subheading/event name
- `description` (text) - Event description
- `image` (upload/relationship) - Event image
- `alt` (text) - Image alt text

**Notes**:
- `title` is displayed as large heading (text-6xl to text-7xl)
- Images should be engaging and action-oriented

**Banners Collection**

**Component**: `HomeContent`
**Fetch Function**: `fetchBanner()`
**CMS Collection**: `banners`

**Required Fields**:
- `title` (text) - Banner heading
- `description` (text) - Banner description
- `image` (upload/relationship) - Banner image
- `link` (text) - Link URL
- `alt` (text) - Image alt text

**Notes**:
- Banner component displays stats (hardcoded in component)
- Only the first banner from the array is used

#### Content Best Practices

**Images**

- **Hero Images**: 1920x1080 or larger, high quality
- **Card Images**: 800x600 or similar, optimized for web
- **Event Images**: 1200x800, action-oriented
- **Banner Images**: 1920x600, wide format

**Text Content**

- Keep titles concise (3-5 words)
- Descriptions should be 1-3 sentences
- Use clear, action-oriented CTAs
- Ensure alt text is descriptive

**Organization**

- Use consistent naming conventions
- Add dates/timestamps for events
- Organize by priority (most important first)
- Keep content fresh and updated

---

### Blog Management

#### Accessing Admin Dashboard

**Step 1: Start the Development Server**

```bash
# From the project root
pnpm dev
```

The CMS app will start on `http://localhost:4000`

**Step 2: Navigate to Admin Dashboard**

1. Open your browser and go to: **`http://localhost:4000/admin`**
2. You'll see the RevealUI Admin Dashboard with:
   - **Collections** card showing available collections (including "posts")
   - **Globals** card showing global settings
   - **System Status** indicator

**Step 3: Access the Posts Collection**

1. **Click on "posts"** in the Collections card on the dashboard
2. You'll see the Posts collection list view with:
   - Table showing all posts (if any exist)
   - "Create New" button in the top right
   - Edit/Delete buttons for each post
   - Pagination controls if you have many posts

#### Creating Blog Posts

**Step 1: Click "Create New"**

1. In the Posts collection view, click the **"Create New"** button (top right)
2. The post editor will open

**Step 2: Fill in Post Details**

**Required Fields**

1. **Title** (Text field)
   - Enter your blog post title
   - Example: "Getting Started with RevealUI"

2. **Content** (Rich Text Editor)
   - Located in the "Content" tab
   - Full-featured Lexical editor with:
     - Headings (H1-H4)
     - Bold, Italic, formatting
     - Lists (ordered/unordered)
     - Links
     - Code blocks
     - Media blocks (images/videos)
     - Banner blocks
   - Write your blog post content here

3. **Slug** (Auto-generated from title)
   - Automatically created from the title
   - Can be edited if needed
   - Used in the URL: `/posts/your-slug`

**Optional Fields (Sidebar)**

1. **Published At** (Date)
   - Set when the post should be published
   - Leave empty for draft
   - Auto-filled when you publish

2. **Authors** (Relationship)
   - Select one or more authors from Users collection
   - Links to user accounts

3. **Categories** (Relationship)
   - Select categories to organize posts
   - Create categories first in the Categories collection

4. **Related Posts** (Relationship)
   - Link to other related blog posts
   - Helps with content discovery

**SEO Tab**

1. **Meta Image** (Relationship)
   - Select an image from Media collection for social sharing

2. **Meta Title** (Text)
   - Custom SEO title (defaults to post title)

3. **Meta Description** (Textarea)
   - SEO description for search engines

**Step 3: Save Your Post**

1. Click **"Save"** button at the bottom
2. Your post will be saved as a **draft** by default
3. You'll be redirected back to the Posts list

#### Rich Text Editor Features

**Text Formatting**

- **Bold** (Ctrl/Cmd + B)
- **Italic** (Ctrl/Cmd + I)
- **Underline**
- **Strikethrough**
- **Code** (inline)

**Headings**

- H1, H2, H3, H4
- Use toolbar or keyboard shortcuts

**Lists**

- Ordered lists (numbered)
- Unordered lists (bullets)
- Nested lists

**Blocks**

- **Banner Block**: Hero sections
- **Code Block**: Syntax-highlighted code
- **Media Block**: Images and videos

**Links**

- Internal links
- External links
- Link to other posts/pages

#### Publishing Posts

**Method 1: Set Published Date**

1. Edit your post
2. In the sidebar, set the **"Published At"** date to:
   - Current date/time for immediate publishing
   - Future date for scheduled publishing
3. Save the post

**Method 2: Using Draft Status**

The Posts collection supports draft/published workflow:
- **Draft**: Not visible to public
- **Published**: Visible on `/posts` page

To publish:
1. Edit the post
2. Set `_status` field to `"published"` (if available in UI)
3. Or set `publishedAt` date

#### Managing Posts

**Viewing All Posts**

1. Go to `/admin`
2. Click on **"posts"** collection
3. You'll see a table with:
   - Post titles
   - Slugs
   - Last updated dates
   - Edit/Delete buttons

**Editing a Post**

1. Click **"Edit"** button next to any post
2. Make your changes
3. Click **"Save"**

**Deleting a Post**

1. Click **"Delete"** button next to any post
2. Confirm the deletion
3. Post will be permanently removed

**Pagination**

- Posts are paginated (10 per page by default)
- Use Previous/Next buttons to navigate
- Page numbers show current position

**Viewing Your Blog on the Frontend**

**Blog Index Page**

**URL**: `http://localhost:4000/posts`

- Shows all published posts
- Paginated (12 posts per page)
- Displays post cards with:
  - Title
  - Excerpt
  - Featured image (if set)
  - Publication date
  - Author(s)

**Individual Post Page**

**URL**: `http://localhost:4000/posts/your-post-slug`

- Full post content
- Rich text formatting
- Related posts section (if configured)
- SEO metadata
- Author information

**Setting Up Categories**

Before creating posts, you may want to set up categories:

**Step 1: Access Categories Collection**

1. Go to `/admin`
2. Click on **"categories"** collection

**Step 2: Create a Category**

1. Click **"Create New"**
2. Fill in:
   - **Title**: Category name (e.g., "Tutorials", "News")
   - **Description**: Optional description
3. Click **"Save"**

**Step 3: Assign Categories to Posts**

1. When editing a post
2. Go to "Meta" tab
3. Select categories from the dropdown

**Blog Tips and Best Practices**

**SEO Optimization**

1. **Use Descriptive Titles**
   - Clear, keyword-rich titles
   - Keep under 60 characters

2. **Write Meta Descriptions**
   - 150-160 characters
   - Compelling summaries
   - Include keywords

3. **Add Featured Images**
   - High-quality images
   - Proper alt text
   - Optimized file sizes

**Content Organization**

1. **Use Categories**
   - Organize posts by topic
   - Helps readers find content
   - Improves navigation

2. **Link Related Posts**
   - Connect related content
   - Improves engagement
   - Helps SEO

3. **Set Publication Dates**
   - Schedule posts in advance
   - Maintain consistent publishing
   - Use for content planning

**Rich Text Editor Tips**

1. **Use Headings**
   - Structure content with H2, H3
   - Improves readability
   - Better SEO

2. **Add Media**
   - Break up text with images
   - Use media blocks for videos
   - Optimize images before upload

3. **Format Code**
   - Use code blocks for snippets
   - Syntax highlighting included
   - Improves readability

---

### Content Examples

Ready-to-use content examples for each collection. Copy and paste these into your CMS admin panel.

**Contents Collection Examples**

**Entry 1: Welcome Section**

**Name**:
```
Scrapyard
```

**Description**:
```
Welcome to the Scrapyard. The Scrapyard is a place where you can find all the latest news and updates from the Streetbeefs community. Join us for exciting events, watch amazing fights, and connect with fighters from around the world.
```

**Image**:
- Upload to Media first: `yardday_zkkuvn.jpg` or similar hero image
- Link the uploaded media here

**Entry 2: About Section**

**Name**:
```
About Streetbeefs
```

**Description**:
```
Streetbeefs is a community-driven platform for fighters and fans. We provide a safe space for combat sports enthusiasts to connect, compete, and grow. Whether you're a fighter or a spectator, experience the warrior's courage.
```

**Image**:
- Upload to Media first: Community or about image
- Link the uploaded media here

**Entry 3: Community Section**

**Name**:
```
Join Our Community
```

**Description**:
```
Connect with thousands of fighters and fans worldwide. Share your journey, learn from others, and be part of something bigger. Together we build a stronger combat sports community.
```

**Image**:
- Upload to Media first: Community gathering image
- Link the uploaded media here

**Cards Collection Examples**

**Entry 1: Media Card**

**Name**: `Scrapyard Records`
**Label**: `ScrapRecords Label`
**CTA**: `Check out all Media`
**Href**: `/media`
**Loading**: `eager`
**Image**: Upload `received_379940754080520_hzf7q1.jpg` or similar

**Entry 2: Events Card**

**Name**: `Upcoming Events`
**Label**: `Fight Night`
**CTA**: `View Schedule`
**Href**: `/events`
**Loading**: `lazy`
**Image**: Upload event or fight night image

**Entry 3: Fighters Card**

**Name**: `Meet the Fighters`
**Label**: `Top Competitors`
**CTA**: `Browse Fighters`
**Href**: `/fighters`
**Loading**: `lazy`
**Image**: Upload fighter profile or action image

**Entry 4: Videos Card**

**Name**: `Watch Fights`
**Label**: `Latest Videos`
**CTA**: `View Channel`
**Href**: `/videos`
**Loading**: `lazy`
**Image**: Upload video thumbnail or YouTube channel image

**Heros Collection Examples**

**Entry 1: Main Hero**

**Href**: `https://www.youtube.com/@streetbeefsScrapyard`
**Alt Text**: `Firechicken animated photo`
**Video**: `https://www.youtube.com/@streetbeefsScrapyard`
**Image**: Upload `firechicken_animated_photo_fj1xej.jpg` or similar hero image

**Entry 2: Featured Video Hero**

**Href**: `https://www.youtube.com/@streetbeefsScrapyard`
**Alt Text**: `Featured fight video thumbnail`
**Video**: `https://www.youtube.com/watch?v=VIDEO_ID`
**Image**: Upload video thumbnail image

**Events Collection Examples**

**Entry 1: Monthly Events**

**Title**: `EVENTS`
**Name**: `New Events Monthly`
**Description**: `Whether you are a fighter or a spectator, experience the warrior's courage. Join us every month for exciting fight nights, tournaments, and special events. Don't miss out on the action!`
**Alt**: `Monthly fight events`
**Image**: Upload `received_379940754080520_hzf7q1.jpg` or event image

**Entry 2: Championship Tournament**

**Title**: `TOURNAMENT`
**Name**: `Championship Series`
**Description**: `The biggest tournament of the year. Watch top fighters compete for the championship title. Don't miss out on this epic showdown. Experience the intensity, the passion, and the raw talent.`
**Alt**: `Championship tournament`
**Image**: Upload tournament or championship image

**Entry 3: Fight Night**

**Title**: `FIGHT NIGHT`
**Name**: `Weekly Matches`
**Description**: `Every Friday night, witness incredible matchups between skilled fighters. Experience the intensity, the passion, and the raw talent. Join us for an unforgettable evening of combat sports.`
**Alt**: `Weekly fight night`
**Image**: Upload fight night or ring image

**Banners Collection Examples**

**Entry 1: Welcome Banner**

**Heading**: `Welcome!`
**Subheading**: `Discover More`
**Description**: `Check out the latest stats and join our growing community of fighters and fans. Connect with thousands of members and be part of the action.`
**CTA**: `Join Now`
**Highlight**: `here is the highlight`
**Punctuation**: `.`
**Alt**: `Streetbeefs Scrapyard banner image`
**Link - Href**: `/about`
**Link - Text**: `Learn More`
**Stats**:
- Label: Subscribers, Value: 476K
- Label: Videos, Value: 1.9k
- Label: Views, Value: 180,430,351
- Label: Fighters, Value: 500+

**Image**: Upload `FB_IMG_1666183588935_zkdfmv.jpg` or banner image

**Entry 2: Community Banner**

**Heading**: `Join the Community`
**Subheading**: `Connect Today`
**Description**: `Connect with thousands of fighters and fans. Watch exclusive content and participate in events. Be part of something bigger.`
**CTA**: `Sign Up`
**Highlight**: `join thousands`
**Punctuation**: `!`
**Alt**: `Community banner`
**Link - Href**: `/join`
**Link - Text**: `Get Started`
**Stats**:
- Label: Members, Value: 50K+
- Label: Events, Value: 200+
- Label: Fights, Value: 5K+
- Label: Countries, Value: 50+

**Image**: Upload community or gathering image

**Quick Copy-Paste Templates**

**Contents Entry Template**

```
Name: [Your title]
Description: [First sentence becomes subtitle. Full description here.]
Image: [Link uploaded media]
```

**Cards Entry Template**

```
Name: [Card title]
Label: [Subtitle]
CTA: [Button text]
Href: [Link URL]
Loading: [eager or lazy]
Image: [Link uploaded media]
```

**Heros Entry Template**

```
Href: [YouTube or link URL]
Alt Text: [Image description]
Video: [Video URL]
Image: [Link uploaded media]
```

**Events Entry Template**

```
Title: [EVENTS, TOURNAMENT, etc.]
Name: [Event name]
Description: [Event description]
Alt: [Image alt text]
Image: [Link uploaded media]
```

**Banners Entry Template**

```
Heading: [Welcome!]
Subheading: [Discover More]
Description: [Banner description]
CTA: [Join Now]
Highlight: [highlight text]
Punctuation: [.]
Alt: [Image alt text]
Link Href: [/about]
Link Text: [Learn More]
Stats: [Add 4 stats with label and value]
Image: [Link uploaded media]
```

---

### Troubleshooting

**Frontend Connection Issues**

**CORS Errors**

**Problem**: Frontend can't access CMS API
**Solution**: Add frontend URL to `REVEALUI_WHITELISTORIGINS` in CMS `.env`

**404 Errors**

**Problem**: Collection not found
**Solution**: Check collection slug matches exactly (case-sensitive)

**Empty Results**

**Problem**: API returns empty `docs` array
**Solutions**:
- Check if data exists in CMS admin
- Verify collection access permissions
- Check `where` filters are correct

**Type Mismatches**

**Problem**: TypeScript errors in fetch functions
**Solution**: Match the actual CMS collection schema structure

**Content Display Issues**

**Images Not Displaying**

**Solutions**:
- Verify media is uploaded to Media collection
- Check that image relationship is properly linked
- Ensure image URLs are accessible
- Check browser console for 404 errors

**Content Not Showing**

**Solutions**:
- Verify entries are created in correct collections
- Check that required fields are filled
- Ensure fetch functions are working (check Network tab)
- Verify CORS is configured correctly

**Wrong Data Displayed**

**Solutions**:
- Check field names match expected structure
- Verify data mapping in fetch functions
- Check component prop types
- Review console for errors

**Blog Post Issues**

**Post Not Appearing on Frontend**

**Problem**: Post saved but not visible on `/posts`

**Solutions**:
1. Check `publishedAt` date is set
2. Ensure date is not in the future
3. Verify post `_status` is "published"
4. Check access control settings

**Rich Text Not Rendering**

**Problem**: Content appears as raw HTML

**Solutions**:
1. Ensure RichText component is used on frontend
2. Check content field type is `richText`
3. Verify Lexical editor is configured

**Images Not Loading in Posts**

**Problem**: Media blocks show broken images

**Solutions**:
1. Verify media uploaded to Media collection
2. Check Vercel Blob storage is configured
3. Ensure image URLs are correct
4. Check CORS settings

---

### Quick Reference

**Admin URLs**

- **Dashboard**: `/admin`
- **Posts Collection**: `/admin` → Click "posts"
- **Categories**: `/admin` → Click "categories"
- **Media**: `/admin` → Click "media"
- **Any Collection**: `/admin` → Click collection name

**Frontend URLs**

- **Blog Index**: `/posts`
- **Post Page**: `/posts/{slug}`
- **Paginated Posts**: `/posts/page/{pageNumber}`

**Keyboard Shortcuts (Rich Text Editor)**

- **Bold**: Ctrl/Cmd + B
- **Italic**: Ctrl/Cmd + I
- **Link**: Ctrl/Cmd + K
- **Code**: Ctrl/Cmd + `
- **Undo**: Ctrl/Cmd + Z
- **Redo**: Ctrl/Cmd + Shift + Z

**Quick Start Checklist**

General Content:
- [ ] Upload images to Media collection
- [ ] Create 1-3 Contents entries
- [ ] Create 2-4 Cards entries
- [ ] Create 1-2 Heros entries
- [ ] Create 1-3 Events entries
- [ ] Create 1 Banner entry
- [ ] Verify all images are linked
- [ ] Test frontend display
- [ ] Check mobile responsiveness
- [ ] Verify all links work

Blog Setup:
- [ ] Create categories (optional)
- [ ] Upload featured images to Media
- [ ] Create first blog post
- [ ] Add content with rich text editor
- [ ] Set published date
- [ ] Select categories and authors
- [ ] Add SEO metadata
- [ ] Preview post on frontend
- [ ] Publish post

**Complete Workflow Example**

**Creating a Blog Post**

1. **Navigate**: Go to `http://localhost:4000/admin`
2. **Click**: "posts" in Collections card
3. **Click**: "Create New" button
4. **Fill Title**: "My First Blog Post"
5. **Add Content**:
   - Click in content editor
   - Type: "Welcome to my blog!"
   - Add H2 heading: "Introduction"
   - Add paragraph text
   - Insert image using Media block
6. **Set Published Date**: Today's date
7. **Add Category**: Select "Tutorials" (if exists)
8. **Add Author**: Select your user account
9. **SEO Tab**:
   - Meta description: "My first blog post about..."
   - Upload featured image
10. **Click**: "Save"
11. **View**: Visit `http://localhost:4000/posts/my-first-blog-post`

**File Locations Reference**

**CMS Side (Already Configured)**

- `apps/cms/src/app/(backend)/api/[...slug]/route.ts` - API route handler
- `apps/cms/revealui.config.ts` - Collections configuration
- `apps/cms/src/proxy.ts` - CORS configuration
- `apps/cms/.env.local` - Environment variables

**Frontend Side (Need to Create/Modify)**

- `apps/web/src/lib/api/client.ts` - Base API client
- `apps/web/src/lib/api/fetchMainInfos.ts` - Fetch function
- `apps/web/src/lib/api/fetchVideos.ts` - Fetch function
- `apps/web/src/lib/api/fetchCard.ts` - Fetch function
- `apps/web/src/lib/api/fetchHero.ts` - Fetch function
- `apps/web/src/lib/api/fetchEvents.ts` - Fetch function
- `apps/web/src/lib/api/fetchBanner.ts` - Fetch function
- `apps/web/src/components/Home/*.tsx` - Update import paths
- `apps/web/.env.local` - Environment variables

**Blog Post Fields Reference**

**Content Tab**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | Text | Yes | Post title |
| `content` | Rich Text | Yes | Main post content with full editor |

**Meta Tab**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `relatedPosts` | Relationship | No | Link to related posts |
| `categories` | Relationship | No | Post categories |

**SEO Tab**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meta.image` | Relationship | No | Social sharing image |
| `meta.title` | Text | No | Custom SEO title |
| `meta.description` | Textarea | No | SEO description |

**Sidebar Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `publishedAt` | Date | No | Publication date |
| `authors` | Relationship | No | Post authors |
| `slug` | Text | Auto | URL-friendly identifier |

**CMS Guide Next Steps**

**Enhance Frontend Connection**

1. **Add error handling** - Consider adding retry logic, error boundaries
2. **Add caching** - Consider React Query or SWR for data fetching
3. **Add TypeScript types** - Generate types from CMS schema if available
4. **Create shared package** - Move fetch functions to `packages/api-client` for reusability

**Customize Blog**

1. **Edit frontend components**:
   - `apps/cms/src/app/(frontend)/posts/page.tsx` - Blog index
   - `apps/cms/src/app/(frontend)/posts/[slug]/page.tsx` - Post page
   - `apps/cms/src/lib/components/CollectionArchive/index.tsx` - Post cards

2. **Customize styling**:
   - Modify Tailwind classes
   - Update component layouts
   - Add custom CSS

**Add Features**

1. **Comments System**:
   - Create Comments collection
   - Link to Posts
   - Add comment form

2. **Tags**:
   - Use existing Tags collection
   - Add tag field to Posts
   - Create tag pages

3. **Search**:
   - Implement search functionality
   - Filter by category/tag
   - Full-text search

**Alternative: Use Shared Package**

If you want to share fetch functions across multiple apps:

1. Create `packages/api-client` package
2. Move fetch functions there
3. Export from package
4. Import in both CMS and Web apps

This allows:
- Shared TypeScript types
- Reusable API utilities
- Consistent error handling

---

## Environment Options

This section helps you choose the right development environment for RevealUI and provides migration paths between options.

### Quick Decision Matrix

| Your Situation | Recommended Environment |
|----------------|------------------------|
| **On Linux or NixOS-WSL** | [Pure Nix](#pure-nix-recommended-for-linuxnixos-wsl) |
| **On Windows/Mac** | [Dev Containers](#dev-containers-recommended-for-windowsmac) |
| **Using GitHub Codespaces** | [Dev Containers](#dev-containers-recommended-for-windowsmac) |
| **Need Node.js 24 exactly** | [Dev Containers](#dev-containers-recommended-for-windowsmac) or [Manual Setup](#manual-setup-traditional-approach) |
| **Team with mixed OSes** | [Dev Containers](#dev-containers-recommended-for-windowsmac) |
| **Want traditional setup** | [Manual Setup](#manual-setup-traditional-approach) |
| **Learning Nix** | [Pure Nix](#pure-nix-recommended-for-linuxnixos-wsl) (start here!) |

### Feature Comparison

| Feature | Pure Nix | Dev Containers | Manual Setup |
|---------|----------|----------------|--------------|
| **Setup Time** | 2-5 minutes (first time) | 3-5 minutes | 10-15 minutes |
| **Activation Time** | ⚡ Instant (direnv) | 🐌 30-60s (Docker) | ⚡ Instant |
| **Node.js Version** | ⚠️ 22 (24 not in nixpkgs yet) | ✅ 24.12.0 | ✅ 24.12.0 |
| **PostgreSQL** | ✅ 16 (local) | ✅ 16 (container) | ⚠️ Manual install |
| **Isolation** | ✅ Strong (per-project) | ✅ Strong (containers) | ❌ Global (conflicts possible) |
| **Reproducibility** | ✅ Perfect (declarative) | ✅ Good (Dockerfile) | ❌ Fragile (manual steps) |
| **Performance** | ⚡ Native (fastest) | 🐌 Docker overhead | ⚡ Native |
| **Resource Usage** | ✅ Lightweight | ⚠️ Heavy (Docker) | ✅ Lightweight |
| **Learning Curve** | ⚠️ Medium (Nix syntax) | ✅ Low (familiar Docker) | ✅ Easy (standard tools) |
| **Vendor Lock-in** | ✅ None (open source) | ⚠️ Docker dependency | ✅ None |
| **Platform Support** | Linux/macOS | All (via Docker) | All |
| **VS Code Integration** | ✅ Terminal | ✅ Native (Dev Containers) | ✅ Terminal |
| **Codespaces Support** | ❌ No | ✅ Native | ❌ No |
| **CI Parity** | ⚠️ Node 24 across all environments | ✅ Exact match | ✅ Configurable |
| **Database Location** | `.pgdata/` | Container volume | System-dependent |
| **Custom db helpers** | ✅ `db-init`, `db-start`, etc. | ⚠️ docker exec | ⚠️ Manual |
| **Maintenance** | ✅ Low (flake updates) | ✅ Low (image updates) | ⚠️ High (manual updates) |

### Environment Details

#### Pure Nix (Recommended for Linux/NixOS-WSL)

**What it is:** Declarative development environment using Nix flakes and direnv.

**Strengths:**
- ⚡ Fastest option (native performance, instant activation)
- ✅ Zero vendor lock-in (fully open source)
- ✅ Perfect reproducibility (bit-for-bit identical environments)
- ✅ Powerful customization (full control via Nix expressions)
- ✅ Lightweight (no containers or VMs)
- ✅ Custom database helpers (`db-init`, `db-start`, etc.)
- ✅ Three shell variants (default, ci, db)

**Weaknesses:**
- ✅ Node.js 24 (unified) (temporary limitation)
- ⚠️ Learning curve (Nix syntax)
- ❌ Linux/macOS only (no native Windows support)
- ⚠️ May not match CI environment exactly

**Best for:**
- Linux users (especially NixOS-WSL)
- Teams prioritizing performance and control
- Projects requiring reproducibility
- Developers learning modern infrastructure

**Setup time:** 2-5 minutes (first time), instant thereafter

**Documentation:** See [Environment Setup - Nix Setup](./ENVIRONMENT_SETUP.md#nix-setup) section below

---

#### Dev Containers (Recommended for Windows/Mac)

**What it is:** Docker-based development environment with VS Code integration.

**Strengths:**
- ✅ Works everywhere (Windows, Mac, Linux)
- ✅ Node.js 24.12.0 (exact CI match)
- ✅ Native VS Code integration
- ✅ GitHub Codespaces support
- ✅ Familiar Docker ecosystem
- ✅ Service orchestration (PostgreSQL, ElectricSQL)
- ✅ Pre-configured VS Code extensions

**Weaknesses:**
- 🐌 Slower than native (Docker overhead)
- ⚠️ Heavier resource usage (RAM, disk)
- ⚠️ Requires Docker Desktop (Windows/Mac)
- ⚠️ Network complexity (container networking)
- ⚠️ No custom db helpers (use docker exec or pnpm scripts)

**Best for:**
- Windows/Mac developers
- Teams using GitHub Codespaces
- VS Code users
- Teams with mixed operating systems
- Projects requiring exact CI parity

**Setup time:** 3-5 minutes (first time), 30-60s activation

**Documentation:** [.devcontainer/README.md](../../.devcontainer/README.md)

---

#### Manual Setup (Traditional Approach)

**What it is:** Install Node.js, PostgreSQL, and tools manually using traditional methods.

**Strengths:**
- ✅ Full control over versions and configuration
- ✅ Familiar workflow (nvm, manual installs)
- ✅ No additional tools needed (Nix/Docker)
- ✅ Easy to troubleshoot (standard tools)
- ✅ Can match CI exactly (Node 24.12.0)

**Weaknesses:**
- ❌ Not reproducible (manual steps)
- ❌ Potential version conflicts (global installs)
- ⚠️ Platform-specific setup (different per OS)
- ⚠️ Requires manual PostgreSQL management
- ⚠️ Time-consuming setup (10-15 minutes)
- ⚠️ High maintenance burden (manual updates)

**Best for:**
- Developers who prefer traditional workflows
- Troubleshooting or debugging
- Projects with unique requirements
- Learning the stack without abstractions

**Setup time:** 10-15 minutes

**Documentation:** See README.md Quick Start section

---

### Migration Guides

#### From Manual Setup → Pure Nix

**Why migrate:** Faster, reproducible, no global pollution

**Steps:**

1. **Clean up global tools (optional):**
   ```bash
   # Remove global pnpm if installed
   npm uninstall -g pnpm

   # nvm stays (useful for other projects)
   ```

2. **Install Nix:**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```

3. **Enable direnv:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   eval "$(direnv hook bash)"  # or zsh

   # Reload shell
   source ~/.bashrc
   ```

4. **Activate Nix environment:**
   ```bash
   cd ~/projects/RevealUI
   direnv allow
   # Wait for build (first time only)
   ```

5. **Migrate database (if needed):**
   ```bash
   # Export existing data
   pg_dump -d revealui > backup.sql

   # Initialize Nix database
   db-init
   db-start

   # Import data
   psql -d revealui < backup.sql
   ```

6. **Verify setup:**
   ```bash
   node --version    # Should be 24.x
   pnpm --version    # Should be 10.28.2
   db-status         # Should show running
   pnpm dev          # Should start normally
   ```

**Time required:** 5-10 minutes

---

#### From Pure Nix → Dev Containers

**Why migrate:** Need Node 24, using Windows/Mac, need Codespaces

**Steps:**

1. **Install Docker:**
   - Windows/Mac: Install Docker Desktop
   - Linux: Install Docker Engine

2. **Install Dev Containers extension:**
   - Open VS Code
   - Install "Dev Containers" extension
   - Restart VS Code

3. **Open in container:**
   - Open project in VS Code
   - Press `F1` → "Dev Containers: Reopen in Container"
   - Wait for container build (3-5 minutes first time)

4. **Migrate database:**
   ```bash
   # Export from Nix
   db-start
   pg_dump -d revealui > backup.sql
   db-stop

   # Import to Dev Container
   # (inside container)
   pnpm db:init
   psql postgresql://postgres@db:5432/revealui < backup.sql
   ```

5. **Verify setup:**
   ```bash
   node --version    # Should be 24.12.0
   pnpm dev          # Should start normally
   ```

**Time required:** 10-15 minutes

---

#### From Dev Containers → Pure Nix

**Why migrate:** Faster performance, lightweight, more control

**Prerequisites:**
- ✅ Must be on Linux or NixOS-WSL
- ❌ Won't work on Windows/Mac native

**Steps:**

1. **Export database from container:**
   ```bash
   # Inside Dev Container
   pg_dump -d revealui > backup.sql
   # Copy backup.sql to host filesystem
   ```

2. **Exit container:**
   - Close VS Code or reopen folder locally

3. **Install Nix (if not installed):**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```

4. **Enable direnv:**
   ```bash
   eval "$(direnv hook bash)"
   direnv allow
   ```

5. **Import database:**
   ```bash
   db-init
   db-start
   psql -d revealui < backup.sql
   ```

6. **Update .env:**
   ```bash
   # Change from container networking
   # Old: postgresql://postgres@db:5432/revealui
   # New: postgresql://postgres@localhost:5432/revealui
   ```

**Time required:** 10 minutes

---

### Troubleshooting Common Issues

#### Conflicting Database Data

**Problem:** Multiple environments create different PGDATA directories

**Solution:**
- **Nix**: `.pgdata/`
- **Dev Containers**: Docker volume

Choose ONE environment and stick with it. To switch:

```bash
# Export data from old environment
pg_dump -d revealui > backup.sql

# Remove old data directory
rm -rf .pgdata/

# Initialize new environment
# (follow migration guide above)

# Import data
psql -d revealui < backup.sql
```

#### Node Version Mismatch

**Problem:** Nix and CI both use Node 24

**Solutions:**

1. **Accept the difference** (recommended):
   - Test your code works on both versions
   - CI will catch Node 24-specific issues
   - Update to Node 24 when available in nixpkgs

2. **Switch to Dev Containers**:
   - Provides exact Node 24.12.0
   - Follow migration guide above

3. **Use manual setup for critical testing**:
   - `nvm use 24.12.0`
   - Test locally before pushing to CI

#### Environment Not Activating

**Nix/direnv:**
```bash
# Re-allow directory
direnv allow

# Check status
direnv status

# Reload shell config
source ~/.bashrc

# Check for errors
nix flake check
```

**Dev Containers:**
```bash
# Rebuild container
F1 → "Dev Containers: Rebuild Container"

# Check Docker
docker ps
docker logs <container-id>

# Check .devcontainer/devcontainer.json syntax
```

#### Database Won't Start

**Nix:**
```bash
# Check PGDATA directory exists
ls -la .pgdata/

# Initialize if needed
db-reset

# Check for port conflicts
lsof -i :5432

# View logs
cat .pgdata/logfile
```

**Dev Containers:**
```bash
# Check database container
docker ps
docker logs revealui-db

# Restart database service
docker-compose restart db

# Check connection string in .env
```

#### Slow Performance

**Nix:**
- ✅ Should be fastest option
- Check for WSL2 filesystem issues (use Linux FS, not /mnt/c)
- Optimize nix.conf (see Environment Setup - Nix Setup section)

**Dev Containers:**
- 🐌 Expected to be slower (Docker overhead)
- Use volume mounts, not bind mounts
- Allocate more resources to Docker
- Consider switching to Nix on Linux

---

### CI Environment Comparison

Our CI uses **vanilla GitHub Actions** (not Nix or Docker):

| Aspect | Nix | Dev Containers | Manual | CI |
|--------|-----|----------------|--------|-----|
| **Node.js** | 22 | 24.12.0 | 24.12.0 | 24.12.0 |
| **pnpm** | 10.28.2 | 10.28.2 | 10.28.2 | 10.28.2 |
| **PostgreSQL** | 16 (local) | 16 (container) | 16 (system) | 16 (Docker) |
| **Setup method** | direnv | docker-compose | manual | actions/setup-node |

**Why the difference?**
- CI prioritizes simplicity and speed
- GitHub Actions provides optimized Node.js setup
- Local environments prioritize convenience and control
- Exact parity not required if code is version-agnostic

**Best practice:** Write code for Node 24.

See [docs/development/CI_ENVIRONMENT.md](../development/CI_ENVIRONMENT.md) for details.

---

### FAQ

#### Should my whole team use the same environment?

**No!** Different team members can use different environments based on their OS and preferences:

- Linux developers → Nix
- Windows/Mac → Dev Containers
- Traditionalists → Manual setup

All environments work with the same codebase. Use `pnpm db:*` commands for cross-environment consistency.

#### Can I switch between environments?

**Yes!** Follow the migration guides above. Key step: Export and import your database.

#### What if I'm new to Nix?

Start with the Nix Setup section in [Environment Setup](./ENVIRONMENT_SETUP.md). Nix has a learning curve, but:
- You don't need to learn Nix syntax to use it
- The `flake.nix` is already configured
- You mostly just use `direnv allow` and pnpm commands

If Nix feels overwhelming, use Dev Containers instead.

#### Why doesn't CI use Nix?

**Performance:** GitHub Actions with native Node.js is faster than Nix setup.
**Simplicity:** Standard actions are easier to maintain and understand.
**Caching:** GitHub's built-in caching works better with standard tools.

We document the differences and test compatibility.

#### How do I report environment issues?

1. Specify which environment you're using (Nix/Docker/Manual)
2. Include version info:
   ```bash
   node --version
   pnpm --version
   postgres --version
   ```
3. Include relevant logs
4. Open issue on GitHub

---

### Summary

**TL;DR:**

- ✅ **Linux/NixOS-WSL** → Use Pure Nix (fastest, best control)
- ✅ **Windows/Mac/Codespaces** → Use Dev Containers (best compatibility)
- ⚠️ **Need Node 24 exactly** → Use Dev Containers or Manual

All environments support the same workflows via `pnpm` scripts.

**Questions?** Check environment-specific docs or open a GitHub issue.

---

## Environment Setup

This section covers complete development environment setup including Docker, WSL2, known limitations, and launch checklist.

### Nix Setup

This section explains how to use RevealUI's Nix-based development environment on NixOS-WSL.

#### ⚠️ Important: Node.js Version Notice

**Current Limitation:** The Nix environment provides **Node.js 22** instead of the target version 24.12.0.

**Why?** Node.js 24 is not yet available in nixpkgs stable or unstable channels as of January 2026.

**Impact:**
- ✅ Most features work normally on Node.js 22
- ⚠️ CI uses Node.js 24.12.0, so there may be minor differences
- 🔄 We're monitoring nixpkgs and will update to Node 24 as soon as it's available

**What this means for you:**
- Your code is tested against both Node 22 (local) and Node 24 (CI)
- Report any Node version-specific issues immediately
- The codebase maintains compatibility with both versions

**Status tracking:** Check `flake.nix` lines 14-16 for update status.

**Alternatives if you need Node 24:**
- Use [Dev Containers](./.devcontainer/README.md) (Docker-based, Node 24.12.0)
- Use manual setup with `nvm use 24.12.0`

#### When to Use Nix

**Choose Nix if you:**
- ✅ Are on Linux or NixOS-WSL
- ✅ Want the fastest, most lightweight setup
- ✅ Value reproducibility and zero vendor lock-in
- ✅ Are comfortable with declarative configuration
- ✅ Using Node.js 24 (24 coming soon)

**Choose Dev Containers instead if you:**
- ⚠️ Need Node.js 24.12.0 exactly
- ⚠️ Are on Windows/Mac
- ⚠️ Use GitHub Codespaces
- ⚠️ Prefer Docker-based environments

**Comparison:** See [Environment Options](#environment-options) for detailed feature comparison.

#### Prerequisites

- ✅ NixOS-WSL installed and running
- ✅ direnv enabled in your shell
- ✅ Git initialized in the project

#### Quick Start (First Time)

```bash
# 1. Navigate to project (must be on Linux filesystem!)
cd ~/projects/RevealUI

# 2. Initialize Nix flake
nix flake update

# 3. Allow direnv (enables automatic environment activation)
direnv allow

# 4. Wait for environment to build (first time only, ~2-5 min)
# You'll see a colorful welcome message when ready!

# 5. Initialize PostgreSQL
db-init

# 6. Start PostgreSQL
db-start

# 7. Install dependencies
pnpm install

# 8. Start development
pnpm dev
```

#### Daily Workflow

```bash
# Just cd into the project - environment activates automatically!
cd ~/projects/RevealUI

# Start PostgreSQL if needed
db-start

# Run your commands
pnpm dev
```

#### Database Setup

##### Unified Database Interface

RevealUI provides **two ways** to manage your database:

**Option 1: Nix Helper Commands (Convenience)**

Shell functions provided by the Nix environment:

| Command | Description |
|---------|-------------|
| `db-init` | Initialize PostgreSQL (first time only) |
| `db-start` | Start PostgreSQL server |
| `db-stop` | Stop PostgreSQL server |
| `db-status` | Check if PostgreSQL is running |
| `db-reset` | Delete and reinitialize database |
| `db-psql` | Connect with psql client |

**Example:**
```bash
db-init      # First time setup
db-start     # Start server
db-status    # Check status
```

**Option 2: pnpm Scripts (Universal)**

These work in **any environment** (Nix, Docker, Manual):

| Command | Description |
|---------|-------------|
| `pnpm db:init` | Initialize database and run migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm db:reset` | Reset database to clean state |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |

**Example:**
```bash
pnpm db:init      # Initialize + migrate
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open GUI
```

**Which Should I Use?**

- **Nix helpers** (`db-*`): Quick server control (start/stop/status)
- **pnpm scripts** (`pnpm db:*`): Application-level tasks (migrate/seed/studio)

**Best Practice:** Use pnpm scripts for consistency across all environments.

**Database Location**

- **Data directory**: `.pgdata/` (in project root)
- **Automatically gitignored**
- **Port**: 5432 (default)
- **Connection string**: Automatically configured in `.env`

**⚠️ Important:** The database runs **locally** in the Nix environment, not in a container.

#### Multiple Shell Environments

The flake provides specialized environments:

**Default (Full Development)**
```bash
# Activated automatically via direnv
cd ~/projects/RevealUI
```

Includes: Node.js, pnpm, PostgreSQL, Stripe CLI, all dev tools

**CI Environment (Minimal)**
```bash
nix develop .#ci
```

Includes: Only Node.js, pnpm, git (for CI pipelines)

**Database Only**
```bash
nix develop .#db
```

Includes: Only PostgreSQL and database tools

#### Customization

**Adding Packages**

Edit `flake.nix`:

```nix
buildInputs = with pkgs; [
  # Existing packages...

  # Add new packages
  redis
  docker-compose
  kubectl
];
```

Then:
```bash
direnv reload
```

**Changing Node.js Version**

When Node.js 24 becomes available in nixpkgs:

```nix
# In flake.nix, change:
nodejs = pkgs.nodejs_24;

# To:
nodejs = pkgs.nodejs_24;
```

**Custom Environment Variables**

Add to `flake.nix` shellHook:

```nix
shellHook = ''
  # ... existing hook ...

  export MY_CUSTOM_VAR="value"
  export API_URL="http://localhost:3000"
'';
```

#### Updating Dependencies

**Update Nix Packages**
```bash
# Update flake.lock (updates all Nix packages)
nix flake update

# Reload environment
direnv reload
```

**Update Node Packages**
```bash
# Standard pnpm update
pnpm update
```

#### Troubleshooting

**Environment Not Activating**

```bash
# Re-allow direnv
direnv allow

# Check direnv status
direnv status

# Manually reload
direnv reload
```

**PostgreSQL Won't Start**

```bash
# Check if already running
db-status

# Reset database completely
db-reset

# Check logs
cat .pgdata/logfile
```

**Slow First Load**

The first time you enter the environment, Nix downloads and builds packages. This can take 2-5 minutes.

**After first load, activation is instant** thanks to nix-direnv caching.

**Out of Disk Space**

```bash
# Clean old Nix generations
nix-collect-garbage -d

# Clean pnpm cache
pnpm store prune
```

#### Performance Tips

**1. Store Projects on Linux Filesystem**

**Fast:**
```bash
/home/joshua/projects/RevealUI/  # ✅
```

**Slow (10x slower):**
```bash
/mnt/c/Users/joshua/projects/RevealUI/  # ❌
```

**2. Configure WSL Memory**

Edit `%UserProfile%\.wslconfig` on Windows:

```ini
[wsl2]
memory=8GB
processors=4
```

Restart WSL: `wsl --shutdown`

**3. Enable Nix Binary Cache**

Already configured in `flake.nix` - ensures you download pre-built packages instead of compiling.

**4. Optimize Nix Build Settings (WSL2)**

If you experience freezing during heavy builds (rust-analyzer, large packages), create `~/.config/nix/nix.conf`:

```ini
# Limit concurrent builds to prevent WSL2 freezing
max-jobs = auto
cores = 4

# Enable flakes (if not already enabled)
experimental-features = nix-command flakes

# Use binary cache
substituters = https://cache.nixos.org https://nix-community.cachix.org
trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY= nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs=
```

Then restart direnv:
```bash
direnv reload
```

**Why this helps:**
- Prevents WSL2 from freezing on heavy builds
- Limits CPU/memory pressure
- Improves stability on resource-constrained systems

**5. Regular Maintenance**

```bash
# Clean old Nix generations (free disk space)
nix-collect-garbage -d

# Optimize Nix store (deduplicate files)
nix-store --optimize

# Update flake inputs (get latest packages)
nix flake update
```

#### Advanced Usage

**Manual Reload Mode (Optional)**

By default, direnv automatically reloads when `flake.nix` or `flake.lock` changes. You can opt into **manual reload mode** to prevent unexpected rebuilds:

**Benefits:**
- ✅ Prevents surprise environment rebuilds
- ✅ More control over when environment updates
- ✅ Useful during intensive Nix development

**How to enable:**

Add to your `.envrc` (at the top):
```bash
export NIX_DIRENV_MANUAL_RELOAD=1
use flake
```

**Usage with manual mode:**
```bash
# Changes to flake.nix won't auto-reload
# You must manually trigger reload:
direnv reload
```

**When to use:**
- You're frequently editing `flake.nix`
- You want explicit control over environment updates
- You're working on Nix configuration itself

**When NOT to use:**
- Default auto-reload works fine for most users
- You want automatic environment synchronization
- You're not frequently modifying Nix files

**Fallback protection:** nix-direnv automatically provides fallback protection. If a new environment version fails to build, it keeps using the previous working environment.

**Manual Flake Commands**

```bash
# Enter development shell without direnv
nix develop

# Run a command in the dev environment
nix develop -c pnpm test

# Update specific input
nix flake lock --update-input nixpkgs

# Show flake info
nix flake show

# Check flake
nix flake check
```

**Pin to Specific nixpkgs Commit**

```nix
# In flake.nix inputs:
nixpkgs.url = "github:NixOS/nixpkgs/abc123...";
```

Find commits at [nixhub.io](https://www.nixhub.io/)

**Share Configuration**

The `flake.nix` and `flake.lock` files define the entire environment. Commit them:

```bash
git add flake.nix flake.lock .envrc
git commit -m "Add Nix flake development environment"
```

Now everyone on your team gets the **exact same environment**!

#### Resources

- [Nix Flakes Documentation](https://nixos.wiki/wiki/Flakes)
- [nix-direnv](https://github.com/nix-community/nix-direnv)
- [Zero to Nix](https://zero-to-nix.com/)
- [NixOS Package Search](https://search.nixos.org/packages)

#### Getting Help

- Check [Environment Options](#environment-options) for comparison with Dev Containers
- Review `flake.nix` comments for configuration details
- Ask in NixOS Discourse: https://discourse.nixos.org/
- RevealUI Issues: https://github.com/your-org/RevealUI/issues

### Docker Engine Setup on WSL2

**Purpose**: Set up Docker Engine directly on WSL2 without Docker Desktop
**OS**: WSL2 (Ubuntu/Debian)

#### Overview

Docker Desktop is heavy and requires Windows. You can run Docker Engine directly on WSL2, which is lighter and faster.

#### Prerequisites

- WSL2 installed and running
- Ubuntu/Debian distribution in WSL2
- Sudo access

#### Installation Steps

**Step 1: Update System**

```bash
sudo apt update
sudo apt upgrade -y
```

**Step 2: Install Prerequisites**

```bash
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

**Step 3: Add Docker's Official GPG Key**

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

**Step 4: Set Up Docker Repository**

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**Step 5: Install Docker Engine**

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**Step 6: Start Docker Service**

```bash
sudo service docker start
```

**Step 7: Add Your User to Docker Group (Optional but Recommended)**

```bash
sudo usermod -aG docker $USER
```

**Important**: You'll need to log out and log back in (or restart WSL) for group changes to take effect.

**Step 8: Verify Installation**

```bash
docker --version
docker compose version
sudo docker run hello-world
```

#### Auto-Start Docker on WSL2

Docker doesn't auto-start on WSL2. Add this to your `~/.bashrc` or `~/.zshrc`:

```bash
# Auto-start Docker on WSL2
if ! pgrep -x "dockerd" > /dev/null; then
    sudo service docker start > /dev/null 2>&1
fi
```

Or create a systemd service (if you have systemd enabled in WSL2):

```bash
# Check if systemd is enabled
systemctl --version

# If systemd is available, enable Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

#### Fix Docker Credential Issue

If you see the credential error, remove the credential helper:

```bash
# Check Docker config
cat ~/.docker/config.json

# Remove credential helper (if present)
# Edit ~/.docker/config.json and remove:
#   "credsStore": "desktop.exe"
#   or
#   "credHelpers": { ... }
```

Or create/update `~/.docker/config.json`:

```json
{
  "auths": {}
}
```

#### Verify Setup

```bash
# Check Docker is running
sudo service docker status

# Test Docker
docker ps

# Test Docker Compose
docker compose version

# Test with our test database
cd /home/joshua-v-dev/projects/RevealUI
docker compose -f infrastructure/docker-compose/services/test.yml up -d
docker compose -f infrastructure/docker-compose/services/test.yml ps
docker compose -f infrastructure/docker-compose/services/test.yml down
```

#### Troubleshooting

**Docker Service Not Starting**

```bash
# Check Docker service status
sudo service docker status

# Start Docker manually
sudo service docker start

# Check logs
sudo journalctl -u docker
# or
sudo tail -f /var/log/docker.log
```

**Permission Denied**

```bash
# Add user to docker group (if not done)
sudo usermod -aG docker $USER

# Log out and back in, or restart WSL
# Then verify:
groups
# Should include "docker"
```

**Port Already in Use**

```bash
# Check what's using the port
sudo netstat -tulpn | grep 5433

# Or use lsof
sudo lsof -i :5433

# Kill the process or change port in infrastructure/docker-compose/services/test.yml
```

**WSL2 Integration Issues**

If Docker Desktop was previously installed, you might need to:

1. **Uninstall Docker Desktop** (if installed)
2. **Remove old Docker configs**:
   ```bash
   rm -rf ~/.docker
   ```
3. **Follow installation steps above**

#### Quick Setup Script

Save this as `setup-docker-wsl2.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up Docker Engine on WSL2..."

# Update system
sudo apt update
sudo apt upgrade -y

# Install prerequisites
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
sudo service docker start

# Add user to docker group
sudo usermod -aG docker $USER

# Fix credential helper
mkdir -p ~/.docker
cat > ~/.docker/config.json <<EOF
{
  "auths": {}
}
EOF

echo ""
echo "✅ Docker Engine installed!"
echo ""
echo "⚠️  IMPORTANT: Log out and log back in (or restart WSL) for group changes to take effect."
echo ""
echo "Then verify with:"
echo "  docker --version"
echo "  docker compose version"
echo "  docker ps"
```

Make it executable:
```bash
chmod +x setup-docker-wsl2.sh
./setup-docker-wsl2.sh
```

#### After Installation

**1. Restart WSL (or log out/in)**

```bash
# In Windows PowerShell/CMD:
wsl --shutdown

# Then restart WSL
```

**2. Verify Docker Works**

```bash
docker --version
docker compose version
docker ps
```

**3. Test Our Setup**

```bash
cd /home/joshua-v-dev/projects/RevealUI

# Start test database
./scripts/setup-test-db.sh

# Or manually:
docker compose -f infrastructure/docker-compose/services/test.yml up -d
```

#### Benefits of Docker Engine vs Docker Desktop

**Docker Engine (WSL2)**
- ✅ Lighter weight
- ✅ Faster startup
- ✅ No Windows dependency
- ✅ Native Linux experience
- ✅ Better for CI/CD
- ✅ Free (no license concerns)

**Docker Desktop**
- ❌ Heavy (requires Windows)
- ❌ Slower startup
- ❌ License restrictions for large companies
- ❌ More GUI overhead

#### Next Steps

After Docker is set up:

1. **Test our automation**:
   ```bash
   ./scripts/setup-test-db.sh
   ```

2. **Run integration tests**:
   ```bash
   export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"
   pnpm --filter @revealui/memory test __tests__/integration/automated-validation.test.ts
   ```

3. **Run full validation**:
   ```bash
   ./scripts/run-automated-validation.sh
   ```

#### References

- [Docker Engine Installation - Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker on WSL2](https://docs.docker.com/desktop/wsl/)
- [Docker Compose Installation](https://docs.docker.com/compose/install/)

### Known Limitations

This section tracks known limitations, workarounds, and future improvements for the RevealUI Framework.

#### Type System

**`any` Types in Core**
- **Location**: `packages/core/src/core/__internal/index.ts`, `packages/core/src/core/gaurds/validators/hasProp.ts`
- **Status**: Reduced from 297 to ~18 instances in core files
- **Impact**: Low - mostly in internal type guards
- **Workaround**: Type assertions are safe in these contexts
- **Future**: Complete type definitions for all file types

**TODO Comments**
- **Count**: 77 TODO/FIXME/HACK comments across 38 files
- **Priority**: Most are non-critical (eventually/v1-release tags)
- **Critical**: 10 TODOs in `getPageContextFromHooks.ts` related to V1 design migration
- **Action**: Documented in code, will be addressed in V1 release

#### Plugin System

**Plugin Integration**
- **Status**: Plugin system created but not fully integrated into Vite build
- **Impact**: Medium - plugins work but require manual Vite plugin conversion
- **Workaround**: Use `toVitePlugins()` method to convert RevealUI plugins
- **Future**: Automatic integration in Vite build process

**Configuration Merging**
- **Status**: Unified config system created but not fully integrated
- **Impact**: Low - works alongside existing `+config.ts` files
- **Workaround**: Use `extends` option to merge with existing configs
- **Future**: Full integration with automatic merging

#### Type Generation

**Watch Mode**
- **Status**: Implemented with polling (2-second interval)
- **Limitation**: Not using file system watchers (chokidar)
- **Impact**: Low - works but less efficient than native watchers
- **Future**: Migrate to chokidar for better performance

**RevealUI CMS Type Mapping**
- **Status**: Basic type mapping implemented
- **Limitation**: Complex types (blocks, groups) map to `unknown[]` or `Record<string, unknown>`
- **Impact**: Medium - requires manual type definitions for complex fields
- **Future**: Enhanced type inference from RevealUI CMS schemas

#### Performance

**Bundle Size**
- **Current**: ~45MB (includes source maps)
- **Production**: 6.6 MB compressed
- **Status**: Acceptable but could be optimized
- **Future**: Tree-shaking improvements, code splitting

**Build Time**
- **Current**: ~8-12 seconds for packages
- **Status**: Good performance
- **Future**: Parallel builds, caching improvements

#### Testing

**Test Coverage**
- **Current**: Coverage thresholds set (70%/60%/70%)
- **Status**: Tests implemented but coverage not yet at thresholds
- **Impact**: Low - tests are comprehensive
- **Future**: Increase coverage to meet thresholds

**E2E Tests**
- **Status**: Basic E2E tests implemented
- **Limitation**: Limited to critical user flows
- **Future**: Expand to cover all user journeys

#### Compliance

**GDPR**
- **Status**: Cookie consent, data export/deletion implemented
- **Limitation**: Data retention policies not configurable
- **Future**: Configurable retention policies

**WCAG 2.1**
- **Status**: Accessibility utilities created
- **Limitation**: Not all components have ARIA labels
- **Future**: Audit all components and add missing labels

#### Documentation

**API Documentation**
- **Status**: Core APIs documented
- **Limitation**: Some edge cases not covered
- **Future**: Complete examples for all APIs

**Migration Guides**
- **Status**: Basic guides created
- **Limitation**: Step-by-step examples needed
- **Future**: Interactive migration tool

#### Workarounds

**PGlite for Local Development**
- **Workaround**: Use PGlite (in-memory PostgreSQL) for local development and testing
- **Status**: Implemented and working
- **Note**: Production uses full PostgreSQL (Neon, Supabase, etc.)

**Build-Time Authentication**
- **Workaround**: Mark routes as `dynamic = "force-dynamic"`
- **Status**: Working solution
- **Note**: Required for RevealUI CMS routes

#### Future Improvements

1. **Type Safety**: Complete elimination of `any` types
2. **Plugin Integration**: Automatic Vite plugin conversion
3. **Type Generation**: Enhanced RevealUI CMS type inference
4. **Performance**: Bundle size optimization
5. **Testing**: Increase coverage to thresholds
6. **Documentation**: Complete all guides with examples
7. **Compliance**: Configurable GDPR policies
8. **Accessibility**: Full WCAG 2.1 AA compliance audit

#### Reporting Issues

If you encounter limitations not listed here:
1. Check existing GitHub issues
2. Create a new issue with:
   - Description of limitation
   - Expected behavior
   - Actual behavior
   - Workaround (if any)

### Pre-Launch Checklist

**Last Updated**: January 2025
**Status**: Pre-Production Validation

This checklist ensures all critical items are verified before production launch.

#### Phase 1: Testing & Quality Assurance

**Test Coverage**
- [ ] Test coverage meets thresholds:
  - [ ] Statements: ≥ 70%
  - [ ] Branches: ≥ 60%
  - [ ] Functions: ≥ 70%
  - [ ] Lines: ≥ 70%
- [ ] Critical path coverage (auth, payments, access control): ≥ 90%
- [ ] Coverage report generated and reviewed

**Test Execution**
- [ ] All unit tests passing: `pnpm --filter cms test`
- [ ] All integration tests passing
- [ ] All E2E tests passing: `pnpm --filter test test:e2e`
- [ ] Test pass rate: 100%

**Test Implementation**
- [ ] Authentication tests fully implemented (14 tests)
- [ ] Access control tests fully implemented (27 tests)
- [ ] Payment processing tests fully implemented (33 tests)
- [ ] E2E tests expanded with critical flows:
  - [ ] User registration and login
  - [ ] Admin panel access
  - [ ] Payment checkout flow
  - [ ] Form submissions
  - [ ] Multi-tenant isolation

#### Phase 2: Performance & Load Testing

**Load Testing**
- [ ] Load testing scripts created in `packages/test/load-tests/`
- [ ] Authentication load test run and passed
- [ ] API endpoint load test run and passed
- [ ] Payment processing load test run and passed
- [ ] Baseline metrics established

**Performance Budgets**
- [ ] Interactive: < 3000ms (validated)
- [ ] First meaningful paint: < 1000ms (validated)
- [ ] Largest contentful paint: < 2500ms (validated)
- [ ] Script size: < 300KB (validated)
- [ ] Total page size: < 1000KB (validated)

**Performance Optimization**
- [ ] Performance bottlenecks identified and fixed
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] Bundle size optimized

#### Phase 3: Security Validation

**Security Audit**
- [ ] Security audit run: `pnpm audit --audit-level=high`
- [ ] 0 critical vulnerabilities confirmed
- [ ] High vulnerabilities documented and assessed
- [ ] Security testing script run: `bash scripts/security-test.sh`

**Penetration Testing**
- [ ] Rate limiting tested and verified
- [ ] SQL injection prevention tested
- [ ] XSS prevention tested
- [ ] CSRF protection verified
- [ ] Authentication bypass attempts tested
- [ ] Authorization checks verified
- [ ] Multi-tenant isolation tested

**Security Configuration**
- [ ] Security headers configured and verified
- [ ] CORS properly configured
- [ ] Rate limiting enabled on auth endpoints
- [ ] Input validation with Zod schemas verified
- [ ] Webhook signature verification tested

#### Phase 4: Monitoring & Observability

**Sentry Configuration**
- [ ] Sentry client config verified: `apps/cms/sentry.client.config.ts`
- [ ] Sentry server config verified: `apps/cms/sentry.server.config.ts`
- [ ] Sentry DSN configured in environment variables
- [ ] Error reporting tested
- [ ] Performance monitoring enabled
- [ ] Alerts configured for critical errors

**Health Checks**
- [ ] Health endpoint accessible: `/api/health`
- [ ] Health endpoint returns correct structure
- [ ] Readiness probe working: `/api/health/ready`
- [ ] System metrics included in health check

**Uptime Monitoring**
- [ ] Uptime monitoring service configured (if applicable)
- [ ] Alert thresholds set
- [ ] On-call rotation configured

#### Phase 5: Environment & Configuration

**Environment Variables**
- [ ] All required environment variables set in production
- [ ] `REVEALUI_SECRET` is cryptographically strong (32+ chars)
- [ ] `REVEALUI_PUBLIC_SERVER_URL` set to production URL
- [ ] `DATABASE_URL` configured for production
- [ ] Database connection string verified
- [ ] Stripe keys configured (production keys)
- [ ] Vercel Blob token configured
- [ ] All secrets verified (not exposed in code)

**Database**
- [ ] Database migrations up to date
- [ ] Database backup created
- [ ] Connection pooling configured
- [ ] Database performance tested

**Build & Deployment**
- [ ] Production build successful: `pnpm build`
- [ ] Type checking passes: `pnpm typecheck:all`
- [ ] Linting passes: `pnpm lint`
- [ ] No console.log statements in production code
- [ ] Source maps configured (if needed)

#### Phase 6: Documentation

**Documentation Review**
- [ ] Deployment runbook reviewed: `docs/DEPLOYMENT_RUNBOOK.md`
- [ ] Environment variables guide complete: `docs/ENVIRONMENT_VARIABLES_GUIDE.md`
- [ ] Testing strategy documented: `docs/TESTING_STRATEGY.md`
- [ ] Security policy reviewed: `SECURITY.md`
- [ ] Known limitations documented: `docs/KNOWN_LIMITATIONS.md`

**Runbook & Procedures**
- [ ] Rollback procedure documented and tested
- [ ] Incident response plan ready
- [ ] On-call contacts documented
- [ ] Escalation procedures defined

#### Phase 7: Staging Validation

**Staging Environment**
- [ ] Staging environment deployed
- [ ] All critical user flows tested in staging:
  - [ ] User registration
  - [ ] User login
  - [ ] Admin panel access
  - [ ] Payment processing
  - [ ] Form submissions
  - [ ] Multi-tenant isolation
- [ ] Performance validated in staging
- [ ] Security tests run in staging

**Integration Testing**
- [ ] Stripe integration tested (test mode)
- [ ] Vercel Blob storage tested
- [ ] Database connectivity verified
- [ ] External service integrations verified

#### Phase 8: Final Pre-Launch

**Code Quality**
- [ ] All linter errors resolved
- [ ] All TypeScript errors resolved
- [ ] Code review completed
- [ ] Dead code removed
- [ ] Technical debt documented

**Final Checks**
- [ ] All tests passing: `pnpm test`
- [ ] Build successful: `pnpm build`
- [ ] Type checking passes: `pnpm typecheck:all`
- [ ] Security audit clean: `pnpm audit --audit-level=high`
- [ ] Performance budgets met
- [ ] Load testing passed

**Communication**
- [ ] Launch communication plan prepared
- [ ] Stakeholders notified
- [ ] Support team briefed
- [ ] Monitoring dashboards ready

#### Post-Launch Monitoring (First 24 Hours)

**Immediate Monitoring**
- [ ] Error rates monitored (target: < 0.1%)
- [ ] Performance metrics watched (p95, p99)
- [ ] Payment processing verified
- [ ] Authentication flows verified
- [ ] Sentry alerts monitored
- [ ] Health check endpoints monitored

**Issue Response**
- [ ] On-call team ready
- [ ] Rollback procedure ready
- [ ] Hotfix process documented
- [ ] Communication channels open

#### Sign-Off

**Prepared by**: _________________
**Date**: _________________
**Approved by**: _________________
**Date**: _________________

#### Notes

- This checklist should be completed before production deployment
- Any items marked as failed should be addressed before launch
- Document any exceptions or known issues
- Keep this checklist updated as requirements change

#### Next Steps After Launch

1. Monitor first 24 hours closely
2. Review performance metrics daily for first week
3. Collect user feedback
4. Address any issues promptly
5. Plan post-launch optimizations

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
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) - Production deployment
- [Environment Setup](./ENVIRONMENT_SETUP.md) - Development environment setup
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Welcome to RevealUI Framework!** 🎉

**Last Updated**: January 2025
**Version**: 0.1.0
**Maintainer**: RevealUI Team
