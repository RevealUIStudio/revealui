# Package Script Templates

Standardized `package.json` script templates for RevealUI monorepo packages.

## 📦 Available Templates

### 1. **library.json** - Standard TypeScript Libraries
Use for: Most packages under `packages/` that export TypeScript code

**Build Tool:** TypeScript compiler (`tsc`)
**Test Framework:** Vitest
**Examples:** `@revealui/ai`, `@revealui/auth`, `@revealui/core`, `@revealui/db`

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist"
  }
}
```

### 2. **app.json** - Web Applications
Use for: Applications under `apps/` (Next.js or Vite-based)

**Frameworks:** Next.js or Vite
**Test Framework:** Vitest
**Examples:** `admin`, `docs`, `landing`, `web`

**Next.js variant:**
```json
{
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf .next .turbo"
  }
}
```

**Vite variant:**
```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "vite preview",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist .turbo"
  }
}
```

### 3. **tool.json** - CLI Tools
Use for: Command-line tools and utilities

**Build Tool:** tsup (optimized for CLI bundling)
**Test Framework:** Vitest
**Examples:** `@revealui/cli`, `@revealui/setup`

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  }
}
```

## 🎯 Standard Scripts by Category

### Core Scripts (Required)
- **`build`** - Compile/bundle for production
- **`dev`** - Watch mode for development
- **`clean`** - Remove build artifacts

### Quality Scripts (Required)
- **`lint`** - Run Biome linter
- **`lint:eslint`** - Run ESLint
- **`typecheck`** - TypeScript type checking without emit

### Testing Scripts (Required)
- **`test`** - Run tests once
- **`test:watch`** - Run tests in watch mode
- **`test:coverage`** - Run tests with coverage report

### Optional Scripts
- **`format`** - Auto-format code (use in actively developed packages)
- **`test:ui`** - Launch Vitest UI (use in packages with many tests)
- **`start`** - Start production server (apps only)

## 📝 Usage Guidelines

### Choosing a Template

1. **Is it a CLI tool?** → Use `tool.json`
2. **Is it a web application?** → Use `app.json` (choose Next.js or Vite variant)
3. **Is it a library package?** → Use `library.json`

### Customization Rules

**DO:**
- Adjust port numbers for apps (see port assignment in app.json notes)
- Add package-specific scripts (e.g., `db:migrate`, `generate:types`)
- Use framework-specific commands when needed

**DON'T:**
- Change standard script names (`build`, `dev`, `test`, etc.)
- Use different test frameworks (stick to Vitest)
- Use inconsistent linting commands

### Package-Specific Variations

#### UI Component Libraries
```json
{
  "build": "vite build",
  "dev": "vite build --watch --mode development"
}
```
Example: `@revealui/presentation`

#### Vercel-Deployed Apps
```json
{
  "build": "pnpm vercel-build",
  "vercel-build": "next build"
}
```
Example: `admin`, `web`

#### Packages with Database Migrations
```json
{
  "db:migrate": "tsx scripts/migrate.ts",
  "db:seed": "tsx scripts/seed.ts"
}
```
Example: `@revealui/db`

## 🔍 Validation

Use the maintain CLI to validate your package scripts:

```bash
# Audit all package scripts
pnpm maintain:audit-scripts

# Validate against templates
pnpm maintain:validate-scripts

# Auto-fix issues (with dry-run)
pnpm maintain:fix-scripts --dry-run
```

## 📊 Current Standardization

**Target:** <15% duplication
**Baseline:** 42.3% duplication

### Scripts Already Standardized ✅
- `typecheck` - 100% consistent across 12 packages
- `test:watch` - 100% consistent across 11 packages
- `format` - 100% consistent across 5 packages

### Scripts Needing Standardization ⚠️
- `build` - 7 different implementations
- `dev` - 9 different implementations
- `lint:eslint` - 2 different implementations

## 🚀 Migration Guide

### Step 1: Identify Package Type
Determine if your package is a library, app, or tool.

### Step 2: Compare with Template
```bash
# View your current scripts
cat packages/yourpackage/package.json | jq '.scripts'

# View the recommended template
cat .revealui/templates/library.json | jq '.scripts'
```

### Step 3: Update Scripts
Copy relevant scripts from the template, preserving any package-specific customizations.

### Step 4: Validate
```bash
pnpm maintain:validate-scripts
```

### Step 5: Test
```bash
# Test that all standard scripts work
pnpm --filter yourpackage build
pnpm --filter yourpackage test
pnpm --filter yourpackage lint
```

## 📚 Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [scripts/README.md](../scripts/README.md) - CLI script documentation
- [turbo.json](../turbo.json) - Turbo configuration and caching

---

**Last Updated:** Phase 5 - Package.json Cleanup
**Maintained By:** RevealUI Team
