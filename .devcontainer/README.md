# RevealUI Dev Container

This directory contains the Dev Container configuration for RevealUI, enabling developers to work in a consistent, fully-configured development environment.

## When to Use Dev Containers

**Choose Dev Containers if you:**
- ✅ Are on **Windows or Mac** (Docker works everywhere)
- ✅ Use **GitHub Codespaces** (native support)
- ✅ Prefer **VS Code** as your primary editor
- ✅ Need **Node.js 24.13.0 exactly** (matches CI)
- ✅ Want a **familiar Docker-based** workflow
- ✅ Work on a **team with mixed operating systems**

**Choose Pure Nix instead if you:**
- ⚠️ Are on **Linux or NixOS-WSL** (faster, more lightweight)
- ⚠️ Want **zero vendor lock-in** (no Docker dependency)
- ⚠️ Prefer **native performance** over containers
- ⚠️ Want **Node.js 24** with native performance (available in nixpkgs)

**Comparison:** See [docs/ENVIRONMENT_VARIABLES_GUIDE.md](../docs/ENVIRONMENT_VARIABLES_GUIDE.md) for environment configuration details.

## Advantages of Dev Containers

**✅ Perfect for this project because:**
- Works on **all platforms** (Windows, Mac, Linux)
- **Exact Node.js 24.13.0** (matches CI environment)
- **Native VS Code integration** (seamless experience)
- **GitHub Codespaces ready** (cloud development)
- **Service orchestration** (PostgreSQL, ElectricSQL, etc.)
- **Pre-configured extensions** (Biome, Tailwind, etc.)
- **Team consistency** (everyone gets identical setup)

**⚠️ Trade-offs:**
- Slower than native (Docker overhead)
- Heavier resource usage (RAM, disk space)
- Requires Docker Desktop (Windows/Mac)
- Container networking complexity

## Quick Start

### Option 1: VS Code

1. Install [VS Code](https://code.visualstudio.com/) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open this folder in VS Code
3. Press `F1` and select **"Dev Containers: Reopen in Container"**
4. Wait for the container to build and start (first time takes 2-3 minutes)
5. Run `pnpm dev` to start development

### Option 2: GitHub Codespaces

1. Go to the repository on GitHub
2. Click the green **"Code"** button
3. Select the **"Codespaces"** tab
4. Click **"Create codespace on main"**
5. Wait for Codespace to initialize
6. Run `pnpm dev` to start development

## What's Included

### Tools & Runtimes
- **Node.js 24.13.0** - Latest LTS with modern features
- **pnpm 10.28.2** - Fast, disk-efficient package manager
- **PostgreSQL 16 with pgvector** - Database with vector search
- **Electric SQL** - Real-time sync service
- **Git** - Version control

### VS Code Extensions
- **Biome** - Formatter and linter (sole linter)
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Docker** - Container management
- **Code Spell Checker** - Catch typos
- **GitLens** - Git supercharged
- **GitHub Copilot** - AI pair programmer (if you have access)

### Services
The Dev Container runs these services automatically:

| Service | Port | Description |
|---------|------|-------------|
| **PostgreSQL** | 5432 | Main database with pgvector extension |
| **Electric** | 5133 | Real-time sync service |
| **Marketing** | 3000 | Marketing site (after running `pnpm dev`) |
| **Docs** | 3002 | Documentation site (after running `pnpm dev`) |
| **API** | 3004 | REST API — Hono (after running `pnpm dev`) |
| **CMS** | 4000 | Admin dashboard + content management (after running `pnpm dev`) |

## Environment Variables

Create a `.env.local` file in the project root with your configuration:

```bash
# Copy from example
cp .env.template .env.local
# Edit with your values
code .env.local
```

For **GitHub Codespaces**, set secrets in:
- Repository → Settings → Secrets → Codespaces

## Post-Create Setup

The container automatically runs:
```bash
# Note: corepack enable removed - pnpm 10+ manages its own version
pnpm install
```

To complete setup, run:
```bash
# Initialize database
pnpm db:init

# Run migrations
pnpm db:migrate

# (Optional) Seed database
pnpm db:seed

# Start development
pnpm dev
```

## Common Commands

```bash
# Start all development servers
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Database commands
pnpm db:init      # Initialize database
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed database
```

## Troubleshooting

### Container won't start
- Check Docker is running: `docker ps`
- Rebuild container: `F1` → "Dev Containers: Rebuild Container"

### Database connection errors
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check `.env.local` has correct `DATABASE_URL`
- Try: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/revealui`

### Port already in use
- Stop conflicting services on ports 3000, 4000, 5432, 5133
- Or change ports in `docker-compose.yml`

### Slow performance
- Allocate more resources to Docker (Docker Desktop → Settings → Resources)
- Consider using named volumes instead of bind mounts

### Extensions not loading
- Reload window: `F1` → "Developer: Reload Window"
- Check extension installation: View → Extensions

## Architecture

```
.devcontainer/
├── devcontainer.json       # Main configuration
├── docker-compose.yml      # Service definitions
├── Dockerfile              # Custom image with tools
└── README.md               # This file

Services:
┌─────────────────────────────────────┐
│ app (Dev Container)                 │
│ - Node.js 24.13.0                   │
│ - pnpm 10.28.2                      │
│ - VS Code extensions                │
│ - Your workspace mounted            │
└─────────────────────────────────────┘
         │ network: service:db
         ↓
┌─────────────────────────────────────┐
│ db (PostgreSQL 16 + pgvector)       │
│ - Port: 5432                        │
│ - User: postgres / Pass: postgres   │
│ - Database: revealui                │
└─────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ electric (ElectricSQL)              │
│ - Port: 5133                        │
│ - Real-time sync                    │
└─────────────────────────────────────┘
```

## Benefits

- **Zero Config** - No need to install Node, pnpm, PostgreSQL locally
- **Consistent** - Everyone uses the same versions and tools
- **Isolated** - Won't conflict with other projects
- **Fast** - Cached layers, parallel builds
- **Portable** - Works on Windows, Mac, Linux
- **Cloud-Ready** - Seamlessly use GitHub Codespaces

## Customization

### Add VS Code Extension
Edit `devcontainer.json`:
```json
"extensions": [
  "existing.extension",
  "new.extension-id"
]
```

### Add System Package
Edit `Dockerfile`:
```dockerfile
RUN apt-get update && apt-get install -y \
    your-package-name
```

### Add Service
Edit `docker-compose.yml`:
```yaml
services:
  your-service:
    image: your-image
    ports:
      - "PORT:PORT"
```

## Learn More

- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [GitHub Codespaces](https://github.com/features/codespaces)
- [Dev Container Spec](https://containers.dev/)
