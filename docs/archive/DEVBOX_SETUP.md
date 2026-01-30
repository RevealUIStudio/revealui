# Devbox Setup Guide

Devbox provides a Nix-powered development environment with simple JSON configuration. Get reproducible, isolated development environments without learning Nix.

## Why Devbox?

- **Simple** - Configure with JSON, not Nix expressions
- **Fast** - Cached packages, instant environment activation
- **Reproducible** - Everyone gets identical tool versions
- **Isolated** - Per-project environments, no global pollution
- **Powerful** - Access to 100,000+ packages from Nixpkgs

## Installation

### macOS / Linux

```bash
curl -fsSL https://get.jetpack.io/devbox | bash
```

### Manual Installation

1. Visit [jetify.com/devbox](https://www.jetify.com/devbox)
2. Follow platform-specific instructions
3. Verify installation: `devbox version`

## Quick Start

### Option 1: Automatic (with direnv)

If you have direnv installed:

```bash
cd /path/to/RevealUI
direnv allow
```

Devbox will automatically activate when you `cd` into the project!

### Option 2: Manual

```bash
cd /path/to/RevealUI
devbox shell
```

## What's Included

Devbox provides these pinned tools:

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 24.12.0 | JavaScript runtime |
| **pnpm** | 10.28.2 | Package manager |
| **PostgreSQL** | 16 | Database |
| **Stripe CLI** | latest | Payment testing |

## Available Commands

### Built-in Scripts

```bash
# Start development servers
devbox run dev

# Complete setup (install + database)
devbox run setup

# Run tests
devbox run test

# Start local PostgreSQL
devbox run db:start

# Stop local PostgreSQL
devbox run db:stop

# Listen to Stripe webhooks
devbox run stripe:listen
```

### Direct Tool Access

Inside the Devbox shell, all tools are available:

```bash
# Enter shell
devbox shell

# Use tools directly
node --version     # 24.12.0
pnpm --version     # 10.28.2
postgres --version # 16
stripe --version   # latest

# Run any pnpm command
pnpm install
pnpm dev
pnpm test
pnpm lint
```

## Configuration

The `devbox.json` file defines your environment:

```json
{
  "packages": [
    "nodejs@24.12.0",
    "pnpm@10.28.2",
    "postgresql@16",
    "stripe-cli@latest"
  ],
  "shell": {
    "init_hook": [
      "corepack enable",
      "echo '🚀 RevealUI Devbox shell ready!'"
    ],
    "scripts": {
      "dev": "pnpm dev",
      "setup": "pnpm install && pnpm db:init"
    }
  }
}
```

## Integration with direnv

Devbox works seamlessly with direnv for automatic environment activation:

1. **Install direnv**:
   ```bash
   # macOS
   brew install direnv

   # Linux
   curl -sfL https://direnv.net/install.sh | bash
   ```

2. **Add to shell** (`~/.bashrc` or `~/.zshrc`):
   ```bash
   eval "$(direnv hook bash)"  # or zsh
   ```

3. **Allow the project**:
   ```bash
   cd /path/to/RevealUI
   direnv allow
   ```

4. **Automatic activation**:
   ```bash
   cd /path/to/RevealUI
   # Devbox environment activates automatically!
   node --version  # 24.12.0
   ```

## Common Workflows

### First-Time Setup

```bash
# 1. Enter Devbox shell
devbox shell

# 2. Run complete setup
devbox run setup
# Or manually:
pnpm install
pnpm db:init
pnpm db:migrate

# 3. Start development
devbox run dev
```

### Daily Development

With direnv integration:

```bash
# Just cd into the project
cd ~/projects/RevealUI

# Tools are automatically available
pnpm dev
```

Without direnv:

```bash
cd ~/projects/RevealUI
devbox shell
pnpm dev
```

### Database Management

```bash
# Start local PostgreSQL (if not using remote)
devbox run db:start

# Connect with psql
psql postgresql://postgres@localhost:5432/revealui

# Stop PostgreSQL
devbox run db:stop
```

### Stripe Testing

```bash
# Listen to webhooks (forwards to localhost:4000)
devbox run stripe:listen

# In another terminal (also in devbox shell):
devbox shell
pnpm dev
```

## Adding Packages

Need more tools? Update `devbox.json`:

```json
{
  "packages": [
    "nodejs@24.12.0",
    "pnpm@10.28.2",
    "postgresql@16",
    "stripe-cli@latest",
    "redis@7",           // Add Redis
    "kubectl@latest"      // Add kubectl
  ]
}
```

Search packages at [search.nixos.org](https://search.nixos.org/packages)

Then refresh your environment:

```bash
devbox shell  # Automatically installs new packages
```

## Troubleshooting

### Devbox command not found

- Restart your terminal after installation
- Check `~/.profile` or `~/.bashrc` has Devbox in PATH
- Manual path: `export PATH="$HOME/.local/bin:$PATH"`

### Wrong Node version

```bash
# Exit and re-enter shell
exit
devbox shell

# Verify version
node --version  # Should be 24.12.0
```

### PostgreSQL won't start

```bash
# Initialize database (first time only)
devbox run db:init

# Start PostgreSQL
devbox run db:start

# Check logs
cat .devbox/virtenv/postgresql/data/logfile
```

### Direnv not activating

```bash
# Re-allow the directory
direnv allow

# Check direnv is hooked
direnv status

# Reload shell config
source ~/.bashrc  # or ~/.zshrc
```

### Slow package installation

First installation downloads packages from Nix cache:
- Be patient (2-5 minutes first time)
- Subsequent activations are instant (cached)
- Use fast internet if possible

### Conflicts with system tools

Devbox isolates tools per-project:
- System Node.js won't conflict
- Devbox tools take precedence inside shell
- Exit shell to use system tools

## Comparison with Alternatives

| Feature | Devbox | nvm + manual | Docker | Dev Containers |
|---------|--------|--------------|--------|----------------|
| **Setup time** | 1 minute | 5-10 minutes | 5 minutes | 3-5 minutes |
| **Isolation** | ✅ Strong | ⚠️ Partial | ✅ Strong | ✅ Strong |
| **Speed** | ⚡ Instant | ⚡ Instant | 🐌 Slow | 🐌 Slow |
| **Learning curve** | ✅ Easy | ✅ Easy | ⚠️ Medium | ⚠️ Medium |
| **Cross-platform** | ✅ Mac/Linux | ✅ All | ✅ All | ✅ All |
| **Reproducibility** | ✅ Perfect | ❌ Fragile | ✅ Good | ✅ Good |

## Advanced Usage

### Multiple Shells

Run different projects with different tool versions:

```bash
# Project A (Node 20)
cd ~/project-a
devbox shell  # Node 20

# Project B (Node 24)
cd ~/project-b
devbox shell  # Node 24
```

### Custom Init Hooks

Add logic to `devbox.json`:

```json
{
  "shell": {
    "init_hook": [
      "export MY_VAR=value",
      "echo 'Custom message'",
      "source .env.local"
    ]
  }
}
```

### Global Devbox

Install tools globally:

```bash
devbox global add nodejs pnpm postgresql
```

### Services

Run background services:

```json
{
  "shell": {
    "init_hook": [
      "devbox services start postgresql"
    ]
  }
}
```

## Migration Guides

### From nvm

Before (nvm):
```bash
nvm install 24.12.0
nvm use
npm install -g pnpm
```

After (Devbox):
```bash
devbox shell  # Everything ready!
```

### From Docker

Before (Docker):
```bash
docker-compose up -d
docker-compose exec app bash
```

After (Devbox):
```bash
devbox shell  # Faster, no containers
```

## Learn More

- [Devbox Documentation](https://www.jetify.com/docs/devbox/)
- [Nix Package Search](https://search.nixos.org/packages)
- [Devbox Examples](https://github.com/jetify-com/devbox/tree/main/examples)

## Support

- Issues: [RevealUI GitHub Issues](https://github.com/your-org/RevealUI/issues)
- Devbox Issues: [jetify-com/devbox](https://github.com/jetify-com/devbox/issues)
- Community: [Devbox Discord](https://discord.gg/jetify)
