# Cursor Environment Fix for Node Version

## Problem
Cursor's agent sandbox is using Node v20.11.1 instead of the required v24.12.0, even though nvm shows v24.12.0 as active.

## Root Cause
pnpm was installed with Node v20.11.1 and stores its own Node version information, ignoring the PATH Node version.

## Solutions

### Option 1: Reinstall pnpm with correct Node version
```bash
# Remove old pnpm
rm -rf ~/.local/share/pnpm
rm -rf ~/.local/bin/pnpm

# Install pnpm with Node 24.12.0
npm install -g pnpm

# Verify
pnpm --version
node --version
```

### Option 2: Force Node path for pnpm
Create a wrapper script or set environment variables:

```bash
# In your shell profile or .envrc
export PATH="/home/joshua-v-dev/.nvm/versions/node/v24.12.0/bin:$PATH"
export PNPM_HOME="/home/joshua-v-dev/.local/share/pnpm"
```

### Option 3: Use nvm exec
```bash
nvm exec 24.12.0 pnpm typecheck:all
```

### Option 4: Update Cursor settings
In Cursor IDE:
1. Open Settings (Cmd/Ctrl + ,)
2. Search for "Node"
3. Set Node.js path to: `/home/joshua-v-dev/.nvm/versions/node/v24.12.0/bin/node`

## Current Status
- ✅ Node 24.12.0 installed and available
- ✅ .nvmrc created for version pinning
- ✅ .envrc updated for direnv integration
- ❌ pnpm still using cached Node v20.11.1

## Next Steps
1. Try Option 1 (reinstall pnpm)
2. Test with `pnpm typecheck:all`
3. If still failing, try Option 4 (Cursor settings)

## Verification
After fixing, run:
```bash
pnpm typecheck:all  # Should work without engine errors
pnpm test           # Should run without cyclic dependency errors
```