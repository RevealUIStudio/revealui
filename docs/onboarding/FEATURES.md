# RevealUI Framework - Complete Feature List

This document lists all features available in the RevealUI codebase based on actual code and configuration files (excluding documentation).

## Core Framework (@revealui/core)

### CMS Features
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

### Field Types
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

### Database Adapters
- **SQLite Adapter**: For local development
- **Universal Postgres Adapter**: Supports Neon, Supabase, Vercel Postgres
- **Transaction Pooling**: Automatic support for Supabase serverless (port 6543)
- **Dual Database Architecture**: Separate REST and Vector databases

### Rich Text Editor (Lexical)
- Lexical-based rich text editor
- **Features**: Bold, Italic, Underline, Headings, Links, Code blocks, Lists, Tables
- **Plugins**: Fixed toolbar, Tree view, Image upload, Floating toolbar
- **Image Nodes**: Custom image handling with upload support
- **HTML Export**: Server-side HTML rendering (RSC)
- **Client-side Editor**: React component for browser editing

### Storage Adapters
- **Vercel Blob Storage**: For media files
- Extensible storage adapter system

### API Features
- **REST API**: Automatic REST endpoint generation
- **Route Handlers**: Custom route handler support
- **Error Handling**: Standardized error responses
- **Request Context**: Full request context in hooks

### Admin UI
- **Admin Dashboard**: Full-featured admin interface
- **Collection List**: Browse and manage collections
- **Document Form**: Create/edit documents with rich forms
- **Custom Components**: Extensible component system
- **Live Preview**: Preview changes in real-time
- **Custom Graphics**: Brandable icons and logos

### Plugins System
- **Form Builder Plugin**: Dynamic form creation
- **Nested Docs Plugin**: Hierarchical document structures
- **Redirects Plugin**: URL redirect management
- **Plugin Extension System**: Register custom field types and extensions

### Utilities
- **Deep Clone**: Deep object cloning
- **LRU Cache**: In-memory caching
- **Logger**: Structured logging system
- **Type Guards**: Runtime type checking
- **Config Validation**: Runtime config validation
- **Field Traversal**: Traverse and transform field values

### Type System
- **Type Generation**: Auto-generated TypeScript types
- **Type Inference**: Automatic type inference from config
- **CMS Types**: PayloadCMS-compatible types
- **Generated Types**: Database, Supabase, Neon types

### Next.js Integration
- **Next.js 16 Support**: Async params and searchParams
- **Server Components**: RSC support for rich text
- **API Routes**: Automatic API route generation
- **withRevealUI HOC**: Wrap Next.js apps with RevealUI
- **Utilities**: Helper functions for Next.js integration

## AI System (@revealui/ai)

### Memory Management
- **Working Memory**: Short-term, session-based memory
- **Episodic Memory**: Long-term, event-based memory with vector search
- **Semantic Memory**: Vector-based similarity search
- **Memory Persistence**: CRDT-based persistent state
- **Memory Embeddings**: Vector embeddings for semantic search

### CRDT Types
- **LWW Register**: Last-Write-Wins register
- **OR-Set**: Observed-Remove Set
- **PN-Counter**: Positive-Negative Counter
- **Vector Clock**: Event ordering and causality

### LLM Providers
- **OpenAI**: GPT models support
- **Anthropic**: Claude models support
- **Provider Abstraction**: Pluggable LLM provider system
- **Client Interface**: Unified LLM client interface

### Agent System
- **Agent Orchestration**: Multi-agent coordination
- **Agent Context**: Session and agent context management
- **Agent Memory**: Persistent agent memory across sessions
- **Node ID Service**: Unique node identification for distributed systems

### Tools System
- **Tool Registry**: Register and manage tools
- **MCP Adapter**: Model Context Protocol integration
- **Tool Execution**: Execute tools with agent context

### React Hooks
- **useAgentContext**: Access agent context in React
- **useWorkingMemory**: Access working memory in React
- **useEpisodicMemory**: Access episodic memory in React

### Vector Search
- **pgvector Integration**: PostgreSQL vector similarity search
- **Embedding Generation**: Automatic embedding generation
- **Similarity Search**: Semantic similarity queries

## Authentication (@revealui/auth)

### Authentication Features
- **Database-backed Sessions**: Persistent session storage
- **Better Auth Patterns**: Modern auth patterns
- **Password Hashing**: bcrypt password hashing
- **Session Management**: Create, validate, destroy sessions
- **User Management**: User CRUD operations

### Server/Client Separation
- **Server Exports**: Server-side auth utilities
- **Client Exports**: Client-side auth utilities
- **React Exports**: React hooks and components

## Database (@revealui/db)

### Schema System
- **Drizzle ORM**: Type-safe ORM with Drizzle
- **Table Definitions**: Users, Sessions, Sites, Pages, Agents, CMS tables
- **Relations**: Automatic relation definitions
- **Migrations**: Drizzle Kit migrations

### Tables
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

### Database Clients
- **Dual Client Support**: Separate REST and Vector clients
- **Neon Database**: Serverless Postgres support
- **Supabase Database**: Supabase Postgres support
- **Type Generation**: Auto-generated database types

### Type System
- **Database Types**: Full Database type structure
- **Table Types**: Row, Insert, Update types for each table
- **Relationship Types**: Relationship type definitions

## Sync System (@revealui/sync)

### Real-time Sync
- **Electric SQL**: Real-time sync with Electric SQL
- **Cross-tab Sync**: Memory sharing across browser tabs
- **Session Sync**: Session-based synchronization
- **Offline-first**: Offline-first architecture

### React Integration
- **Electric Provider**: React context provider for sync
- **useElectric Hook**: Access Electric client in React
- **Automatic Sync**: Automatic state synchronization

## Services Package

