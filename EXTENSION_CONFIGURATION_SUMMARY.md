# RevealUI Extension Configuration Summary

## Overview
This document summarizes all IDE extension configurations for the RevealUI project, including VS Code/Cursor settings, Biome, ESLint, and TypeScript configurations.

## VS Code Settings (`.vscode/settings.json`)

### Formatter Configuration
- **Default Formatter**: `biomejs.biome` (Biome extension)
- **Format on Save**: Enabled
- **Language-Specific Formatters**:
  - JSON/JSONC: Biome
  - JavaScript/JSX: Biome
  - TypeScript/TSX: Biome
  - YAML: Red Hat YAML extension

### Code Actions on Save
- `source.organizeImports.biome`: Explicit (organize imports)
- `source.fixAll.biome`: Explicit (fix all Biome issues)

### Biome LSP Configuration
- **Binary Path**: `./node_modules/@biomejs/biome/bin/biome`
- Uses local Biome installation from node_modules

## Cursor IDE Configuration (`.cursor/`)

### Main Config (`.cursor/config.json`)
```json
{
  "rules": [
    "Always use TypeScript strict mode",
    "Prefer explicit types over 'any'",
    "Use async/await over promises",
    "Add JSDoc comments for public APIs",
    "Use functional components with hooks",
    "Prefer named exports",
    "All CMS routes must be dynamic",
    "Use @/lib/* for CMS imports, @revealui/* for framework imports",
    "Environment variables are tracked in git",
    "Use workspace:* protocol for internal packages",
    "Use Drizzle ORM for database operations",
    "No external CMS packages - use native @revealui/cms",
    "ALWAYS use 'pnpm dlx' instead of 'npx' in package.json scripts"
  ],
  "context": {
    "framework": "RevealUI",
    "reactVersion": "19",
    "nextjsVersion": "16",
    "typescript": "strict",
    "packageManager": "pnpm"
  }
}
```

### Rules (`.cursor/rules.md`)
- Comprehensive project rules and conventions
- Next.js 16 specific patterns
- TypeScript strict mode requirements
- Import path conventions
- Testing guidelines

### Agent Rules (`.cursor/AGENT-RULES.md`)
**TOP PRIORITY**: Legacy code removal policy
- Mandatory removal of deprecated code
- No backward compatibility layers
- Immediate refactoring required
- All implementations must be current

### Specialized Agents (`.cursor/agents/`)
1. **TypeScript Agent** (`typescript.md`)
   - Type safety enforcement
   - Strict mode compliance
   - Type definition patterns
   - Drizzle ORM types

2. **Next.js Agent** (`nextjs.md`)
   - Next.js 16 patterns
   - Dynamic routes configuration
   - Promise-based params/searchParams
   - Route handler patterns

3. **Testing Agent** (`testing.md`)
   - Vitest unit tests
   - Playwright E2E tests
   - Test structure and mocking

### MCP Configuration
- **`.cursor/mcp-config.json`**: MCP server definitions (Vercel, Stripe, Neon, Supabase, Playwright, Next DevTools)
- **`.vscode/mcp.json`**: Vite SSE server configuration
- **`.cursor/mcp.json`**: Vite MCP server URL

## Biome Configuration (`biome.json`)

### Files
- **Includes**: `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`, `**/*.json`
- **Excludes**: `dist/`, `node_modules/`, `.next/`, `build/`, `.cursor/`, `scripts/`

### Formatter
- **Indent Style**: Space
- **Indent Width**: 2
- **Line Width**: 100
- **Quote Style**: Single quotes
- **JSX Quote Style**: Double quotes
- **Quote Properties**: As needed
- **Trailing Commas**: All
- **Semicolons**: As needed
- **Arrow Parentheses**: Always

### Linter
- **Enabled**: Yes
- **Recommended Rules**: Enabled
- **Custom Rules**:
  - `style.useForOf`: Error
  - `suspicious.noExplicitAny`: Warn

### Assist
- **Organize Imports**: On

## ESLint Configuration

### Project Status
- **ESLint Config Files**: Present in multiple locations
  - Root: `eslint.config.js`
  - Apps: `apps/cms/eslint.config.js`, `apps/web/eslint.config.js`
  - Packages: Various package-level configs
- **Usage**: ESLint is configured but **Biome is the primary linter**
- **CMS App**: Uses ESLint for linting (`pnpm lint` runs ESLint)

### Recommendation
- **Keep Biome as primary** (formatter + linter)
- **ESLint extension can be disabled** in IDE if causing conflicts
- ESLint CLI still works for CI/CD if needed

## TypeScript Configuration

### Strict Mode
- **Enabled**: Yes (project-wide)
- **No `any` types**: Preferred
- **Explicit types**: Required
- **Type safety**: Enforced

### Module Resolution
- **CMS App**: `bundler` (Next.js 16)
- **Packages**: `bundler` or `node16`
- **Path Mappings**: Extensive workspace path aliases

## Extension Recommendations

### ✅ Keep Enabled
1. **Biome Extension** (`biomejs.biome`)
   - Primary formatter and linter
   - Configured in VS Code settings
   - Works correctly (reports no errors)

2. **TypeScript Extension** (built-in)
   - Required for type checking
   - Provides IntelliSense
   - Note: May show false positives (language server limitation)

### ⚠️ Consider Disabling
1. **ESLint Extension**
   - Biome is the primary linter
   - May show duplicate/conflicting warnings
   - ESLint CLI still works if needed

### 🔧 Current Issue
- **TypeScript Language Server**: Showing false positive errors
  - `getClient()` return type not resolved
  - Drizzle ORM types not fully inferred
  - **Solution**: Restart TS server, errors are false positives
  - Code is type-safe (Biome and TSC confirm)

## File Exclusions (`.cursorignore`)

### Excluded from AI Context
- `node_modules/`
- `dist/`, `build/`, `.next/`, `out/`
- Cache directories (`.cache/`, `.vite/`, etc.)
- Log files (`*.log`)

### Included in AI Context
- `.env*` files (for environment understanding)
- Source code
- Configuration files
- Documentation

## Workflows & Snippets

### Workflows (`.cursor/workflows/`)
- `new-component.md`: Component creation workflow
- `ralph-iterative-workflow.md`: Iterative development workflow

### Snippets (`.cursor/snippets/`)
- `nextjs-page.tsx`: Next.js page template
- `nextjs-route-handler.ts`: Route handler template
- `react-component.tsx`: React component template

## Summary

### Current Setup
- ✅ **Biome**: Primary formatter and linter (working correctly)
- ✅ **TypeScript**: Strict mode enabled (type-safe code)
- ⚠️ **ESLint**: Configured but secondary to Biome
- ⚠️ **TypeScript Language Server**: Showing false positives

### Recommendations
1. **Keep Biome extension** - It's working correctly
2. **Disable ESLint extension** - Avoid conflicts, Biome is primary
3. **Restart TypeScript server** - May resolve false positives
4. **Accept TS server limitations** - Code is type-safe, errors are false positives

### Key Files
- `.vscode/settings.json`: VS Code/Biome configuration
- `.cursor/config.json`: Cursor IDE rules
- `.cursor/rules.md`: Project conventions
- `biome.json`: Biome linter/formatter config
- `eslint.config.js`: ESLint config (secondary)

## Action Items

1. ✅ Biome is correctly configured and working
2. ⚠️ Consider disabling ESLint extension to avoid conflicts
3. 🔄 Restart TypeScript language server to clear false positives
4. 📝 Document that TS server errors are false positives (code is type-safe)