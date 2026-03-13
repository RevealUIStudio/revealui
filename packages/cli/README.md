# @revealui/cli

The official RevealUI CLI.

It now has two roles:

- `revealui`: operational commands for a RevealUI workspace
- `create-revealui`: compatibility alias for project scaffolding

## Usage

### Operational CLI

```bash
revealui doctor
revealui doctor --fix
revealui doctor --strict
revealui dev up
revealui dev up --include mcp
revealui dev up --profile fullstack
revealui dev up --profile fullstack --dry-run
revealui dev up --fix
revealui dev status
revealui dev status --profile agent
revealui dev profile set agent
revealui dev profile show
revealui db init
revealui db start
```

### Project scaffolding

```bash
pnpm create revealui@latest
```

or:

```bash
pnpm create revealui@latest my-project --template basic-blog
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
- Workspace doctor checks
- Local PostgreSQL lifecycle commands
- RevealUI dev/bootstrap command surface
- Named dev profiles for repeatable local bootstrap
- Optional MCP readiness checks during `revealui dev up`
- `dev status` previews the same plan that `dev up` executes
- `dev up --dry-run` previews actions without executing them
- `doctor --fix` and `dev up --fix` apply only safe local Postgres repairs
- `doctor` stays non-blocking for local interactive use unless `--strict`, `--json`, or `CI`

## Commands

### `revealui`

```
Usage: revealui [options] [command]

Commands:
  create [project-name]   Create a new RevealUI project
  doctor                  Check RevealUI workspace and developer environment health
  db                      Manage the local RevealUI database
  dev                     Prepare and manage the RevealUI development workspace
  shell                   Deprecated alias for `revealui dev shell`
```

### `create-revealui`

```
Usage: create-revealui [options] [project-name]

Options:
  -t, --template <name>   Template to use (basic-blog, e-commerce, portfolio)
  --skip-git              Skip git initialization
  --skip-install          Skip dependency installation
  -h, --help             Display help for command
```

### `revealui db`

```
Usage: revealui db [command]

Commands:
  init      Initialize the local PostgreSQL data directory
  start     Start the local PostgreSQL server
  stop      Stop the local PostgreSQL server
  status    Show local PostgreSQL status
  reset     Reset the local PostgreSQL data directory
  migrate   Run Drizzle migrations using the local RevealUI database environment
```

### `revealui dev`

```
Usage: revealui dev [command]

Commands:
  up        Ensure the local dev environment is ready, migrate the DB, optionally validate MCP, and start a dev script
  status    Show current RevealUI development environment status and the effective dev plan
  down      Stop local RevealUI development services that are managed by the CLI
  profile   Persist or inspect the default dev profile
  shell     Alias for `revealui dev up` without starting an app script
```

Built-in profiles:

- `local` - local DB bootstrap only
- `agent` - local bootstrap plus MCP validation
- `cms` - local bootstrap plus `dev:cms`
- `fullstack` - local bootstrap plus MCP validation and `dev`

Persist a local default:

```bash
revealui dev profile set agent
revealui dev profile show
```

This writes `.revealui/dev.json` in the workspace and is intended to stay local.

## Requirements

- Node.js 24.13.0 or higher
- pnpm 10.28.2 or higher

## What Gets Created

```
my-project/
├── apps/
│   ├── cms/              # CMS application
│   └── mainframe/        # Frontend application
├── packages/
│   └── ...               # Shared packages
├── .devcontainer/        # Dev Container configuration
├── devbox.json           # Devbox configuration
├── .env.development.local # Environment variables
└── README.md             # Project documentation
```

## Next Steps

For an existing RevealUI workspace:

```bash
revealui doctor
revealui doctor --fix
revealui dev status --profile agent
revealui dev up --profile fullstack --dry-run
revealui dev up --fix
revealui dev up
revealui dev up --include mcp
revealui dev up --profile agent
revealui dev status --profile fullstack
revealui dev profile set fullstack
```

After creating a new project:

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