### Stripe Integration
- **Stripe Client**: Type-safe Stripe API client
- **Checkout Sessions**: Create payment checkout sessions
- **Portal Links**: Create customer portal links
- **Webhooks**: Stripe webhook handling
- **Product Management**: Update products and prices

### Supabase Integration
- **Supabase Client**: Server, client, and web clients
- **Type Generation**: Auto-generated Supabase types
- **Configuration**: TOML-based configuration

### API Utilities
- **Error Handling**: Standardized API error responses
- **Logger**: Service-level logging

## Presentation Layer (@revealui/presentation)

### UI Components
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

### Primitives
- **Box**: Layout box primitive
- **Flex**: Flexbox layout
- **Grid**: Grid layout
- **Slot**: Slot primitive for composition
- **Text**: Text primitive
- **Heading**: Heading primitive

### Utilities
- **Class Name Utility (cn)**: Tailwind class merging

## Configuration (@revealui/config)

### Environment Configuration
- **Environment Detection**: Automatic environment detection
- **Config Validation**: Zod-based config validation
- **Type-safe Config**: TypeScript-validated configuration
- **Dotenv Support**: Environment variable loading

## Apps

### CMS App (Next.js 16)
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

### Web App (RevealUI + Vite)
- **RevealUI Framework**: RevealUI-powered frontend
- **Vite Build**: Fast Vite-based builds
- **React 19**: Latest React with compiler
- **Page Routing**: File-based routing
- **Server-side Rendering**: SSR support
- **Static Generation**: SSG support

### Docs App
- **Documentation Site**: Auto-generated docs site
- **Markdown Support**: Markdown rendering
- **Syntax Highlighting**: Code syntax highlighting
- **Search**: Documentation search
- **Navigation**: Auto-generated navigation

## Development Tools

### Build System
- **Turborepo**: Monorepo build orchestration
- **TypeScript**: Strict TypeScript compilation
- **ESM Modules**: ES Modules throughout
- **Turbopack**: Next.js 16 default bundler
- **Vite**: Frontend build tool

### Code Quality
- **Biome**: Fast formatter and linter
- **ESLint**: Additional linting
- **Type Checking**: Comprehensive type checking

### Testing
- **Vitest**: Fast unit testing
- **Integration Tests**: Full integration test suite
- **E2E Tests**: End-to-end testing
- **Coverage Reports**: Test coverage tracking

### Scripts & Automation
- **Database Scripts**: Reset, migrate, seed databases
- **Type Generation**: Generate types from schemas
- **Code Analysis**: Code quality analysis
- **Validation Scripts**: Pre-launch validation
- **Performance Testing**: Performance benchmarks
- **Security Testing**: Security validation

### Documentation Tools
- **Docs Lifecycle**: Automated documentation management
- **Stale Detection**: Detect outdated documentation
- **Reference Validation**: Validate code references
- **Duplicate Detection**: Find duplicate documentation
- **Archive Management**: Archive old documentation
- **Accuracy Validation**: Validate documentation accuracy

## Infrastructure Features

### Multi-tenancy
- **Tenants**: Multi-tenant support
- **Tenant Isolation**: Data isolation per tenant
- **Tenant Domains**: Custom domain per tenant

### Rate Limiting
- **Rate Limit Tables**: Track rate limits
- **Failed Attempts**: Track failed login attempts
- **Automatic Cleanup**: Cleanup old rate limit data

### Security
- **CORS**: Configurable CORS
- **CSRF**: CSRF protection
- **JWT**: JSON Web Token support
- **Password Validation**: Password strength requirements
- **Session Security**: Secure session management

### Monitoring & Observability
- **Sentry Integration**: Error tracking
- **Health Checks**: Live and ready health endpoints
- **Logging**: Structured logging throughout
- **Performance Tracking**: Performance monitoring

### Deployment
- **Vercel Support**: Vercel deployment configuration
- **Docker**: Docker Compose for services
- **Environment Detection**: Automatic environment detection
- **Standalone Builds**: Standalone Next.js builds

## Integration Features

### MCP (Model Context Protocol)
- **Vercel MCP**: Vercel integration via MCP
- **Stripe MCP**: Stripe integration via MCP
- **Neon MCP**: Neon database integration via MCP
- **Supabase MCP**: Supabase integration via MCP
- **Playwright MCP**: Playwright testing via MCP
- **Next Devtools MCP**: Next.js devtools via MCP

### External Services
- **Stripe**: Payment processing
- **Supabase**: Database and auth services
- **Neon**: Serverless Postgres
- **Vercel**: Deployment and storage
- **Electric SQL**: Real-time sync

## Developer Experience

### Type Safety
- **Full TypeScript**: 100% TypeScript coverage
- **Generated Types**: Auto-generated types from schemas
- **Type Inference**: Automatic type inference
- **Strict Mode**: TypeScript strict mode enabled

### Developer Tools
- **Hot Reload**: Fast refresh in development
- **Type Checking**: Real-time type checking
- **Linting**: Real-time linting
- **Formatting**: Auto-formatting with Biome

### Monorepo Features
- **pnpm Workspaces**: pnpm workspace management
- **Turborepo**: Fast monorepo builds
- **Shared Packages**: Reusable package system
- **Workspace Protocol**: Internal package linking

## Configuration Files

### RevealUI Config
- **Shared Config**: Root-level shared configuration
- **Environment Overrides**: Environment-specific configs
- **CMS Config**: CMS-specific configuration
- **Web Config**: Web app configuration

### Build Configs
- **Next.js Config**: Next.js configuration
- **Vite Config**: Vite configuration
- **Tailwind Config**: Tailwind CSS configuration
- **TypeScript Config**: TypeScript configuration
- **Turbo Config**: Turborepo configuration
