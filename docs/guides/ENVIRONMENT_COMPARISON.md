# Development Environment Comparison

This guide helps you choose the right development environment for RevealUI and provides migration paths between options.

## Quick Decision Matrix

| Your Situation | Recommended Environment |
|----------------|------------------------|
| **On Linux or NixOS-WSL** | [Pure Nix](#pure-nix-recommended-for-linuxnixos-wsl) |
| **On Windows/Mac** | [Dev Containers](#dev-containers-recommended-for-windowsmac) |
| **Using GitHub Codespaces** | [Dev Containers](#dev-containers-recommended-for-windowsmac) |
| **Need Node.js 24 exactly** | [Dev Containers](#dev-containers-recommended-for-windowsmac) or [Manual Setup](#manual-setup-traditional-approach) |
| **Team with mixed OSes** | [Dev Containers](#dev-containers-recommended-for-windowsmac) |
| **Want traditional setup** | [Manual Setup](#manual-setup-traditional-approach) |
| **Learning Nix** | [Pure Nix](#pure-nix-recommended-for-linuxnixos-wsl) (start here!) |

## Feature Comparison

| Feature | Pure Nix | Dev Containers | Manual Setup |
|---------|----------|----------------|--------------|
| **Setup Time** | 2-5 minutes (first time) | 3-5 minutes | 10-15 minutes |
| **Activation Time** | ⚡ Instant (direnv) | 🐌 30-60s (Docker) | ⚡ Instant |
| **Node.js Version** | ⚠️ 22 (24 not in nixpkgs yet) | ✅ 24.12.0 | ✅ 24.12.0 |
| **PostgreSQL** | ✅ 16 (local) | ✅ 16 (container) | ⚠️ Manual install |
| **Isolation** | ✅ Strong (per-project) | ✅ Strong (containers) | ❌ Global (conflicts possible) |
| **Reproducibility** | ✅ Perfect (declarative) | ✅ Good (Dockerfile) | ❌ Fragile (manual steps) |
| **Performance** | ⚡ Native (fastest) | 🐌 Docker overhead | ⚡ Native |
| **Resource Usage** | ✅ Lightweight | ⚠️ Heavy (Docker) | ✅ Lightweight |
| **Learning Curve** | ⚠️ Medium (Nix syntax) | ✅ Low (familiar Docker) | ✅ Easy (standard tools) |
| **Vendor Lock-in** | ✅ None (open source) | ⚠️ Docker dependency | ✅ None |
| **Platform Support** | Linux/macOS | All (via Docker) | All |
| **VS Code Integration** | ✅ Terminal | ✅ Native (Dev Containers) | ✅ Terminal |
| **Codespaces Support** | ❌ No | ✅ Native | ❌ No |
| **CI Parity** | ⚠️ Node 22 vs CI Node 24 | ✅ Exact match | ✅ Configurable |
| **Database Location** | `.pgdata/` | Container volume | System-dependent |
| **Custom db helpers** | ✅ `db-init`, `db-start`, etc. | ⚠️ docker exec | ⚠️ Manual |
| **Maintenance** | ✅ Low (flake updates) | ✅ Low (image updates) | ⚠️ High (manual updates) |

## Environment Details

### Pure Nix (Recommended for Linux/NixOS-WSL)

**What it is:** Declarative development environment using Nix flakes and direnv.

**Strengths:**
- ⚡ Fastest option (native performance, instant activation)
- ✅ Zero vendor lock-in (fully open source)
- ✅ Perfect reproducibility (bit-for-bit identical environments)
- ✅ Powerful customization (full control via Nix expressions)
- ✅ Lightweight (no containers or VMs)
- ✅ Custom database helpers (`db-init`, `db-start`, etc.)
- ✅ Three shell variants (default, ci, db)

**Weaknesses:**
- ⚠️ Node.js 22 instead of 24 (temporary limitation)
- ⚠️ Learning curve (Nix syntax)
- ❌ Linux/macOS only (no native Windows support)
- ⚠️ May not match CI environment exactly

**Best for:**
- Linux users (especially NixOS-WSL)
- Teams prioritizing performance and control
- Projects requiring reproducibility
- Developers learning modern infrastructure

**Setup time:** 2-5 minutes (first time), instant thereafter

**Documentation:** [docs/guides/NIX_SETUP.md](NIX_SETUP.md)

---

### Dev Containers (Recommended for Windows/Mac)

**What it is:** Docker-based development environment with VS Code integration.

**Strengths:**
- ✅ Works everywhere (Windows, Mac, Linux)
- ✅ Node.js 24.12.0 (exact CI match)
- ✅ Native VS Code integration
- ✅ GitHub Codespaces support
- ✅ Familiar Docker ecosystem
- ✅ Service orchestration (PostgreSQL, ElectricSQL)
- ✅ Pre-configured VS Code extensions

**Weaknesses:**
- 🐌 Slower than native (Docker overhead)
- ⚠️ Heavier resource usage (RAM, disk)
- ⚠️ Requires Docker Desktop (Windows/Mac)
- ⚠️ Network complexity (container networking)
- ⚠️ No custom db helpers (use docker exec or pnpm scripts)

**Best for:**
- Windows/Mac developers
- Teams using GitHub Codespaces
- VS Code users
- Teams with mixed operating systems
- Projects requiring exact CI parity

**Setup time:** 3-5 minutes (first time), 30-60s activation

**Documentation:** [.devcontainer/README.md](../../.devcontainer/README.md)

---

### Manual Setup (Traditional Approach)

**What it is:** Install Node.js, PostgreSQL, and tools manually using traditional methods.

**Strengths:**
- ✅ Full control over versions and configuration
- ✅ Familiar workflow (nvm, manual installs)
- ✅ No additional tools needed (Nix/Docker)
- ✅ Easy to troubleshoot (standard tools)
- ✅ Can match CI exactly (Node 24.12.0)

**Weaknesses:**
- ❌ Not reproducible (manual steps)
- ❌ Potential version conflicts (global installs)
- ⚠️ Platform-specific setup (different per OS)
- ⚠️ Requires manual PostgreSQL management
- ⚠️ Time-consuming setup (10-15 minutes)
- ⚠️ High maintenance burden (manual updates)

**Best for:**
- Developers who prefer traditional workflows
- Troubleshooting or debugging
- Projects with unique requirements
- Learning the stack without abstractions

**Setup time:** 10-15 minutes

**Documentation:** See README.md Quick Start section

---

## Migration Guides

### From Manual Setup → Pure Nix

**Why migrate:** Faster, reproducible, no global pollution

**Steps:**

1. **Clean up global tools (optional):**
   ```bash
   # Remove global pnpm if installed
   npm uninstall -g pnpm

   # nvm stays (useful for other projects)
   ```

2. **Install Nix:**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```

3. **Enable direnv:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   eval "$(direnv hook bash)"  # or zsh

   # Reload shell
   source ~/.bashrc
   ```

4. **Activate Nix environment:**
   ```bash
   cd ~/projects/RevealUI
   direnv allow
   # Wait for build (first time only)
   ```

5. **Migrate database (if needed):**
   ```bash
   # Export existing data
   pg_dump -d revealui > backup.sql

   # Initialize Nix database
   db-init
   db-start

   # Import data
   psql -d revealui < backup.sql
   ```

6. **Verify setup:**
   ```bash
   node --version    # Should be 22.x
   pnpm --version    # Should be 10.28.2
   db-status         # Should show running
   pnpm dev          # Should start normally
   ```

**Time required:** 5-10 minutes

---

### From Pure Nix → Dev Containers

**Why migrate:** Need Node 24, using Windows/Mac, need Codespaces

**Steps:**

1. **Install Docker:**
   - Windows/Mac: Install Docker Desktop
   - Linux: Install Docker Engine

2. **Install Dev Containers extension:**
   - Open VS Code
   - Install "Dev Containers" extension
   - Restart VS Code

3. **Open in container:**
   - Open project in VS Code
   - Press `F1` → "Dev Containers: Reopen in Container"
   - Wait for container build (3-5 minutes first time)

4. **Migrate database:**
   ```bash
   # Export from Nix
   db-start
   pg_dump -d revealui > backup.sql
   db-stop

   # Import to Dev Container
   # (inside container)
   pnpm db:init
   psql postgresql://postgres@db:5432/revealui < backup.sql
   ```

5. **Verify setup:**
   ```bash
   node --version    # Should be 24.12.0
   pnpm dev          # Should start normally
   ```

**Time required:** 10-15 minutes

---

### From Dev Containers → Pure Nix

**Why migrate:** Faster performance, lightweight, more control

**Prerequisites:**
- ✅ Must be on Linux or NixOS-WSL
- ❌ Won't work on Windows/Mac native

**Steps:**

1. **Export database from container:**
   ```bash
   # Inside Dev Container
   pg_dump -d revealui > backup.sql
   # Copy backup.sql to host filesystem
   ```

2. **Exit container:**
   - Close VS Code or reopen folder locally

3. **Install Nix (if not installed):**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
   ```

4. **Enable direnv:**
   ```bash
   eval "$(direnv hook bash)"
   direnv allow
   ```

5. **Import database:**
   ```bash
   db-init
   db-start
   psql -d revealui < backup.sql
   ```

6. **Update .env:**
   ```bash
   # Change from container networking
   # Old: postgresql://postgres@db:5432/revealui
   # New: postgresql://postgres@localhost:5432/revealui
   ```

**Time required:** 10 minutes

---

## Troubleshooting Common Issues

### Conflicting Database Data

**Problem:** Multiple environments create different PGDATA directories

**Solution:**
- **Nix**: `.pgdata/`
- **Dev Containers**: Docker volume

Choose ONE environment and stick with it. To switch:

```bash
# Export data from old environment
pg_dump -d revealui > backup.sql

# Remove old data directory
rm -rf .pgdata/

# Initialize new environment
# (follow migration guide above)

# Import data
psql -d revealui < backup.sql
```

### Node Version Mismatch

**Problem:** Nix uses Node 22, CI uses Node 24

**Solutions:**

1. **Accept the difference** (recommended):
   - Test your code works on both versions
   - CI will catch Node 24-specific issues
   - Update to Node 24 when available in nixpkgs

2. **Switch to Dev Containers**:
   - Provides exact Node 24.12.0
   - Follow migration guide above

3. **Use manual setup for critical testing**:
   - `nvm use 24.12.0`
   - Test locally before pushing to CI

### Environment Not Activating

**Nix/direnv:**
```bash
# Re-allow directory
direnv allow

# Check status
direnv status

# Reload shell config
source ~/.bashrc

# Check for errors
nix flake check
```

**Dev Containers:**
```bash
# Rebuild container
F1 → "Dev Containers: Rebuild Container"

# Check Docker
docker ps
docker logs <container-id>

# Check .devcontainer/devcontainer.json syntax
```

### Database Won't Start

**Nix:**
```bash
# Check PGDATA directory exists
ls -la .pgdata/

# Initialize if needed
db-reset

# Check for port conflicts
lsof -i :5432

# View logs
cat .pgdata/logfile
```

**Dev Containers:**
```bash
# Check database container
docker ps
docker logs revealui-db

# Restart database service
docker-compose restart db

# Check connection string in .env
```

### Slow Performance

**Nix:**
- ✅ Should be fastest option
- Check for WSL2 filesystem issues (use Linux FS, not /mnt/c)
- Optimize nix.conf (see NIX_SETUP.md)

**Dev Containers:**
- 🐌 Expected to be slower (Docker overhead)
- Use volume mounts, not bind mounts
- Allocate more resources to Docker
- Consider switching to Nix on Linux

---

## CI Environment Comparison

Our CI uses **vanilla GitHub Actions** (not Nix or Docker):

| Aspect | Nix | Dev Containers | Manual | CI |
|--------|-----|----------------|--------|-----|
| **Node.js** | 22 | 24.12.0 | 24.12.0 | 24.12.0 |
| **pnpm** | 10.28.2 | 10.28.2 | 10.28.2 | 10.28.2 |
| **PostgreSQL** | 16 (local) | 16 (container) | 16 (system) | 16 (Docker) |
| **Setup method** | direnv | docker-compose | manual | actions/setup-node |

**Why the difference?**
- CI prioritizes simplicity and speed
- GitHub Actions provides optimized Node.js setup
- Local environments prioritize convenience and control
- Exact parity not required if code is version-agnostic

**Best practice:** Write code that works on both Node 22 and 24.

See [docs/development/CI_ENVIRONMENT.md](../development/CI_ENVIRONMENT.md) for details.

---

## FAQ

### Should my whole team use the same environment?

**No!** Different team members can use different environments based on their OS and preferences:

- Linux developers → Nix
- Windows/Mac → Dev Containers
- Traditionalists → Manual setup

All environments work with the same codebase. Use `pnpm db:*` commands for cross-environment consistency.

### Can I switch between environments?

**Yes!** Follow the migration guides above. Key step: Export and import your database.

### What if I'm new to Nix?

Start with the [NIX_SETUP.md](NIX_SETUP.md) guide. Nix has a learning curve, but:
- You don't need to learn Nix syntax to use it
- The `flake.nix` is already configured
- You mostly just use `direnv allow` and pnpm commands

If Nix feels overwhelming, use Dev Containers instead.

### Why doesn't CI use Nix?

**Performance:** GitHub Actions with native Node.js is faster than Nix setup.
**Simplicity:** Standard actions are easier to maintain and understand.
**Caching:** GitHub's built-in caching works better with standard tools.

We document the differences and test compatibility.

### How do I report environment issues?

1. Specify which environment you're using (Nix/Docker/Manual)
2. Include version info:
   ```bash
   node --version
   pnpm --version
   postgres --version
   ```
3. Include relevant logs
4. Open issue on GitHub

---

## Summary

**TL;DR:**

- ✅ **Linux/NixOS-WSL** → Use Pure Nix (fastest, best control)
- ✅ **Windows/Mac/Codespaces** → Use Dev Containers (best compatibility)
- ⚠️ **Need Node 24 exactly** → Use Dev Containers or Manual

All environments support the same workflows via `pnpm` scripts.

**Questions?** Check environment-specific docs or open a GitHub issue.
