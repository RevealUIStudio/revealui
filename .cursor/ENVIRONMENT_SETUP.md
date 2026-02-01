# RevealUI Environment Setup Guide

This guide covers environment configuration for the RevealUI project, including Node.js version management, Cursor IDE setup, and MCP (Model Context Protocol) configuration.

**Last Updated:** 2026-01-31

---

## Table of Contents

1. [Node.js Version Requirements](#nodejs-version-requirements)
2. [Cursor IDE Configuration](#cursor-ide-configuration)
3. [Node Version Troubleshooting](#node-version-troubleshooting)
4. [MCP Configuration](#mcp-configuration)
5. [Verification](#verification)

---

## Node.js Version Requirements

RevealUI requires **Node.js >=24.12.0**.

### Current Status

- ✅ Node 24.12.0 is installed via nvm
- ✅ `.nvmrc` file created specifying version `24.12.0`
- ✅ `.envrc` updated to load Node version with direnv
- ✅ Setup script created: `pnpm setup:node`

### Initial Setup

**1. Install direnv** (if not already installed):

```bash
# macOS
brew install direnv

# Ubuntu/Debian
sudo apt install direnv

# Add to your shell config (~/.bashrc or ~/.zshrc):
eval "$(direnv hook bash)"  # or zsh
```

**2. Allow direnv in project directory**:

```bash
cd /path/to/RevealUI
direnv allow
```

**3. Verify Node version**:

```bash
node --version  # Should show v24.12.0
```

---

## Cursor IDE Configuration

### For Cursor Agent Sandbox

To ensure Cursor's agent sandbox uses the correct Node version:

**1. Verify direnv is working**:

```bash
cd /home/joshua-v-dev/projects/RevealUI
direnv status
```

**2. Open Cursor in the project directory**:

- The `.envrc` should automatically load the correct Node version
- If not working, run: `pnpm setup:node` in Cursor's terminal

**3. Verify Node version in Cursor**:

```bash
node --version  # Should show v24.12.0
pnpm --version
```

### Manual Node Version Configuration

If Cursor still shows the wrong Node version:

**Option 1: Use nvm in Cursor terminal**

```bash
nvm list
nvm use 24.12.0
```

**Option 2: Update Cursor settings**

In Cursor IDE:
1. Open Settings (Cmd/Ctrl + ,)
2. Search for "Node"
3. Set Node.js path to: `/home/joshua-v-dev/.nvm/versions/node/v24.12.0/bin/node`

**Option 3: Restart Cursor**

After making changes to environment configuration, restart Cursor IDE.

---

## Node Version Troubleshooting

### Problem: pnpm uses wrong Node version

**Symptoms:**
- pnpm uses Node v20.11.1 instead of v24.12.0
- nvm shows v24.12.0 as active but pnpm ignores it

**Root Cause:**
pnpm was installed with an older Node version and stores its own Node version information, ignoring the PATH Node version.

**Solutions:**

#### Solution 1: Reinstall pnpm (Recommended)

```bash
# Remove old pnpm
rm -rf ~/.local/share/pnpm
rm -rf ~/.local/bin/pnpm

# Install pnpm with Node 24.12.0
nvm use 24.12.0
npm install -g pnpm

# Verify
pnpm --version
node --version
```

#### Solution 2: Force Node path for pnpm

Create environment variables:

```bash
# In your shell profile or .envrc
export PATH="/home/joshua-v-dev/.nvm/versions/node/v24.12.0/bin:$PATH"
export PNPM_HOME="/home/joshua-v-dev/.local/share/pnpm"
```

#### Solution 3: Use nvm exec

```bash
nvm exec 24.12.0 pnpm typecheck:all
```

### Problem: Cursor agent sandbox ignores .nvmrc

**Symptoms:**
- `.nvmrc` file exists but Cursor uses wrong Node version
- direnv not loading automatically

**Solutions:**

**1. Check direnv configuration:**

```bash
direnv status
```

**2. Manually allow directory:**

```bash
cd /home/joshua-v-dev/projects/RevealUI
direnv allow
```

**3. Verify .envrc loads nvm:**

```bash
cat .envrc | grep nvm
# Should contain nvm configuration
```

**4. Manual Node version switch:**

```bash
cd /home/joshua-v-dev/projects/RevealUI
nvm use
node --version  # Should show v24.12.0
```

---

## MCP Configuration

MCP (Model Context Protocol) allows integration with external services like Vercel and Stripe.

### Vercel MCP Setup

**1. Get your Vercel access token:**

- Go to [Vercel Dashboard > Account > Tokens](https://vercel.com/account/tokens)
- Create a new token

**2. Get your team ID (optional):**

- Go to [Vercel Dashboard > Settings > General](https://vercel.com/account)

**3. Add to environment:**

```bash
VERCEL_ACCESS_TOKEN=your_vercel_access_token_here
VERCEL_TEAM_ID=your_vercel_team_id_here  # Optional
```

### Stripe MCP Setup

**1. Get your Stripe API keys:**

- Go to [Stripe Dashboard > API Keys](https://dashboard.stripe.com/apikeys)
- Copy secret key and publishable key

**2. Add to environment:**

```bash
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
```

### OpenAI Setup (for AI features)

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### MCP Integration Status

> **Note**: RevealUIMCPClient is **PLANNED** but not yet implemented. The MCP integration currently exists in `@revealui/mcp` package without a unified client wrapper.

**Planned API (not yet available):**

```typescript
// PLANNED: This API is not yet available
// import { RevealUIMCPClient } from '@revealui/mcp'
//
// const mcpClient = new RevealUIMCPClient({
//   vercel: {
//     accessToken: process.env.VERCEL_ACCESS_TOKEN!,
//     teamId: process.env.VERCEL_TEAM_ID
//   },
//   stripe: {
//     secretKey: process.env.STRIPE_SECRET_KEY!,
//     publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!
//   }
// })
//
// await mcpClient.initialize()
//
// // Deploy to Vercel
// await mcpClient.deployToVercel('my-app', './dist')
//
// // Create Stripe payment
// await mcpClient.createPaymentIntent(1000, 'usd')
```

---

## Verification

### Verify Node Setup

After completing setup, run these commands to verify:

```bash
# Check Node version
node --version
# Expected: v24.12.0

# Check pnpm version
pnpm --version
# Expected: 10.28.2 or higher

# Check nvm active version
nvm current
# Expected: v24.12.0

# Run typecheck (should work without engine errors)
pnpm typecheck:all

# Run tests (should run without cyclic dependency errors)
pnpm test
```

### Verify direnv Setup

```bash
# Check direnv status
direnv status
# Should show: Loaded RC path

# Check environment loaded
echo $NODE_VERSION
# Should show: v24.12.0 (if set in .envrc)
```

### Verify MCP Configuration

```bash
# Check environment variables are set
echo $VERCEL_ACCESS_TOKEN
echo $STRIPE_SECRET_KEY
echo $OPENAI_API_KEY
# Should display your configured values
```

---

## Quick Reference

### Essential Commands

```bash
# Switch to correct Node version
nvm use 24.12.0

# Verify Node version
node --version

# Allow direnv in project
direnv allow

# Reinstall pnpm with correct Node
npm install -g pnpm

# Run project setup
pnpm setup:node
```

### Common Patterns

```bash
# Development with correct Node version
nvm use && pnpm dev

# Type checking with correct Node
nvm exec 24.12.0 pnpm typecheck:all

# Run tests with correct Node
nvm use && pnpm test
```

---

## Related Documentation

- [Development Guide](../docs/development/README.md) - Complete development documentation
- [CI Environment](../docs/development/CI_ENVIRONMENT.md) - CI/CD environment specifications
- [Quick Start](../docs/onboarding/QUICK_START.md) - 5-minute setup guide

---

**Last Updated:** 2026-01-31
**Consolidated from:** cursor-env-fix.md, cursor-sandbox-setup.md, env-setup.md
