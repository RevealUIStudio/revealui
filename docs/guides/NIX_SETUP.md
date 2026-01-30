# Nix Development Environment Setup

This guide explains how to use RevealUI's Nix-based development environment on NixOS-WSL.

## ⚠️ Important: Node.js Version Notice

**Current Limitation:** The Nix environment provides **Node.js 22** instead of the target version 24.12.0.

**Why?** Node.js 24 is not yet available in nixpkgs stable or unstable channels as of January 2026.

**Impact:**
- ✅ Most features work normally on Node.js 22
- ⚠️ CI uses Node.js 24.12.0, so there may be minor differences
- 🔄 We're monitoring nixpkgs and will update to Node 24 as soon as it's available

**What this means for you:**
- Your code is tested against both Node 22 (local) and Node 24 (CI)
- Report any Node version-specific issues immediately
- The codebase maintains compatibility with both versions

**Status tracking:** Check `flake.nix` lines 14-16 for update status.

**Alternatives if you need Node 24:**
- Use [Dev Containers](./.devcontainer/README.md) (Docker-based, Node 24.12.0)
- Use manual setup with `nvm use 24.12.0`

## When to Use Nix

**Choose Nix if you:**
- ✅ Are on Linux or NixOS-WSL
- ✅ Want the fastest, most lightweight setup
- ✅ Value reproducibility and zero vendor lock-in
- ✅ Are comfortable with declarative configuration
- ✅ Can accept Node.js 22 for now (24 coming soon)

**Choose Dev Containers instead if you:**
- ⚠️ Need Node.js 24.12.0 exactly
- ⚠️ Are on Windows/Mac
- ⚠️ Use GitHub Codespaces
- ⚠️ Prefer Docker-based environments

**Comparison:** See [ENVIRONMENT_COMPARISON.md](./ENVIRONMENT_COMPARISON.md) for detailed feature comparison.

## Prerequisites

- ✅ NixOS-WSL installed and running
- ✅ direnv enabled in your shell
- ✅ Git initialized in the project

## Quick Start (First Time)

```bash
# 1. Navigate to project (must be on Linux filesystem!)
cd ~/projects/RevealUI

# 2. Initialize Nix flake
nix flake update

# 3. Allow direnv (enables automatic environment activation)
direnv allow

# 4. Wait for environment to build (first time only, ~2-5 min)
# You'll see a colorful welcome message when ready!

# 5. Initialize PostgreSQL
db-init

# 6. Start PostgreSQL
db-start

# 7. Install dependencies
pnpm install

# 8. Start development
pnpm dev
```

## Daily Workflow

```bash
# Just cd into the project - environment activates automatically!
cd ~/projects/RevealUI

# Start PostgreSQL if needed
db-start

# Run your commands
pnpm dev
```

## Database Setup

### Unified Database Interface

RevealUI provides **two ways** to manage your database:

#### Option 1: Nix Helper Commands (Convenience)

Shell functions provided by the Nix environment:

| Command | Description |
|---------|-------------|
| `db-init` | Initialize PostgreSQL (first time only) |
| `db-start` | Start PostgreSQL server |
| `db-stop` | Stop PostgreSQL server |
| `db-status` | Check if PostgreSQL is running |
| `db-reset` | Delete and reinitialize database |
| `db-psql` | Connect with psql client |

**Example:**
```bash
db-init      # First time setup
db-start     # Start server
db-status    # Check status
```

#### Option 2: pnpm Scripts (Universal)

These work in **any environment** (Nix, Docker, Manual):

| Command | Description |
|---------|-------------|
| `pnpm db:init` | Initialize database and run migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm db:reset` | Reset database to clean state |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |

**Example:**
```bash
pnpm db:init      # Initialize + migrate
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open GUI
```

### Which Should I Use?

- **Nix helpers** (`db-*`): Quick server control (start/stop/status)
- **pnpm scripts** (`pnpm db:*`): Application-level tasks (migrate/seed/studio)

**Best Practice:** Use pnpm scripts for consistency across all environments.

### Database Location

- **Data directory**: `.pgdata/` (in project root)
- **Automatically gitignored**
- **Port**: 5432 (default)
- **Connection string**: Automatically configured in `.env`

**⚠️ Important:** The database runs **locally** in the Nix environment, not in a container.

## Multiple Shell Environments

The flake provides specialized environments:

### Default (Full Development)
```bash
# Activated automatically via direnv
cd ~/projects/RevealUI
```

Includes: Node.js, pnpm, PostgreSQL, Stripe CLI, all dev tools

### CI Environment (Minimal)
```bash
nix develop .#ci
```

Includes: Only Node.js, pnpm, git (for CI pipelines)

### Database Only
```bash
nix develop .#db
```

Includes: Only PostgreSQL and database tools

## Customization

### Adding Packages

Edit `flake.nix`:

```nix
buildInputs = with pkgs; [
  # Existing packages...

  # Add new packages
  redis
  docker-compose
  kubectl
];
```

Then:
```bash
direnv reload
```

### Changing Node.js Version

When Node.js 24 becomes available in nixpkgs:

```nix
# In flake.nix, change:
nodejs = pkgs.nodejs_22;

