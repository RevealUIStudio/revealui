# Root Directory Structure Standards

**Last Updated**: 2026-02-02
**Status**: ✅ Active

## Philosophy

Keep the root directory clean and focused on essential project files. All technical documentation, infrastructure configs, and specialized tooling should be organized in appropriate subdirectories.

---

## Allowed Root Files

### Documentation (4 files only)
- `README.md` - Project overview and getting started
- `LICENSE` - License information
- `CHANGELOG.md` - Version history and release notes
- `CONTRIBUTING.md` - Contribution guidelines

### Package Management
- `package.json` - Root package configuration
- `pnpm-lock.yaml` - Dependency lock file
- `pnpm-workspace.yaml` - Workspace configuration

### Build Configuration
- `turbo.json` - Turborepo configuration
- `tsconfig.json` - Root TypeScript configuration

### Linting and Formatting
- `biome.json` - Biome linter/formatter config
- `eslint.config.js` - ESLint configuration

### Testing
- `vitest.config.ts` - Vitest configuration
- `playwright.config.ts` - Playwright E2E config

### Docker
- `docker-compose.yml` - Docker Compose configuration

### Nix
- `flake.nix` - Nix flake configuration
- `flake.lock` - Nix flake lock file

### Dotfiles
- `.gitignore` - Git ignore rules
- `.gitattributes` - Git attributes
- `.dockerignore` - Docker ignore rules
- `.npmrc` - NPM configuration
- `.nvmrc` - Node version
- `.envrc` - Direnv configuration
- `.env.template` - Environment variable template
- `.env.test` - Test environment variables
- `.lighthouserc.json` - Lighthouse CI config
- `.size-limit.json` - Size limit config

### Reports (Consider moving to reports/ folder in future)
- `CODE-QUALITY-REPORT.json` - Code quality metrics
- `TYPE-USAGE-REPORT.json` - TypeScript usage report

---

## Allowed Root Directories

### Core Monorepo Structure
- `apps/` - Application packages (CMS, Dashboard, etc.)
- `packages/` - Shared libraries and tools (including `packages/mcp/`)
- `docs/` - All documentation organized by category
- `scripts/` - Build and maintenance scripts
- `infrastructure/` - Docker, K8s, deployment configs
- `e2e/` - End-to-end tests
- `examples/` - Example implementations

### Project Tooling
- `.revealui/` - Project-specific tooling
  - `.revealui/templates/` - Package templates (formerly `package-templates/`)
  - `.revealui/skills/` - AI skills
  - `.revealui/state/` - State management

### Hidden Directories
- `.git/` - Git repository
- `.github/` - GitHub Actions and configs
- `.turbo/` - Turbo cache
- `.vscode/` - VS Code settings
- `.cursor/` - Cursor IDE settings
- `.claude/` - Claude Code settings
- `.devcontainer/` - Dev container config
- `.direnv/` - Direnv cache
- `.archive/` - Archived files

### Dependencies
- `node_modules/` - Installed dependencies

---

## Documentation Organization

All markdown files (except the 4 root docs) must be organized in `docs/` subdirectories:

### `docs/testing/`
- Testing guides and strategies
- Coverage reports
- E2E and component testing docs

### `docs/deployment/`
- Deployment guides and procedures
- Deployment test results
- CI/CD documentation

### `docs/development/`
- Development guides and workflows
- Scripts reference
- Build optimization docs

### `docs/architecture/`
- System architecture documentation
- Database design and optimization
- API verification and design docs

### `docs/guides/`
- User guides and tutorials
- Quick start guides
- Integration guides (Vercel Skills, etc.)

### `docs/archive/`
- Historical documentation
- Completed implementation summaries
- Deprecated guides

---

## Infrastructure Organization

All infrastructure configurations must be in `infrastructure/` subdirectories:

### `infrastructure/docker/`
- Dockerfiles
- Docker configuration files
- Docker-related scripts

### `infrastructure/k8s/`
- Kubernetes manifests
- Helm charts
- K8s configuration files

### `infrastructure/docker-compose/`
- Docker Compose configurations for different environments

---

## Enforcement

### Automated Validation

1. **Structure validation script**: `pnpm validate:structure`
   - Validates root directory cleanliness
   - Checks infrastructure organization
   - Verifies template location
   - Ensures MCP integration

2. **CI/CD enforcement**: `.github/workflows/structure-validation.yml`
   - Runs on every PR and push to main
   - Fails if unauthorized files/folders in root
   - Checks for proper infrastructure organization
   - Validates template and MCP locations

3. **Optional pre-commit hook**:
   ```bash
   # Can be set up with husky for local enforcement
   pnpm validate:structure
   ```

### Manual Checks

Run validation locally:
```bash
# Validate structure
pnpm validate:structure

# Count root markdown files (should be 3-4)
find . -maxdepth 1 -name "*.md" -type f | wc -l

# Check infrastructure structure
ls -la infrastructure/
```

---

## Migration Guide

### If you have files that don't fit the structure

**Technical documentation** → `docs/`
- Testing docs → `docs/testing/`
- Deployment docs → `docs/deployment/`
- Development docs → `docs/development/`
- Architecture docs → `docs/architecture/`
- Guides and tutorials → `docs/guides/`
- Historical docs → `docs/archive/`

**Infrastructure configurations** → `infrastructure/`
- Docker files → `infrastructure/docker/`
- Kubernetes configs → `infrastructure/k8s/`
- Compose files → `infrastructure/docker-compose/`

**Templates** → `.revealui/templates/`
- Package templates (library.json, app.json, tool.json)

**Scripts** → `scripts/`
- Build scripts → `scripts/build/`
- Analysis tools → `scripts/analysis/`
- Database scripts → `scripts/database/`

### Moving files

Always use `git mv` to preserve history:
```bash
# Move markdown file to docs
git mv MY_DOC.md docs/guides/MY_DOC.md

# Move infrastructure folder
git mv k8s/ infrastructure/k8s/

# Move templates
git mv package-templates/ .revealui/templates/
```

After moving, update all references in:
- Documentation (markdown links)
- package.json scripts
- CI/CD workflows
- Dockerfiles and docker-compose.yml
- Any scripts that reference moved files

---

## Benefits

### Clean Root Directory
- Easier to navigate
- Clear project structure
- Professional appearance
- Better for new contributors

### Better Organization
- Documentation by category
- Infrastructure in one place
- Templates as project tooling
- Separation of concerns

### Maintainability
- Automated enforcement prevents drift
- Clear rules for file placement
- Easier to find what you need
- Consistent structure across team

### Scalability
- Structure scales with project growth
- New categories can be added easily
- Clear patterns for organization
- Reduces cognitive load

---

## Related Documentation

- [Project Standards](../STANDARDS.md) - Complete code standards
- [Contributing Guide](../../CONTRIBUTING.md) - Contribution guidelines
- [Package Templates](.revealui/templates/README.md) - Template documentation
- [Scripts Reference](../development/SCRIPTS.md) - All available scripts

---

## Questions?

If you're unsure where a file should go:

1. **Is it documentation?** → `docs/` (use appropriate subdirectory)
2. **Is it infrastructure?** → `infrastructure/`
3. **Is it a script?** → `scripts/`
4. **Is it project tooling?** → `.revealui/`
5. **Is it a package?** → `packages/` or `apps/`

When in doubt, run `pnpm validate:structure` and it will help identify issues.

---

**Maintained by**: RevealUI Core Team
**Questions**: Open an issue or discussion on GitHub
