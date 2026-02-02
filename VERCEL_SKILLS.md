# Vercel Skills Integration

RevealUI provides seamless integration with the [Vercel Skills ecosystem](https://skills.sh), giving you access to 100+ community-maintained agent skills while preserving RevealUI's advanced features like semantic search and context-aware activation.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Available Commands](#available-commands)
- [Architecture](#architecture)
- [Benefits](#benefits)
- [Examples](#examples)
- [FAQ](#faq)

## Overview

**What is Vercel Skills?**

Vercel Skills is an open agent skills ecosystem launched in January 2025:
- **Central hub** at [skills.sh](https://skills.sh) for discovering and managing skills
- **Cross-platform support**: Compatible with 17+ tools including claude-code, cursor, github-copilot
- **Community-driven**: 100+ published skills with 36,000+ installations
- **Professional content**: Vercel Engineering's React/Next.js best practices

**RevealUI's Integration**

Rather than replacing RevealUI's sophisticated skills system, we created a **bridge layer** that:
- ✅ Provides access to the entire Vercel Skills ecosystem
- ✅ Maintains RevealUI's advanced features (semantic search, context-aware activation)
- ✅ Automatically generates embeddings for Vercel skills
- ✅ Tracks skill sources (`vercel`, `github`, or `local`)
- ✅ Supports unified discovery and management

## Quick Start

### 1. Browse Trending Skills

```bash
pnpm skills:trending
```

Output:
```
Trending Vercel Skills
======================

react-best-practices
  React optimization patterns and best practices from Vercel Engineering
  81,700 installs
  Install: pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

find-skills
  Meta-skill for discovering other skills
  78,800 installs
  Install: pnpm skills add vercel-labs/agent-skills/find-skills --vercel
```

### 2. Search for Skills

```bash
pnpm skills:search:vercel "react hooks"
```

### 3. Install a Vercel Skill

```bash
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
```

### 4. Use Installed Skills

Once installed, Vercel skills work automatically with RevealUI agents through context-aware activation.

## Installation

Vercel Skills integration is built into RevealUI. No additional setup required!

The integration automatically:
- Detects and uses `npx skills` CLI if available
- Falls back to direct git clone if needed
- Generates embeddings for semantic search
- Registers skills in RevealUI's unified registry

## Usage

### Install from Vercel Ecosystem

```bash
# Full source path
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

# Install globally (available across all projects)
pnpm skills add vercel-labs/agent-skills/find-skills --vercel --global

# Force reinstall if already exists
pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel --force

# Install specific version/ref
pnpm skills add vercel-labs/agent-skills/nextjs-best-practices --vercel --ref v2.0
```

### Search Vercel Catalog

```bash
# Search by keyword
pnpm skills:search:vercel "typescript"

# Full search command
pnpm skills search "react performance" --vercel
```

### List All Skills (Unified)

```bash
pnpm skills:list
```

This shows skills from all sources:
- ✅ Vercel Skills (with `(vercel)` label)
- ✅ GitHub Skills (with `(github)` label)
- ✅ Local Skills (with `(local)` label)

### View Skill Details

```bash
pnpm skills:info react-best-practices
```

### Update Vercel Skills

```bash
# Check for updates
pnpm skills update react-best-practices

# Update all (if available)
# TODO: Implement --all flag
```

### Remove Skills

```bash
pnpm skills:remove react-best-practices
```

## Available Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `pnpm skills:list` | List all installed skills (all sources) |
| `pnpm skills:info <name>` | Show detailed skill information |
| `pnpm skills add <source>` | Install skill from GitHub |
| `pnpm skills:add:vercel <source>` | Install skill from Vercel ecosystem |
| `pnpm skills:remove <name>` | Uninstall a skill |

### Discovery Commands

| Command | Description |
|---------|-------------|
| `pnpm skills:trending` | Show trending Vercel skills |
| `pnpm skills:search <query>` | Search installed skills |
| `pnpm skills:search:vercel <query>` | Search Vercel catalog |

### Maintenance Commands

| Command | Description |
|---------|-------------|
| `pnpm skills:update <name>` | Update a Vercel skill |
| `pnpm skills:create <name>` | Create a new local skill template |

### Flags

| Flag | Description |
|------|-------------|
| `--vercel` | Use Vercel Skills ecosystem |
| `--local` | Install from local directory |
| `--global` | Install globally (all projects) |
| `--force` | Overwrite existing skill |
| `--semantic` | Use embedding-based search |
| `--json` | Output in JSON format |

## Architecture

### Bridge Layer

```
┌─────────────────────────────────────────┐
│  RevealUI Skills CLI (pnpm skills)      │
│  - add/list/remove/search               │
│  - NEW: --vercel flag                   │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐      ┌────▼──────────┐
│ Local  │      │ Vercel Skills │
│ Skills │      │   Ecosystem   │
│ System │      │   (skills.sh) │
└───┬────┘      └────┬──────────┘
    │                │
    └───► SkillRegistry (Unified)
          - Both formats supported
          - Source tracking
          - Semantic search
```

### Key Components

#### 1. **Vercel Loader** (`packages/ai/src/skills/loader/vercel-loader.ts`)
- Interfaces with `npx skills` CLI
- Falls back to direct git clone
- Converts to RevealUI format
- Generates embeddings

#### 2. **Catalog Integration** (`packages/ai/src/skills/catalog/`)
- Fetches skills.sh catalog
- Caches locally (24-hour TTL)
- Supports search and trending
- Offline-capable

#### 3. **Compatibility Layer** (`packages/ai/src/skills/compat/`)
- Maps tool names between formats
- Enhances metadata
- Validates compatibility

#### 4. **Unified Registry** (`packages/ai/src/skills/registry/`)
- Tracks skill sources (`vercel`, `github`, `local`)
- Manages namespaces
- Resolves conflicts

## Benefits

### For Developers

1. **Ecosystem Access**: Tap into 100+ battle-tested skills from the Vercel community
2. **Professional Content**: Leverage Vercel's 10 years of React/Next.js expertise
3. **Reduced Maintenance**: Use community-maintained skills instead of building everything
4. **Unified Discovery**: Centralized marketplace vs. manual GitHub searching
5. **No Migration**: Both skill systems work side-by-side seamlessly

### RevealUI's Advanced Features (Preserved)

- ✅ **Semantic Search**: Vector embeddings for intelligent skill matching
- ✅ **Context-Aware Activation**: File-type and project-type based activation
- ✅ **Tool Restriction Enforcement**: Security through allowedTools validation
- ✅ **Memory Subsystem Integration**: Skills work with RevealUI's agent memory
- ✅ **TypeScript-First**: Full type safety with Zod validation

## Examples

### Example 1: Install React Best Practices

```bash
# Install from Vercel
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

# Verify installation
pnpm skills:info react-best-practices

# Use in development
# The skill is now automatically activated when working with React files
```

### Example 2: Search and Install

```bash
# Search Vercel catalog
pnpm skills:search:vercel "accessibility"

# Output:
# web-design-guidelines (95.0% match)
#   100+ accessibility and performance rules
#   Install: pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel

# Install the skill
pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel
```

### Example 3: Mixed Sources

```bash
# Install from Vercel
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

# Install from GitHub
pnpm skills add owner/repo

# Install local custom skill
pnpm skills add ./my-custom-skill --local

# List all (unified view)
pnpm skills:list

# Output:
# - react-best-practices (vercel)
# - my-github-skill (github)
# - my-custom-skill (local)
```

### Example 4: Update Workflow

```bash
# Check for updates
pnpm skills update react-best-practices

# Output:
# Checking for updates to react-best-practices...
# Update available, installing...
# Updated skill: react-best-practices
```

### Example 5: Programmatic Usage

```typescript
import {
  loadFromVercelSkills,
  SkillRegistry,
  getTrendingSkills,
  searchVercelCatalog,
} from '@revealui/ai/skills'

// Create registry
const registry = new SkillRegistry({
  projectRoot: process.cwd(),
})

// Browse trending
const trending = await getTrendingSkills(10)
console.log('Trending:', trending)

// Search catalog
const results = await searchVercelCatalog('react', {
  threshold: 0.5,
  limit: 10,
})

// Install a skill
await loadFromVercelSkills('vercel-labs/agent-skills/react-best-practices', {
  targetDir: '.revealui/skills',
  scope: 'local',
  registry,
  generateEmbedding: true,
})

// Activate skills (automatic with context)
import { SkillActivator } from '@revealui/ai/skills'

const activator = new SkillActivator({ registry })
const result = await activator.activate({
  taskDescription: 'Optimize this React component',
  currentFiles: ['src/App.tsx'],
})

console.log('Activated skills:', result.activatedSkills)
```

## FAQ

### How do Vercel skills differ from RevealUI skills?

**Vercel Skills**:
- Community-maintained at skills.sh
- Cross-platform (works with multiple tools)
- Large ecosystem (100+ skills)
- Official Vercel content for React/Next.js

**RevealUI Skills**:
- Custom skills for your project
- Full access to RevealUI's advanced features
- TypeScript-first with Zod validation
- Can be private/proprietary

Both types work seamlessly together in RevealUI.

### Can I use Vercel skills offline?

Yes! Once installed, Vercel skills work offline. The catalog is cached locally (24-hour TTL), and you can force refresh with:

```bash
pnpm skills:trending --force-refresh
```

### How are Vercel skills kept up to date?

Use the update command:

```bash
pnpm skills update <skill-name>
```

RevealUI checks the upstream repository for changes and reinstalls if updates are available.

### What happens if skill names conflict?

RevealUI tracks skill sources and can namespace them:
- `react-best-practices` (from Vercel)
- `local/react-best-practices` (your custom skill)

You can specify the source explicitly:

```bash
pnpm skills:info vercel/react-best-practices
pnpm skills:info local/react-best-practices
```

### Can I contribute to Vercel Skills?

Yes! Visit [skills.sh](https://skills.sh) for contribution guidelines. The ecosystem is open and community-driven.

### How do I create my own custom skill?

```bash
# Create a new skill template
pnpm skills:create my-custom-skill

# Edit the SKILL.md file
# Add scripts and references
# Test with your agents
```

See RevealUI's skills documentation for detailed authoring guide.

### What if `npx skills` isn't available?

RevealUI automatically falls back to direct git clone. The experience is seamless - you won't notice any difference.

### How does semantic search work with Vercel skills?

When installing Vercel skills, RevealUI automatically generates vector embeddings for semantic search. This means you can search by concept, not just keywords:

```bash
# Semantic search across all skills
pnpm skills search "improve component performance" --semantic
```

### Can I install a specific version of a Vercel skill?

Yes, use the `--ref` flag:

```bash
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel --ref v2.0
```

### Where are Vercel skills installed?

Local scope (default):
```
.revealui/skills/<skill-name>/
```

Global scope (`--global` flag):
```
~/.revealui/skills/<skill-name>/
```

### How do I remove the catalog cache?

The catalog is cached at `~/.revealui/cache/vercel-catalog.json`. To clear:

```bash
rm ~/.revealui/cache/vercel-catalog.json
```

Or force refresh on next fetch:

```bash
pnpm skills:trending --force-refresh
```

## Recommended Skills

Here are some popular Vercel skills to get started:

1. **react-best-practices** (81.7K installs)
   - React optimization patterns from Vercel Engineering
   - Perfect for RevealUI's React-based architecture

2. **web-design-guidelines** (61.9K installs)
   - 100+ accessibility and performance rules
   - Improves UI/UX across all apps

3. **find-skills** (78.8K installs)
   - Meta-skill for discovering other skills
   - Helps agents find the right tools

4. **nextjs-best-practices** (45.2K installs)
   - Next.js App Router optimization patterns
   - Essential for RevealUI CMS development

5. **typescript-patterns** (38.9K installs)
   - TypeScript design patterns and best practices
   - Complements RevealUI's type-safe architecture

## Resources

- **Vercel Skills Hub**: https://skills.sh
- **RevealUI Skills Docs**: [./docs/AUTOMATION.md](./docs/AUTOMATION.md)
- **Agent Skills Spec**: https://github.com/vercel-labs/agent-skills
- **RevealUI Skills Tests**: [./packages/ai/src/skills/__tests__/](./packages/ai/src/skills/__tests__/)

## Support

Issues with Vercel Skills integration? Open an issue at:
https://github.com/RevealUIStudio/revealui/issues

For general Vercel Skills questions, visit:
https://github.com/vercel-labs/agent-skills/issues
