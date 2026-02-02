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

> **⚠️ Status:** This framework is in active development and is **NOT production ready**. See [Project Status](docs/PROJECT_STATUS.md) for details.

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

**Get started in 5 minutes** → [Quick Start Guide](docs/QUICK_START.md)

```bash
# Clone and install
git clone https://github.com/RevealUIStudio/reveal.git
cd reveal && pnpm install

# Setup environment (see Quick Start Guide for credentials)
cp .env.template .env.development.local

# Start development
pnpm dev  # Visit http://localhost:4000/admin
```

For complete setup instructions, environment variables, and troubleshooting, see [Quick Start Guide](docs/QUICK_START.md).

## 🛠️ Development Environment

RevealUI supports **Nix**, **Dev Containers**, or **Manual** setup. Choose based on your platform:

| Platform | Recommended | Guide |
|----------|-------------|-------|
| Linux/NixOS-WSL | **Nix** (fastest) | See `flake.nix` + [Quick Start](docs/QUICK_START.md) |
| Windows/Mac | **Dev Containers** | See [.devcontainer/README.md](.devcontainer/README.md) |
| Traditional | **Manual** | [Quick Start Guide](docs/QUICK_START.md) |

**Prerequisites**: Node.js 24.12.0+, pnpm 9.14.2+, NeonDB, Vercel Blob
**Complete Setup**: See [Quick Start Guide](docs/QUICK_START.md) for detailed instructions

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
- **TypeScript**: ✅ **Type safety improved** - 109 `any` types eliminated from production code

### 🛠️ Developer Experience

**World-class tooling** for productivity and code quality:

#### Script Management
- **Package Templates**: Standardized scripts across all packages
- **Auto-Fix**: `pnpm scripts:fix` adds missing scripts automatically
- **Validation**: `pnpm scripts:validate` ensures compliance (21/21 packages passing, 97.9/100 score)
- **Health Monitoring**: `pnpm scripts:health` for complete health checks

#### Performance Monitoring
- **Interactive Dashboard**: `pnpm dashboard` for real-time metrics
- **Profiling Tools**: `pnpm profile:build`, `pnpm profile:test` for bottleneck detection
- **Telemetry**: Built-in event tracking and analytics
- **Cache Analytics**: Monitor turbo cache performance

#### Developer Tools
- **Script Explorer**: `pnpm explore` - Interactive menu to discover and run scripts
- **Maintenance CLI**: `pnpm maintain` - Automated fixes for imports, linting, types
- **Analysis Tools**: Code quality, type analysis, console usage tracking
- **Release Management**: `pnpm release` - Automated versioning and publishing

#### Documentation
- **[Script Standards](scripts/STANDARDS.md)** - Complete script reference and conventions
- **[Package Templates](package-templates/README.md)** - Ready-to-use script templates
- **[CLI Reference](SCRIPTS.md)** - All 100+ available commands

**See**: [SCRIPTS.md](SCRIPTS.md) for complete command reference

### 🤖 AI Skills Integration

