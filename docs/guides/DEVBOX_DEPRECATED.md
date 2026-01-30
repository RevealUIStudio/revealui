# Devbox Setup (Deprecated)

**⚠️ DEPRECATED:** As of January 30, 2026, Devbox is no longer the recommended development environment for RevealUI.

## Why Deprecated?

Devbox has been replaced by **Pure Nix Flakes** as the primary development environment for the following reasons:

1. **Environment Conflicts**: Devbox and Nix created conflicting PostgreSQL data directories
2. **Version Inconsistency**: Different Node.js versions between environments
3. **Vendor Lock-in**: Devbox adds an abstraction layer over Nix
4. **Redundancy**: Pure Nix provides all the same benefits without the extra layer
5. **Maintenance**: Consolidating to one primary environment reduces maintenance burden

## Migration Path

### If you're currently using Devbox:

**1. Remove Devbox artifacts:**
```bash
# These directories are already in .gitignore
rm -rf .devbox/
rm devbox.lock
```

**2. Switch to Pure Nix:**

Follow the comprehensive setup guide: [docs/guides/NIX_SETUP.md](NIX_SETUP.md)

Quick start:
```bash
# Install Nix (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install

# Enable direnv
direnv allow

# Install dependencies
pnpm install

# Initialize database
pnpm db:init

# Start development
pnpm dev
```

**3. Database migration (if needed):**

If you have existing data in `.devbox/virtenv/postgresql/data`:

```bash
# Export your data
pg_dump -d revealui > backup.sql

# Switch to Nix environment
direnv allow

# Import your data
pnpm db:init
psql -d revealui < backup.sql
```

### If you prefer not to use Nix:

Use **Dev Containers** instead (Docker-based, works on all platforms):

See: [.devcontainer/README.md](../../.devcontainer/README.md)

## Comparison of Options

| Feature | Pure Nix | Dev Containers | Devbox (Deprecated) |
|---------|----------|----------------|---------------------|
| **Learning Curve** | Medium | Low | Low |
| **Performance** | ⚡ Fastest | 🐌 Slower (Docker) | ⚡ Fast |
| **Vendor Lock-in** | ✅ None | ⚠️ Docker | ❌ Jetify |
| **Control** | ✅ Full | ⚠️ Container limits | ⚠️ Abstracted |
| **Platform Support** | Linux/macOS | All (via Docker) | Linux/macOS |
| **Recommended For** | Linux/NixOS-WSL | Windows/Mac/Codespaces | ❌ Not recommended |

## Archived Documentation

The full Devbox setup guide has been archived at:
[docs/archive/DEVBOX_SETUP.md](../archive/DEVBOX_SETUP.md)

## Need Help?

- **Environment Comparison**: [docs/guides/ENVIRONMENT_COMPARISON.md](ENVIRONMENT_COMPARISON.md)
- **Nix Setup Guide**: [docs/guides/NIX_SETUP.md](NIX_SETUP.md)
- **Dev Container Setup**: [.devcontainer/README.md](../../.devcontainer/README.md)
- **Troubleshooting**: See the respective guide for your chosen environment

## Timeline

- **Deprecated**: January 30, 2026
- **Archived**: January 30, 2026
- **Removal**: TBD (will remain for backward compatibility for at least 3 months)
