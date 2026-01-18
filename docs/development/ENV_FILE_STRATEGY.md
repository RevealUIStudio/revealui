# Environment File Management Strategy

## Overview

This document outlines the comprehensive strategy for managing environment variables in the RevealUI monorepo, incorporating best practices from NixOS, direnv, and modern Node.js/Next.js workflows.

## File Hierarchy & Precedence

Environment variables are loaded in the following order (later files override earlier ones):

```
1. System environment variables (highest priority)
2. .env.development.local (local dev overrides, ignored by git)
3. .env.local (local overrides, ignored by git)
4. .env.development (shared dev defaults, optional)
5. .env (shared defaults, optional - only if non-sensitive)
```

## File Purposes

### `.env.template` (Committed)
- **Purpose**: Template/documentation file showing all required and optional variables
- **Content**: Placeholder values, comments explaining each variable
- **Status**: ✅ Committed to git
- **Usage**: Copy to `.env.development.local` for local development

### `.env.example` (Alternative to .env.template)
- **Purpose**: Same as `.env.template` - industry standard naming
- **Status**: ✅ Committed to git
- **Note**: We use `.env.template` to match the config loader's expectations

### `.env.development.local` (Ignored)
- **Purpose**: Local developer-specific overrides and secrets
- **Content**: Real credentials, local database URLs, personal API keys
- **Status**: ❌ Ignored by git (in `.gitignore`)
- **Usage**: Primary file for local development

