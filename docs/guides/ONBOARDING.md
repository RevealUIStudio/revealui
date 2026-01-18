# RevealUI Framework - Onboarding Guide

Welcome to RevealUI Framework! This comprehensive onboarding guide will help you get started with RevealUI from scratch. Whether you're a developer, designer, or project manager, this guide will walk you through everything you need to know.

**Estimated Time**: 30-45 minutes for complete setup and orientation

---

## Table of Contents

1. [What is RevealUI?](#what-is-revealui)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Understanding the System](#understanding-the-system)
5. [First Steps After Setup](#first-steps-after-setup)
6. [Common Workflows](#common-workflows)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## What is RevealUI?

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

### ⚠️ Important: Current Status

**Status**: 🔴 **Active Development - NOT Production Ready**

RevealUI is actively being developed. Before using in production, please review:
- [Production Readiness Assessment](../PRODUCTION_READINESS.md)
- [Current Status](../STATUS.md)
- [Production Roadmap](../PRODUCTION_ROADMAP.md)

---

## Prerequisites

Before you begin, ensure you have the following installed and configured:

### Required Software

1. **Node.js 24.12.0+**
   ```bash
   # Check your version
   node --version
   ```
   - Download: [nodejs.org](https://nodejs.org/)
   - We recommend using [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) for version management

2. **pnpm 9.14.2+**
   ```bash
   # Check your version
   pnpm --version
   ```
   - Install: `npm install -g pnpm`
   - This project uses pnpm exclusively (not npm or yarn)

3. **Git**
   ```bash
   # Check if installed
   git --version
   ```
   - Download: [git-scm.com](https://git-scm.com/)

### Required Accounts

You'll need accounts for these services (all offer free tiers):

1. **NeonDB** - Database hosting
   - Sign up: [neon.tech](https://neon.tech)
   - Free tier: 3 projects, 0.5 GB storage

2. **Vercel** - Deployment and storage
   - Sign up: [vercel.com](https://vercel.com)
   - Free tier: Unlimited projects, 100 GB bandwidth

3. **Stripe** - Payment processing (optional, but recommended)
   - Sign up: [stripe.com](https://stripe.com)
   - Free tier: Test mode for development

4. **Supabase** - Additional features (optional)
   - Sign up: [supabase.com](https://supabase.com)
   - Free tier: 2 projects, 500 MB database

### Optional Tools

- **VS Code** or **Cursor** - Recommended IDE
- **Docker** - For local database (if not using NeonDB)
- **GitHub Account** - For version control and deployments

---

## Initial Setup

Follow these steps to get RevealUI running on your machine.

### Step 1: Clone the Repository (2 minutes)

```bash
# Clone the repository
git clone https://github.com/RevealUIStudio/reveal.git
cd reveal

# Verify you're in the correct directory
ls -la
# You should see: apps/, packages/, docs/, package.json, etc.
```

### Step 2: Install Dependencies (3-5 minutes)

```bash
# Install all dependencies (this may take a few minutes)
pnpm install

# Verify installation
pnpm --version
```

**Note**: If you encounter permission errors, you may need to configure pnpm:
```bash
pnpm config set store-dir ~/.pnpm-store
```

### Step 3: Set Up Environment Variables (10-15 minutes)

Environment variables configure how RevealUI connects to your services.

#### 3.1 Generate a Secret

First, generate a secure secret for encryption:

```bash
# Generate a 32-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output - you'll need this for `REVEALUI_SECRET`.

#### 3.2 Get NeonDB Connection String

1. Go to [NeonDB Console](https://console.neon.tech)
2. Click **"New Project"** (or use existing)
3. Fill in project name (e.g., "revealui-dev")
4. Select a region closest to you
5. After creation, find **"Connection Details"**
6. Copy the **Connection String** (starts with `postgresql://`)
7. Ensure it includes `?sslmode=require` at the end

**Example connection string:**
```
postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

#### 3.3 Get Vercel Blob Storage Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** → **Blob**
3. Click **"Create Store"** (if you don't have one)
4. Name your store (e.g., "revealui-media")
5. Click **"Create Token"**
6. Give it a name (e.g., "Local Development")
7. Set permissions to **"Read & Write"**
8. Copy the token (starts with `vercel_blob_rw_`)

**Note**: Store tokens securely - they can't be retrieved after creation.

#### 3.4 Get Stripe API Keys (Optional but Recommended)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test Mode** (toggle in top right)
3. Navigate to **Developers** → **API Keys**
4. Copy your **Publishable key** (starts with `pk_test_`)
5. Click **"Reveal test key"** and copy **Secret key** (starts with `sk_test_`)

#### 3.5 Create Environment File

Create `.env.development.local` in the project root:

```bash
# From project root
touch .env.development.local
```

Or copy from template if it exists:

```bash
cp .env.template .env.development.local
```

#### 3.6 Configure Environment Variables

Edit `.env.development.local` with your values:

```env
# ============================================
# RevealUI Configuration
# ============================================

# Secret key for encryption (REQUIRED)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
REVEALUI_SECRET=your_generated_secret_here_32_characters_minimum

# Server URLs (REQUIRED)
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# ============================================
# Database Configuration (REQUIRED)
# ============================================

# NeonDB Postgres connection string
POSTGRES_URL=postgresql://user:password@host/database?sslmode=require

# ============================================
# Storage Configuration (REQUIRED for media)
# ============================================

# Vercel Blob Storage token
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXX

# ============================================
# Payment Configuration (Optional)
# ============================================

# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX

# ============================================
# Optional: Admin User Creation
# ============================================

# These will create the first admin user automatically
# REVEALUI_ADMIN_EMAIL=admin@example.com
# REVEALUI_ADMIN_PASSWORD=your_secure_password_here_min_12_chars
```

**Important**: 
- Never commit `.env.development.local` to git (it's already in `.gitignore`)
- Use different secrets for development and production
- Keep your secrets secure

### Step 4: Start the Development Server (1 minute)

```bash
# Start all services (CMS + Web)
pnpm dev
```

This will start:
- **CMS App**: http://localhost:4000 (Admin panel)
- **Web App**: http://localhost:3000 (Public site)

**Note**: The first startup may take longer as it:
- Connects to the database
- Runs initial migrations
- Sets up the database schema

### Step 5: Create Your First Admin User

When you first access the admin panel, you'll need to create an admin user.

#### Option A: Automatic Creation (Recommended)

If you set `REVEALUI_ADMIN_EMAIL` and `REVEALUI_ADMIN_PASSWORD` in your `.env.development.local`, the first admin user will be created automatically on first startup.

#### Option B: Manual Creation

1. Open your browser to `http://localhost:4000/admin`
2. You should see a "Create your first user" screen
3. Fill in:
   - **Email**: Your email address
   - **Password**: At least 12 characters (recommended: 16+)
   - **Confirm Password**: Same as password
4. Click **"Create"**

You're now logged in as an admin! 🎉

### Step 6: Verify Installation

Let's verify everything is working correctly.

#### 6.1 Test Database Connection

1. In the admin panel, navigate to **Collections** → **Posts**
2. Click **"Create New"**
3. Add a title and some content
4. Click **"Save"**
5. If it saves successfully, your database connection is working! ✅

#### 6.2 Test Media Upload

1. In the admin panel, go to **Media**
2. Click **"Upload"** button
3. Select an image file
4. The image should upload and appear in your media library
5. If successful, Vercel Blob storage is working! ✅

#### 6.3 Test CMS Functionality

1. Create a new **Page** in the admin panel
2. Add a slug (e.g., "test-page")
3. Add some content
4. Save and publish
5. Visit `http://localhost:4000/test-page`
6. You should see your page! ✅

#### 6.4 Test API Endpoints (Advanced)

```bash
# Test health endpoint
curl http://localhost:4000/api/health

# Test CMS API
curl http://localhost:4000/api/posts
```

---

## Understanding the System

Now that RevealUI is running, let's understand how it works.

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

## First Steps After Setup

Now that everything is working, here's what to do next.

### 1. Explore the Admin Panel

- **Collections**: View and manage your content types
- **Media**: Upload and organize images/files
- **Users**: Manage user accounts
- **Settings**: Configure your site

### 2. Create Your First Content

1. Create a **Page** for your homepage
2. Create a **Post** as a test blog entry
3. Upload some **Media** to your library

### 3. Customize Your Site

- Edit `apps/cms/revealui.config.ts` to customize collections
- Modify `apps/web` to customize the frontend
- Update Tailwind config for styling

### 4. Learn the API

```bash
# List all posts
curl http://localhost:4000/api/posts

# Get a specific post
curl http://localhost:4000/api/posts/{id}

# Create a new post (requires authentication)
curl -X POST http://localhost:4000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "My First Post", "content": "Hello, RevealUI!"}'
```

### 5. Set Up Version Control

```bash
# Initialize git if not already done
git init

# Create .gitignore if needed (should already exist)
# Add and commit your changes (excluding .env files)
git add .
git commit -m "Initial commit: RevealUI setup"
```

---

## Common Workflows

### Creating a New Collection

1. Open `apps/cms/revealui.config.ts`
2. Add a new collection to the `collections` array:

```typescript
{
  slug: 'products',
  labels: {
    singular: 'Product',
    plural: 'Products',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    // ... more fields
  ],
}
```

3. Restart the dev server: `pnpm dev`
4. The new collection will appear in the admin panel

### Uploading Media

1. Go to **Media** in the admin panel
2. Click **"Upload"**
3. Select files (supports: images, PDFs, etc.)
4. Files are automatically uploaded to Vercel Blob Storage
5. Use the media URL in your content

### Creating Custom Pages

1. Go to **Pages** in the admin panel
2. Click **"Create New"**
3. Set a **slug** (URL path, e.g., "about")
4. Add content using the rich text editor
5. Save and publish
6. Visit `http://localhost:4000/about`

### Managing Users

1. Go to **Users** in the admin panel
2. Click **"Create New"** to add users
3. Assign roles (Admin, User, etc.)
4. Users can log in at `/admin`

---

## Troubleshooting

### Database Connection Errors

**Error**: `Cannot connect to database`

**Solutions**:
1. Verify `POSTGRES_URL` is correct in `.env.development.local`
2. Check that your NeonDB project is active (not paused)
3. Ensure the connection string includes `?sslmode=require`
4. Test the connection string directly:
   ```bash
   psql "your_connection_string_here"
   ```

### Blob Storage Errors

**Error**: `Blob storage error` or `Failed to upload media`

**Solutions**:
1. Verify `BLOB_READ_WRITE_TOKEN` is correct
2. Check token permissions in Vercel dashboard (should be "Read & Write")
3. Ensure the token hasn't expired
4. Verify the Blob store exists and is active

### Authentication Issues

**Error**: `Authentication error` or `Invalid session`

**Solutions**:
1. Verify `REVEALUI_SECRET` is set and is 32+ characters
2. Check that `REVEALUI_PUBLIC_SERVER_URL` matches your local URL
3. Clear browser cookies and try again
4. Restart the dev server after changing environment variables

### Port Already in Use

**Error**: `Port 4000 is already in use` or `Port 3000 is already in use`

**Solutions**:

```bash
# Option 1: Kill the process using the port (Linux/Mac)
lsof -ti:4000 | xargs kill -9

# Option 2: Use a different port
PORT=4001 pnpm start:cms
PORT=3001 pnpm start:web

# Option 3: Find and stop the conflicting process
# Check what's using the port
lsof -i :4000  # Mac/Linux
netstat -ano | findstr :4000  # Windows
```

### Module Not Found Errors

**Error**: `Cannot find module` or `Module not found`

**Solutions**:
1. Ensure dependencies are installed: `pnpm install`
2. Clear cache and reinstall:
   ```bash
   rm -rf node_modules packages/*/node_modules apps/*/node_modules
   pnpm install
   ```
3. Rebuild packages: `pnpm build:all-packages`

### TypeScript Errors

**Error**: Type errors in IDE or during build

**Solutions**:
1. Run type checking: `pnpm typecheck:all`
2. Ensure TypeScript is up to date
3. Restart your IDE/editor
4. Check `tsconfig.json` settings

### Build Errors

**Error**: Build fails with various errors

**Solutions**:
1. Ensure all environment variables are set
2. Clean build artifacts: `pnpm clean`
3. Rebuild everything: `pnpm build`
4. Check for syntax errors in configuration files

---

## Next Steps

Congratulations! You've successfully set up RevealUI. Here's what to do next:

### Immediate Next Steps

1. **Read the Documentation**
   - [Quick Start Guide](./QUICK_START.md) - Quick reference
   - [Environment Variables Guide](../development/ENVIRONMENT-VARIABLES-GUIDE.md) - Complete env setup
   - [Deployment Runbook](./deployment/DEPLOYMENT-RUNBOOK.md) - Deploy to production

2. **Explore Examples**
   - [Basic Blog](../../examples/basic-blog/) - Simple blog example
   - [E-commerce](../../examples/e-commerce/) - Full e-commerce site
   - [Portfolio](../../examples/portfolio/) - Portfolio website

3. **Learn the Framework**
   - [Component Library](../../packages/core/README.md) - Available components
   - [API Documentation](../reference/) - API reference
   - [Architecture Guide](../development/) - System architecture

### Development Resources

- **Code Style**: [LLM Code Style Guide](../development/LLM-CODE-STYLE-GUIDE.md)
- **Testing**: [Testing Strategy](../development/testing/TESTING-STRATEGY.md)
- **Contributing**: [Contributing Guide](../../CONTRIBUTING.md)

### Deployment

When ready to deploy:

1. **Vercel** (Recommended)
   - [CI/CD Guide](../development/CI-CD-GUIDE.md)
   - [Deployment Runbook](./deployment/DEPLOYMENT-RUNBOOK.md)

2. **Self-Hosting**
   - [Deployment Runbook](./deployment/DEPLOYMENT-RUNBOOK.md) - Has self-hosting instructions

### Community & Support

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) - Ask questions
- 🐛 [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues) - Report bugs
- 📧 [Email Support](mailto:support@revealui.com) - Get help

### Additional Learning

- **React 19**: [Official Docs](https://react.dev)
- **Next.js 16**: [Official Docs](https://nextjs.org/docs)
- **Tailwind CSS v4**: [Official Docs](https://tailwindcss.com)
- **Drizzle ORM**: [Official Docs](https://orm.drizzle.team)
- **NeonDB**: [Official Docs](https://neon.tech/docs)

---

## Quick Reference

### Essential Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm start                  # Start production server

# Database
pnpm db:init                # Initialize database
pnpm db:fresh               # Reset database
pnpm db:migrate             # Run migrations

# Testing
pnpm test                   # Run tests
pnpm test:coverage          # Run tests with coverage
pnpm test:integration       # Run integration tests

# Code Quality
pnpm lint                   # Lint code
pnpm lint:fix               # Fix linting issues
pnpm format                 # Format code
pnpm typecheck:all          # Type check all packages

# Utilities
pnpm generate:secret        # Generate a new secret
pnpm validate:env           # Validate environment variables
```

### Key File Locations

- **CMS Config**: `apps/cms/revealui.config.ts`
- **Environment**: `.env.development.local`
- **Package Config**: `package.json`
- **Database Schema**: `packages/db/src/core/`

### Important URLs

- **Local CMS**: http://localhost:4000/admin
- **Local Web**: http://localhost:3000
- **API Base**: http://localhost:4000/api

---

## Getting Help

If you're stuck:

1. **Check Documentation**: Start with [docs/README.md](../README.md)
2. **Search Issues**: Check [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)
3. **Ask Questions**: [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)
4. **Email Support**: support@revealui.com

---

**Welcome to RevealUI!** 🎉 We're excited to have you on board. Happy building!

---

**Last Updated**: January 2026  
**Version**: 0.1.0  
**Maintainer**: RevealUI Team