# To:
nodejs = pkgs.nodejs_24;
```

### Custom Environment Variables

Add to `flake.nix` shellHook:

```nix
shellHook = ''
  # ... existing hook ...

  export MY_CUSTOM_VAR="value"
  export API_URL="http://localhost:3000"
'';
```

## Updating Dependencies

### Update Nix Packages
```bash
# Update flake.lock (updates all Nix packages)
nix flake update

# Reload environment
direnv reload
```

### Update Node Packages
```bash
# Standard pnpm update
pnpm update
```

## Troubleshooting

### Environment Not Activating

```bash
# Re-allow direnv
direnv allow

# Check direnv status
direnv status

# Manually reload
direnv reload
```

### PostgreSQL Won't Start

```bash
# Check if already running
db-status

# Reset database completely
db-reset

# Check logs
cat .pgdata/logfile
```

### Slow First Load

The first time you enter the environment, Nix downloads and builds packages. This can take 2-5 minutes.

**After first load, activation is instant** thanks to nix-direnv caching.

### Out of Disk Space

```bash
# Clean old Nix generations
nix-collect-garbage -d

# Clean pnpm cache
pnpm store prune
```


## Performance Tips

### 1. Store Projects on Linux Filesystem

**Fast:**
```bash
/home/joshua/projects/RevealUI/  # ✅
```

**Slow (10x slower):**
```bash
/mnt/c/Users/joshua/projects/RevealUI/  # ❌
```

### 2. Configure WSL Memory

Edit `%UserProfile%\.wslconfig` on Windows:

```ini
[wsl2]
memory=8GB
processors=4
```

Restart WSL: `wsl --shutdown`

### 3. Enable Nix Binary Cache

Already configured in `flake.nix` - ensures you download pre-built packages instead of compiling.

### 4. Optimize Nix Build Settings (WSL2)

If you experience freezing during heavy builds (rust-analyzer, large packages), create `~/.config/nix/nix.conf`:

```ini
# Limit concurrent builds to prevent WSL2 freezing
max-jobs = auto
cores = 4

# Enable flakes (if not already enabled)
experimental-features = nix-command flakes

# Use binary cache
substituters = https://cache.nixos.org https://nix-community.cachix.org
trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY= nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs=
```

Then restart direnv:
```bash
direnv reload
```

**Why this helps:**
- Prevents WSL2 from freezing on heavy builds
- Limits CPU/memory pressure
- Improves stability on resource-constrained systems

### 5. Regular Maintenance

```bash
# Clean old Nix generations (free disk space)
nix-collect-garbage -d

# Optimize Nix store (deduplicate files)
nix-store --optimize

# Update flake inputs (get latest packages)
nix flake update
```

## Advanced Usage

### Manual Reload Mode (Optional)

By default, direnv automatically reloads when `flake.nix` or `flake.lock` changes. You can opt into **manual reload mode** to prevent unexpected rebuilds:

**Benefits:**
- ✅ Prevents surprise environment rebuilds
- ✅ More control over when environment updates
- ✅ Useful during intensive Nix development

**How to enable:**

Add to your `.envrc` (at the top):
```bash
export NIX_DIRENV_MANUAL_RELOAD=1
use flake
```

**Usage with manual mode:**
```bash
# Changes to flake.nix won't auto-reload
# You must manually trigger reload:
direnv reload
```

**When to use:**
- You're frequently editing `flake.nix`
- You want explicit control over environment updates
- You're working on Nix configuration itself

**When NOT to use:**
- Default auto-reload works fine for most users
- You want automatic environment synchronization
- You're not frequently modifying Nix files

**Fallback protection:** nix-direnv automatically provides fallback protection. If a new environment version fails to build, it keeps using the previous working environment.

### Manual Flake Commands

```bash
# Enter development shell without direnv
nix develop

# Run a command in the dev environment
nix develop -c pnpm test

# Update specific input
nix flake lock --update-input nixpkgs

# Show flake info
nix flake show

# Check flake
nix flake check
```

### Pin to Specific nixpkgs Commit

```nix
# In flake.nix inputs:
nixpkgs.url = "github:NixOS/nixpkgs/abc123...";
```

Find commits at [nixhub.io](https://www.nixhub.io/)

### Share Configuration

The `flake.nix` and `flake.lock` files define the entire environment. Commit them:

```bash
git add flake.nix flake.lock .envrc
git commit -m "Add Nix flake development environment"
```

Now everyone on your team gets the **exact same environment**!

## Resources

- [Nix Flakes Documentation](https://nixos.wiki/wiki/Flakes)
- [nix-direnv](https://github.com/nix-community/nix-direnv)
- [Zero to Nix](https://zero-to-nix.com/)
- [NixOS Package Search](https://search.nixos.org/packages)

## Getting Help

- Check [ENVIRONMENT_COMPARISON.md](ENVIRONMENT_COMPARISON.md) for comparison with Dev Containers
- Review `flake.nix` comments for configuration details
- Ask in NixOS Discourse: https://discourse.nixos.org/
- RevealUI Issues: https://github.com/your-org/RevealUI/issues

---

**Last Updated:** 2026-01-30
**Maintained By:** RevealUI Team