### `.env.local` (Ignored)
- **Purpose**: Alternative local overrides (fallback if `.env.development.local` doesn't exist)
- **Status**: ❌ Ignored by git
- **Usage**: Less common, but supported for compatibility

### `.env` (Conditional)
- **Purpose**: Shared non-sensitive defaults (if any)
- **Content**: Only non-sensitive configuration
- **Status**: ⚠️ Currently contains secrets - should be ignored
- **Future**: Could be committed if cleaned of secrets, but not recommended

### `.env.production` (Optional)
- **Purpose**: Production-specific defaults (non-sensitive only)
- **Status**: ✅ Can be committed if non-sensitive
- **Usage**: Rarely needed - production uses CI/CD injected variables

## Current Issues & Solutions

### Issue 1: Poorly Named Files
- **Problem**: `.env.backup` and `.env.clean` are unclear
- **Solution**: Remove these files or move to `.env.backups/` directory if needed for reference

### Issue 2: Secrets in `.env`
- **Problem**: `.env` contains real secrets but is tracked in git
- **Solution**: 
  - Move all secrets to `.env.development.local`
  - Keep `.env` only for non-sensitive defaults (or remove entirely)
  - Ensure `.env` is in `.gitignore`

### Issue 3: No Template File
- **Problem**: No `.env.template` file for onboarding
- **Solution**: Create comprehensive `.env.template` with all variables documented

## Direnv Integration (Optional)

### What is direnv?
`direnv` automatically loads and unloads environment variables when you `cd` into directories based on `.envrc` files.

### Benefits
- Automatic environment loading when entering project directory
- Per-directory environment isolation
- Can integrate with NixOS dev shells
- Prevents forgetting to load env vars

### Setup (Optional)

1. **Install direnv**:
   ```bash
   # On macOS
   brew install direnv
   
   # On Linux (NixOS)
   # Already available if programs.direnv.enable = true
   
   # Add to shell config (~/.bashrc or ~/.zshrc)
   eval "$(direnv hook bash)"  # or zsh
   ```

2. **Create `.envrc`** in project root:
   ```bash
   # Load .env.development.local if it exists
   dotenv_if_exists .env.development.local
   
   # Or use direnv's built-in dotenv
   dotenv .env.development.local
   
   # For NixOS users (optional)
   # use flake  # if using Nix flakes
   # use nix    # if using shell.nix
   ```

3. **Allow direnv**:
   ```bash
   direnv allow
   ```

### When to Use direnv
- ✅ If you frequently switch between projects
- ✅ If you want automatic env loading
- ✅ If using NixOS dev shells
- ❌ Not necessary if you're fine with manual loading via dotenv-cli

## NixOS Best Practices

### Key Principles
1. **Declarative Configuration**: Define environments in `shell.nix` or `flake.nix`
2. **Secrets at Runtime**: Never bake secrets into Nix store
3. **Use direnv**: Combine with `use nix` or `use flake` for automatic loading
4. **Template Files**: Use `.env.template` for documentation, load secrets via `.env.local`

### Recommended Pattern
```nix
# shell.nix or flake.nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [ pkgs.nodejs pkgs.pnpm ];
  shellHook = ''
    # Load .env.local if it exists (secrets not in store)
    if [ -f .env.development.local ]; then
      set -a
      source .env.development.local
      set +a
    fi
  '';
}
```

```bash
# .envrc
use nix  # or use flake
dotenv .env.development.local
```

## Config Loader Behavior

The `@revealui/config` package loader (`packages/config/src/loader.ts`) currently:

1. **Looks for `.env.template`** as a marker for project root
2. **Loads in order**:
   - Development: `.env.development.local` → `.env.local` → `.env`
   - Test: `.env.test.local` → `.env.test`
   - Production: Only `process.env` (no file loading)

3. **Merges with precedence**: `process.env` overrides file-loaded variables

## Recommended File Structure

```
revealui/
├── .env.template          # ✅ Committed - template with placeholders
├── .envrc                  # ✅ Committed (optional) - direnv config
├── .env.development.local  # ❌ Ignored - your local secrets
├── .env.local              # ❌ Ignored - fallback local overrides
├── .env                    # ❌ Ignored - contains secrets (should be cleaned)
└── .gitignore              # ✅ Committed - ignores .env*.local, .env
```

## Migration Plan

### Step 1: Create Template
- [x] Create `.env.template` with all variables documented
- [x] Include comments explaining each variable
- [x] Use placeholder values (e.g., `YOUR_SECRET_HERE`)

### Step 2: Clean Up Existing Files
- [x] Remove or archive `.env.backup` → moved to `.env.backups/`
- [x] Remove or archive `.env.clean` → moved to `.env.backups/`
- [ ] Move secrets from `.env` to `.env.development.local` (see ENV_MIGRATION_GUIDE.md)
- [x] Update `.gitignore` to ensure `.env` is ignored

### Step 3: Update Documentation
- [ ] Update README.md with new setup instructions
- [ ] Update CONTRIBUTING.md
- [ ] Update any setup scripts

### Step 4: Optional - Add direnv
- [x] Create `.envrc` file
- [x] Document direnv setup in docs
- [x] Make it optional (not required for development)
- [x] Fix `.envrc` to use `dotenv_if_exists` (not `dotenv`)

## Security Best Practices

1. **Never commit secrets**: All `.env*.local` files must be in `.gitignore`
2. **Use placeholders in templates**: `.env.template` should never have real values
3. **Rotate secrets**: If secrets are ever committed, rotate them immediately
4. **Use secret managers in production**: CI/CD should inject secrets, not files
5. **Review `.gitignore` regularly**: Ensure all sensitive patterns are covered

## Validation

The project includes validation in:
- `packages/config/src/validator.ts` - Runtime validation
- `apps/cms/src/lib/utils/env-validation.ts` - CMS-specific validation
- `scripts/setup/validate-env.ts` - Setup validation script

Run validation:
```bash
pnpm validate:env
```

## Summary

| File | Committed? | Contains Secrets? | Purpose |
|------|-----------|-------------------|---------|
| `.env.template` | ✅ Yes | ❌ No | Template/documentation |
| `.env.example` | ✅ Yes | ❌ No | Alternative template name |
| `.env.development.local` | ❌ No | ✅ Yes | Local dev secrets |
| `.env.local` | ❌ No | ✅ Yes | Local overrides (fallback) |
| `.env` | ❌ No | ⚠️ Currently yes | Should be cleaned or removed |
| `.envrc` | ✅ Yes (optional) | ❌ No | Direnv configuration |

## References

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [direnv Documentation](https://direnv.net/)
- [NixOS Environment Variables](https://nixos.wiki/wiki/Environment_variables)
- [12-Factor App Config](https://12factor.net/config)
