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

RevealUI is a production-ready, full-stack React framework that combines the best of modern web development:

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
# Install dependencies
pnpm install

# Copy environment template
cp apps/cms/.env.template .env.development.local

# Edit .env.development.local with your credentials
# See QUICK_START.md for detailed setup

# Start development server
pnpm dev

# Open http://localhost:4000/admin
```

### Prerequisites

- Node.js 24.12.0+
- pnpm 9.14.2+
- NeonDB Postgres database
- Vercel Blob storage account

### First-time Setup

See our [Quick Start Guide](docs/guides/QUICK_START.md) for detailed instructions on:

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

- **Comprehensive Tests**: Unit, integration, E2E
- **Input Validation**: Zod schemas throughout
- **CSRF Protection**: Built-in security
- **Rate Limiting**: Protect your APIs
- **TypeScript**: Full type safety

## 📚 Examples

Check out our example projects:

- [**Basic Blog**](examples/basic-blog) - Simple blog with posts and comments
- [**E-commerce**](examples/e-commerce) - Full e-commerce with Stripe integration
- [**Portfolio**](examples/portfolio) - Personal portfolio site

More examples coming soon!

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

See [Deployment Runbook](docs/guides/deployment/DEPLOYMENT-RUNBOOK.md) for complete deployment guide.

### Self-Hosting

You can also deploy to any Node.js hosting provider:

- DigitalOcean App Platform
- Railway
- Fly.io
- AWS/Google Cloud
- Your own VPS

See [Deployment Runbook](docs/guides/deployment/DEPLOYMENT-RUNBOOK.md) for platform-specific guides.

## 📖 Documentation

- [Documentation Index](docs/README.md) - Complete documentation navigation
- [Quick Start Guide](docs/guides/QUICK_START.md) - Get started in 5 minutes
- [Changelog](CHANGELOG.md) - Version history and breaking changes
- [CI/CD Guide](docs/development/CI-CD-GUIDE.md) - Deployment with NeonDB
- [Deployment Runbook](docs/guides/deployment/DEPLOYMENT-RUNBOOK.md) - Production deployment guide
- [Environment Setup](docs/development/ENVIRONMENT-VARIABLES-GUIDE.md) - Configure environment variables
- [Testing Strategy](docs/development/testing/TESTING-STRATEGY.md) - Testing guidelines
- [AI Package Testing](packages/ai/TESTING.md) - Testing limitations and validation for @revealui/ai
- [Drizzle Guide](docs/development/DRIZZLE-GUIDE.md) - Drizzle ORM / Neon HTTP integration
- [Multi-tenant Architecture](docs/development/MULTI-TENANT-ARCHITECTURE.md) - Tenant isolation
- [Security Best Practices](SECURITY.md) - Security guidelines
- [Code Style Guidelines](docs/development/CODE-STYLE-GUIDELINES.md) - Coding standards
- [Blog Creation Guide](docs/guides/BLOG-CREATION-GUIDE.md) - How to create blog posts
- [Verification Guide](docs/guides/VERIFICATION-GUIDE.md) - How to verify agent claims independently
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

- [ ] v1.0.0 - Stable release
- [ ] Documentation site
- [ ] Premium component library
- [ ] CLI scaffolding tool
- [ ] Visual page builder
- [ ] More integrations (Auth0, Sentry, etc.)
- [ ] RevealUI Cloud (hosted service)

See our [full roadmap](https://github.com/RevealUIStudio/revealui/projects) for more details.

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
