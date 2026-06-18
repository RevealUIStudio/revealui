---
title: "@revealui/cli"
description: "The official CLI for creating RevealUI projects with a single command."
visibility: public
status: verified
audience: user
---

# @revealui/cli

The official CLI for creating RevealUI projects with a single command.

## Usage

```bash
pnpm create revealui@latest
```

or with specific options:

```bash
pnpm create revealui@latest my-project --template basic-blog
```

## Features

- Interactive project setup with guided prompts
- Multiple templates: basic-blog, e-commerce, portfolio, starter, starter-native (Vite + @revealui/router, no Next.js)
- Automatic environment configuration
- Database setup (NeonDB, Supabase, or local PostgreSQL)
- Storage setup (Cloudflare R2, or legacy Vercel Blob)
- Payment setup (Stripe)
- Dev Container and Devbox configuration
- Git initialization with initial commit

## Options

```
Usage: create-revealui [options] [project-name]

Options:
  -t, --template <name>   Template to use (basic-blog, e-commerce, portfolio, starter, starter-native)
  --skip-git              Skip git initialization
  --skip-install          Skip dependency installation
  -h, --help             Display help for command
```

### Templates

| Template | Stack | Best for |
|---|---|---|
| `basic-blog` | Next.js 16 + @revealui/* | Blogs, content sites — Next.js ecosystem |
| `e-commerce` | Next.js 16 + @revealui/* + Stripe | Online stores with checkout |
| `portfolio` | Next.js 16 + @revealui/* | Personal portfolio sites |
| `starter` | Next.js 16 + @revealui/* | Blank-canvas starting point — no sample collections |
| `starter-native` | Vite + @revealui/router + @revealui/* | RevealUI-native runtime — no Next.js dep. Best when you want to dogfood the full RevealUI stack. |

## Requirements

- Node.js 24.13.0 or higher
- pnpm 10.28.2 or higher

## What Gets Created

The Next.js templates (basic-blog, e-commerce, portfolio, starter) scaffold a single Next.js app:

```
my-project/
├── src/
│   ├── app/                   # Next.js App Router pages + template routes
│   ├── collections/           # RevealUI collections (not in starter)
│   └── seed.ts                # Database seed script
├── revealui.config.ts         # RevealUI configuration
├── next.config.mjs
├── postcss.config.mjs
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── .env.development.local     # Generated from your setup answers
└── README.md                  # Generated getting-started guide
```

The starter-native template scaffolds the Vite shape instead: `app/` (App.tsx, main.tsx, routes/, layouts/, styles/) plus `src/seed.ts`, `index.html`, `vite.config.ts`, and `vitest.config.ts` replace `src/app/` and the Next.js configs.

Answering yes to the Dev Container and Devbox prompts also creates `.devcontainer/` and `devbox.json`.

## Next Steps

After creating your project:

```bash
cd my-project
pnpm dev
```

Visit http://localhost:4000 to access the CMS.

## Development Environments

### Dev Containers

Open in VS Code and select "Reopen in Container" or use GitHub Codespaces.

### Devbox

```bash
devbox shell
pnpm dev
```

## When to Use This

- You're starting a new RevealUI project from scratch and want a guided setup
- You need database, storage, and payment providers configured in one step (`generateEnvFile`, `packages/cli/src/generators/env-file.ts:23`)
- You want Dev Container or Devbox configuration generated automatically
- **Not** for adding RevealUI to an existing project  -  install individual packages instead

## Design Principles

- **Justifiable**: Every prompt earns its place  -  template, database, storage, and payment choices all map to real config decisions
- **Adaptive**: Multiple templates (blog, e-commerce, portfolio, starter, starter-native) and environment options (DevContainer, Devbox) adapt to your workflow
- **Sovereign**: Scaffolds a self-contained project you fully own  -  no hosted dependency or account required

## License

MIT
