# RevealUI Framework

<div align="center">

**Modern React 19 Framework with Next.js 16 and Native CMS**

[![npm version](https://img.shields.io/npm/v/reveal.svg)](https://www.npmjs.com/package/reveal)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

[Documentation](https://revealui.com) • [Quick Start](#quick-start) • [Examples](#examples) • [Community](https://github.com/RevealUIStudio/revealui/discussions)

</div>

---

## 🚀 What is RevealUI?

RevealUI is a modern, full-stack React framework in active development that combines the best of modern web development:

> **⚠️ Status:** This framework is in active development and is **NOT production ready**. See [Production Readiness Assessment](docs/PRODUCTION_READINESS.md) for details.

- ⚡ **React 19** with Server Components
- 🎨 **Tailwind CSS v4** (10-100x faster builds)
- 📦 **Native CMS** (Headless CMS built-in)
- 🔥 **Next.js 16** & **RevealUI** for SSR/SSG
- 🗄️ **NeonDB + Drizzle ORM** for database
- 🌐 **Vercel-optimized** (Edge-ready, instant deployments)
- 🧪 **Comprehensive Tests**
- 🔒 **Enterprise-grade security**
- 🎯 **TypeScript** throughout

### Perfect for:

- 🏢 **Agencies** building client sites
- 🚀 **Startups** needing rapid development
- 💼 **Enterprises** requiring scalability
- 👨‍💻 **Developers** wanting modern DX

## ⚡ Quick Start

Get started in 3 minutes:

```bash
# 1. Ensure correct Node version
nvm use 24.12.0

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.template .env.development.local

# 4. Edit .env.development.local with your credentials
# See QUICK_START.md for detailed setup

# 5. Start development server
pnpm dev

# 6. Open http://localhost:4000/admin
```

## 🛠️ Development Environment

RevealUI supports multiple development environments. Choose the best option for your system:

### Option 1: Pure Nix (Recommended for Linux/NixOS-WSL)

**Best for:** Fast, reproducible, zero vendor lock-in

```bash
# Install Nix (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install

# Enable direnv (automatic environment activation)
direnv allow

# Everything else happens automatically!
pnpm install
pnpm db:init
pnpm dev
```

→ See [docs/guides/NIX_SETUP.md](docs/guides/NIX_SETUP.md) for detailed instructions

### Option 2: Dev Containers (Recommended for Windows/Mac/GitHub Codespaces)

**Best for:** Docker-based, works everywhere, VS Code integration

- Open project in VS Code
- Click "Reopen in Container" when prompted
- Wait for container build
- Run `pnpm dev`

→ See [.devcontainer/README.md](.devcontainer/README.md) for detailed instructions

### Option 3: Manual Setup (Traditional)

**Best for:** Customization or troubleshooting

```bash
# 1. Install Node.js 24.12.0
nvm use 24.12.0

# 2. Install pnpm
npm install -g pnpm

# 3. Install PostgreSQL 16
# (platform-specific - see your OS docs)

# 4. Continue with Quick Start above
```

### Which Environment Should I Use?

| Your Situation | Recommended Choice |
|----------------|-------------------|
| On Linux/NixOS-WSL | **Pure Nix** (fastest, most control) |
| On Windows/Mac | **Dev Containers** (Docker-based) |
| Using GitHub Codespaces | **Dev Containers** (native support) |
| Want traditional setup | **Manual Setup** |
| Team with mixed OSes | **Dev Containers** (most compatible) |

**Environment Comparison:** See [docs/guides/ENVIRONMENT_COMPARISON.md](docs/guides/ENVIRONMENT_COMPARISON.md) for detailed feature comparison and migration guides.

**⚠️ Note:** Our CI environment uses vanilla GitHub Actions (Node 24.12.0 + pnpm 10.28.2). Local environments provide convenience but don't exactly match CI. See [docs/development/CI_ENVIRONMENT.md](docs/development/CI_ENVIRONMENT.md) for details.

### Prerequisites

- **Node.js 24.12.0+** (required - automatically provided by Nix/Dev Containers)
- pnpm 9.14.2+ (automatically provided by Nix/Dev Containers)
- NeonDB Postgres database
- Vercel Blob storage account

### First-time Setup

**New to RevealUI?** Start with our [Onboarding Guide](docs/onboarding/ONBOARDING.md) - Complete setup and orientation guide.

**Quick setup?** Use our [Quick Start Guide](docs/onboarding/QUICK_START.md) for 5-minute setup.

Both guides cover:

- Setting up environment variables
- Configuring database and storage
- Creating your first admin user
- Deploying to production

## ✨ Key Features

### 🎨 Modern UI Components

50+ production-ready components built with Tailwind CSS v4:

- Buttons, Cards, Forms, Modals
- Navigation, Lists, Tables
- Charts, Graphs, Animations
- Dark mode built-in
- Fully accessible (WCAG 2.1)

### 📦 Native CMS

Enterprise headless CMS pre-configured with:

- **Collections**: Users, Posts, Pages, Media, Categories
- **Authentication**: Role-based access control
- **Media Management**: Vercel Blob storage
- **Draft Preview**: Preview before publishing
- **Live Preview**: Real-time editing
- **Rich Text**: Lexical editor

### ⚡ Performance & Optimization

- **SSR/SSG**: Server-side rendering with RevealUI
- **Edge-ready**: Deploy to Vercel Edge Network
- **Code splitting**: Automatic optimization
- **Image optimization**: Next.js Image component
- **Caching**: Built-in caching strategies

### 🔒 Security & Quality

- **Testing Infrastructure**: Test setup exists (currently blocked by cyclic dependencies)
- **Input Validation**: Zod schemas throughout
- **CSRF Protection**: Built-in security
- **Rate Limiting**: Protect your APIs
- **TypeScript**: Type safety (needs improvement - 267 `any` types remain)

## ⚠️ Current Status

**Status:** 🔴 **Active Development - NOT Production Ready**

RevealUI is in active development with critical blockers that must be addressed before production use:

- ❌ **Tests cannot run** - Cyclic dependency issues
- ❌ **TypeScript errors** - Type checking fails
- ❌ **Code quality issues** - 710 console.log statements, 267 `any` types
- ⚠️ **Security needs verification** - SQL injection fix needs testing

**See:**
- [Production Readiness Assessment](docs/PRODUCTION_READINESS.md) - Detailed assessment
- [Production Roadmap](docs/PRODUCTION_ROADMAP.md) - Path to production
- [Current Status](docs/STATUS.md) - Single source of truth

**Estimated time to production readiness:** 6-8 weeks with focused effort

---

## 📚 Examples

Check out our example projects:

- [**Basic Blog**](examples/basic-blog) - Simple blog with posts and comments
- [**E-commerce**](examples/e-commerce) - Full e-commerce with Stripe integration
- [**Portfolio**](examples/portfolio) - Personal portfolio site

> **Note:** Examples may not work until critical blockers are resolved.

## 🏗️ Architecture

RevealUI follows clean architecture principles:

```
revealui/
├── apps/
│   ├── cms/                # Next.js CMS application
│   └── web/                # RevealUI web application
├── packages/
│   ├── revealui/           # Core CMS framework
│   ├── presentation/      # Shared UI components
│   ├── schema/             # Zod schemas
│   ├── db/                 # Drizzle ORM schemas
│   └── memory/             # CRDT-based persistent memory system
└── docs/                   # Documentation
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Next.js 16, RevealUI |
| Styling | Tailwind CSS v4 |
| CMS | @revealui/core |
| Database | NeonDB Postgres + Drizzle ORM |
| Storage | Vercel Blob |
| Auth | RevealUI Auth |
| Testing | Vitest |
| Deployment | Vercel Edge |

## 🚀 Deployment

### Vercel (Recommended)

RevealUI is optimized for Vercel:

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel
```

### Environment Variables

Configure these in your Vercel project settings:

- `REVEALUI_SECRET` - Secret key for encryption
- `POSTGRES_URL` - NeonDB connection string
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
- `STRIPE_SECRET_KEY` - Stripe secret key (if using payments)

See [Deployment Runbook](docs/onboarding/DEPLOYMENT-RUNBOOK.md) for complete deployment guide.

### Self-Hosting

You can also deploy to any Node.js hosting provider:

- DigitalOcean App Platform
- Railway
- Fly.io
- AWS/Google Cloud
- Your own VPS

See [Deployment Runbook](docs/onboarding/DEPLOYMENT-RUNBOOK.md) for platform-specific guides.

## 📖 Documentation

### Essential Reading

- **[Production Readiness Assessment](docs/PRODUCTION_READINESS.md)** - ⚠️ **START HERE** - Current state and blockers
- **[Production Roadmap](docs/PRODUCTION_ROADMAP.md)** - Clear path to production readiness
- **[Current Status](docs/STATUS.md)** - Single source of truth for project status
- **[Documentation Index](docs/README.md)** - Complete documentation navigation

### Getting Started

- **[Onboarding Guide](docs/onboarding/ONBOARDING.md)** - ⭐ **NEW USERS START HERE** - Complete first-time setup and orientation
- [Quick Start Guide](docs/onboarding/QUICK_START.md) - Get started in 5 minutes
- [Environment Setup](docs/infrastructure/ENVIRONMENT-VARIABLES-GUIDE.md) - Configure environment variables
- [Fresh Database Setup](docs/database/FRESH-DATABASE-SETUP.md) - Database setup guide

### Development

- [CI/CD Guide](docs/infrastructure/CI-CD-GUIDE.md) - Deployment with NeonDB
- [Deployment Runbook](docs/onboarding/DEPLOYMENT-RUNBOOK.md) - Production deployment guide
- [Testing Strategy](docs/testing/TESTING-STRATEGY.md) - Testing guidelines
- [Code Style Guidelines](docs/standards/LLM-CODE-STYLE-GUIDE.md) - Coding standards
- [Drizzle Guide](docs/infrastructure/DRIZZLE-GUIDE.md) - Drizzle ORM / Neon HTTP integration

### Reference

- [Changelog](CHANGELOG.md) - Version history and breaking changes
- [Security Best Practices](SECURITY.md) - Security guidelines
- [Third Party Licenses](docs/legal/THIRD_PARTY_LICENSES.md) - Open source license information

### Documentation Lifecycle Manager

Automatically track, validate, and manage documentation files to prevent stale documentation from accumulating:

```bash
# Check for stale documentation (no changes)
pnpm docs:check

# Archive stale files to docs/archive/
pnpm docs:archive

# Watch mode (runs continuously)
pnpm docs:watch

# Check and archive in one command
pnpm docs:clean
```

The tool validates package names, file references, code snippets, and automatically archives outdated files. See `docs-lifecycle.config.json` for configuration options.

## 🤝 Contributing

We love contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to learn about our development process, how to propose bugfixes and improvements, and how to build and test your changes.

### Contributors

Thanks to all our contributors! 🎉

## 📝 License

RevealUI is [MIT licensed](LICENSE). See [Third Party Licenses](docs/legal/THIRD_PARTY_LICENSES.md) for dependencies.

## 💬 Community & Support

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) - Ask questions and share ideas
- 🐛 [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues) - Report bugs and request features  
- 📧 [Email Support](mailto:support@revealui.com) - Get help from the team
- 🔒 [Security](mailto:security@revealui.com) - Report security vulnerabilities

## 🌟 Show Your Support

If RevealUI helps you build amazing projects, please give us a ⭐ on [GitHub](https://github.com/RevealUIStudio/reveal)!

## 🗺️ Roadmap

**Current Focus:** Reaching production readiness (see [Production Roadmap](docs/PRODUCTION_ROADMAP.md))

### Phase 1: Critical Blockers (Weeks 1-2)
- [ ] Fix cyclic dependencies
- [ ] Fix TypeScript errors
- [ ] Remove console.log from production code
- [ ] Replace critical `any` types
- [ ] Verify security fixes

### Phase 2: Testing & Verification (Weeks 2-3)
- [ ] Run full test suite
- [ ] Achieve 70%+ test coverage
- [ ] Integration testing
- [ ] Functionality verification

### Phase 3: Code Quality & Security (Weeks 3-4)
- [ ] Complete code quality improvements
- [ ] Security audit
- [ ] Performance testing

### Phase 4: Documentation & Polish (Weeks 4-5)
- [ ] Consolidate documentation
- [ ] Update production docs
- [ ] Final verification

### Future (Post-Production)
- [ ] v1.0.0 - Stable release
- [ ] Documentation site
- [ ] Premium component library
- [ ] CLI scaffolding tool
- [ ] Visual page builder
- [ ] More integrations (Auth0, Sentry, etc.)
- [ ] RevealUI Cloud (hosted service)

See [Production Roadmap](docs/PRODUCTION_ROADMAP.md) for detailed plan.

## 📚 Learn More

- [React 19 Documentation](https://react.dev)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [NeonDB Documentation](https://neon.tech/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [RevealUI Documentation](https://revealui.dev)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com)

---

<div align="center">

**Built with ❤️ by the RevealUI Team**

[Website](https://revealui.com) • [Documentation](https://docs.revealui.com) • [Twitter](https://twitter.com/revealui)

</div>