**✨ NEW**: RevealUI integrates with the [Vercel Skills](https://skills.sh) ecosystem, providing access to 100+ professional AI agent skills while preserving RevealUI's advanced features (semantic search, context-aware activation):

```bash
# Browse trending skills from Vercel ecosystem
pnpm skills:trending

# Search for skills
pnpm skills:search:vercel "react"

# Install professional React patterns from Vercel
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

# Update installed skills
pnpm skills update react-best-practices

# List all skills (from all sources)
pnpm skills:list
```

**Key Benefits:**
- 🎯 **100+ Professional Skills** from Vercel Engineering (10 years of React/Next.js expertise)
- 🔍 **Unified Management** - Vercel, GitHub, and local skills work seamlessly together
- 🧠 **Semantic Search** - AI-powered embeddings for intelligent skill matching
- 🔄 **Automatic Updates** - Keep ecosystem skills current
- 📊 **Trending Discovery** - See what's popular in the community
- ✅ **Zero Breaking Changes** - Bridge architecture, no migration needed
- 🧪 **Production Ready** - 12/12 tests passing

**Documentation:**
- **[Complete Guide](VERCEL_SKILLS.md)** - Installation, usage, architecture, and examples
- **[Integration Summary](VERCEL_SKILLS_INTEGRATION_COMPLETE.md)** - Implementation details and verification

**Recommended Skills for RevealUI:**
- `react-best-practices` (81.7K installs) - React optimization patterns
- `nextjs-best-practices` (45.2K installs) - Next.js App Router patterns
- `typescript-patterns` (38.9K installs) - TypeScript best practices
- `web-design-guidelines` (61.9K installs) - Accessibility & performance

**Current Skills Installed:** 5 custom RevealUI skills (architecture, testing, React/Next.js patterns)

## ⚠️ Current Status

**Status:** 🔴 **Active Development - NOT Production Ready**

RevealUI is in active development with critical blockers that must be addressed before production use:

- ❌ **Tests cannot run** - Cyclic dependency issues
- ❌ **TypeScript errors** - Type checking fails
- ⚠️ **Code quality issues** - 710 console.log statements (✅ 109 `any` types eliminated)
- ⚠️ **Security needs verification** - SQL injection fix needs testing

**See:**
- [Project Status](docs/PROJECT_STATUS.md) - Current project state and blockers
- [Project Roadmap](docs/PROJECT_ROADMAP.md) - Path to production

**Estimated time to production readiness:** 6-8 weeks with focused effort

---

## 📚 Examples

### CLI Demos & Tutorials

Interactive tutorials for RevealUI's developer tools:

- [**Script Management Demo**](examples/cli-demos/script-management-demo.md) - Audit, validate, and auto-fix package scripts
- [**Dashboard Demo**](examples/cli-demos/dashboard-demo.md) - Real-time performance monitoring
- [**Explorer Demo**](examples/cli-demos/explorer-demo.md) - Discover and run scripts interactively
- [**Profiling Demo**](examples/cli-demos/profiling-demo.md) - Identify and fix performance bottlenecks
- [**Maintenance Demo**](examples/cli-demos/maintenance-demo.md) - Auto-fix imports, linting, and type errors

**→ [View all CLI demos](examples/cli-demos/README.md)**

### Example Projects

Check out our example projects:

- [**Basic Blog**](examples/basic-blog) - Simple blog with posts and comments
- [**E-commerce**](examples/e-commerce) - Full e-commerce with Stripe integration
- [**Portfolio**](examples/portfolio) - Personal portfolio site

> **Note:** Example projects may not work until critical blockers are resolved.

## 🏗️ Architecture

**Stack**: React 19 + Next.js 16 + NeonDB + Tailwind CSS v4 + Vercel Edge

Monorepo structure with clear separation:
- `apps/` - Next.js applications (CMS, web)
- `packages/` - Shared packages (core, db, ui, contracts)

For complete architecture, tech stack, and design patterns → [Architecture Guide](docs/ARCHITECTURE.md)

## 🚀 Deployment

**Optimized for Vercel** (recommended) - Also supports Railway, Fly.io, AWS, GCP, or self-hosting.

```bash
vercel  # One command deployment
```

For complete deployment guide with environment variables, monitoring, and rollback procedures → [CI/CD Guide](docs/CI_CD_GUIDE.md)

## 📖 Documentation

### Essential Reading

- **[Project Status](docs/PROJECT_STATUS.md)** - ⚠️ **START HERE** - Current state and blockers
- **[Project Roadmap](docs/PROJECT_ROADMAP.md)** - Clear path to production readiness
- **[Documentation Index](docs/README.md)** - Complete documentation navigation

### Getting Started

- **[Framework Overview](docs/OVERVIEW.md)** - ⭐ **NEW USERS START HERE** - Complete framework introduction
- [Quick Start Guide](docs/QUICK_START.md) - Get started in 5 minutes
- [Environment Setup](docs/ENVIRONMENT_VARIABLES_GUIDE.md) - Configure environment variables
- [Database Guide](docs/DATABASE.md) - Complete database setup and management

### Development

- [CI/CD Guide](docs/CI_CD_GUIDE.md) - Complete deployment guide with NeonDB and Vercel
- [Testing Strategy](docs/testing/TESTING-STRATEGY.md) - Testing guidelines
- [Code Standards](docs/STANDARDS.md) - Complete coding standards and best practices
- **[Script Standards](scripts/STANDARDS.md)** - Package.json script conventions (⭐ NEW)
- **[Scripts Reference](SCRIPTS.md)** - All 100+ CLI commands (⭐ UPDATED)
- [Database Guide](docs/DATABASE.md) - Drizzle ORM and database integration

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

**Current Focus**: Reaching production readiness (6-8 weeks)

**Critical Blockers** → **Testing & Verification** → **Code Quality** → **v1.0.0 Release**

For detailed roadmap with timelines and milestones → [Project Roadmap](docs/PROJECT_ROADMAP.md)

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
