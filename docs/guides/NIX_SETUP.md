# Nix Development Environment Setup

This guide explains how to use RevealUI's Nix-based development environment on NixOS-WSL.

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

## Database Commands

| Command | Description |
|---------|-------------|
| `db-init` | Initialize PostgreSQL (first time only) |
| `db-start` | Start PostgreSQL server |
| `db-stop` | Stop PostgreSQL server |
| `db-status` | Check if PostgreSQL is running |
| `db-reset` | Delete and reinitialize database |
| `db-psql` | Connect with psql client |

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

### Conflicts with Devbox

If you previously used Devbox:

```bash
# Remove Devbox files (no longer needed)
rm devbox.json devbox.lock
rm -rf .devbox/

# Use pure Nix instead
direnv allow
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

## Advanced Usage

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

## Comparison with Devbox

| Feature | Pure Nix Flakes (Current) | Devbox (Previous) |
|---------|---------------------------|-------------------|
| **Cost** | Free ✅ | Free ✅ |
| **Configuration** | `flake.nix` (Nix language) | `devbox.json` (JSON) |
| **Learning Curve** | Medium | Easy |
| **Flexibility** | High | Medium |
| **Integration** | Native NixOS | Abstraction layer |
| **Speed** | Fastest | Fast |
| **Vendor Lock-in** | None | Jetify/Devbox |

## Resources

- [Nix Flakes Documentation](https://nixos.wiki/wiki/Flakes)
- [nix-direnv](https://github.com/nix-community/nix-direnv)
- [Zero to Nix](https://zero-to-nix.com/)
- [NixOS Package Search](https://search.nixos.org/packages)

## Getting Help

- Check `docs/guides/DEVBOX_SETUP.md` for Devbox comparison
- Review `flake.nix` comments for configuration details
- Ask in NixOS Discourse: https://discourse.nixos.org/
- RevealUI Issues: https://github.com/your-org/RevealUI/issues

---

**Last Updated:** 2026-01-30
**Maintained By:** RevealUI Team
