# @revealui/create-revealui

The official CLI for creating RevealUI projects with a single command.

## Usage

```bash
npm create revealui@latest
```

or with specific options:

```bash
npm create revealui@latest my-project -- --template basic-blog
```

## Features

- Interactive project setup with guided prompts
- Multiple templates: basic-blog, e-commerce, portfolio
- Automatic environment configuration
- Database setup (NeonDB, Supabase, or local PostgreSQL)
- Storage setup (Vercel Blob or Supabase)
- Payment setup (Stripe)
- Dev Container and Devbox configuration
- Git initialization with initial commit

## Options

```
Usage: create-revealui [options] [project-name]

Options:
  -t, --template <name>   Template to use (basic-blog, e-commerce, portfolio)
  --skip-git              Skip git initialization
  --skip-install          Skip dependency installation
  -h, --help             Display help for command
```

## Requirements

- Node.js 24.12.0 or higher
- pnpm 10.28.2 or higher

## What Gets Created

```
my-project/
├── apps/
│   ├── cms/              # CMS application
│   └── web/              # Frontend application
├── packages/
│   └── ...               # Shared packages
├── .devcontainer/        # Dev Container configuration
├── devbox.json           # Devbox configuration
├── .env.development.local # Environment variables
└── README.md             # Project documentation
```

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

## License

MIT
