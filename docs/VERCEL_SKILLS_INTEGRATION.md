# Vercel Skills Integration

RevealUI now includes seamless integration with the Vercel Skills ecosystem (skills.sh), providing access to 100+ community-maintained skills while preserving RevealUI's advanced features like semantic search and context-aware activation.

## Overview

### What is Vercel Skills?

Vercel Skills is an open agent skills ecosystem launched in January 2025:
- **Central hub** at [skills.sh](https://skills.sh) for discovering and managing skills
- **Cross-platform support**: Works with 17+ tools including claude-code, cursor, github-copilot
- **Community-driven**: 100+ published skills, 36,000+ installations
- **Professional content**: Vercel Engineering's React/Next.js best practices

### How RevealUI Integrates

RevealUI uses a **bridge architecture** that:
- ✅ Imports Vercel Skills and converts them to RevealUI format
- ✅ Preserves all RevealUI features (semantic search, embeddings, context-aware activation)
- ✅ Works alongside local and GitHub skills seamlessly
- ✅ No migration required - both systems coexist

## Installation

### Install from Vercel Skills Catalog

```bash
# Install a Vercel skill
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

# Install globally
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel --global

# Force reinstall
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel --force
```

### Still Works: Install from GitHub or Local

```bash
# GitHub (existing functionality)
pnpm skills add owner/repo

# Local directory (existing functionality)
pnpm skills add ./path/to/skill --local
```

## Discovery

### Search Vercel Skills Catalog

```bash
# Search the Vercel catalog before installing
pnpm skills search "react hooks" --vercel

# Example output:
# Vercel Skills Search Results
#   react-best-practices (95.0% match)
#     React optimization patterns from Vercel Engineering
#     81,700 installs
#     Install: pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
```

### Show Trending Skills

```bash
# See what's popular
pnpm skills trending --vercel

# Example output:
# Trending Vercel Skills
#   react-best-practices
#     React optimization patterns and best practices
#     81,700 installs
#     Install: pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
#
#   web-design-guidelines
#     100+ accessibility and performance rules
#     61,900 installs
#     Install: pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel
```

### Still Works: Search Local Skills

```bash
# Search installed skills (existing functionality)
pnpm skills search "react"

# Semantic search with embeddings
pnpm skills search "optimize components" --semantic
```

## Management

### List All Skills

```bash
# Lists skills from all sources (GitHub, local, Vercel)
pnpm skills list
```

### View Skill Details

```bash
# Works for skills from any source
pnpm skills info react-best-practices
```

### Update Vercel Skills

```bash
# Check for and apply updates to Vercel skills
pnpm skills update react-best-practices

# Example output:
# Checking for updates to react-best-practices...
# Update available, installing...
# Updated skill: react-best-practices
# Changes: Check https://github.com/vercel-labs/agent-skills for changes
```

### Remove Skills

```bash
# Works for skills from any source
pnpm skills remove react-best-practices
```

## Recommended Vercel Skills

### For RevealUI Development

1. **react-best-practices** (81.7K installs)
   ```bash
   pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel
   ```
   - React optimization patterns from Vercel's 10 years of experience
   - Server/Client Component best practices
   - Performance optimization techniques

2. **nextjs-best-practices** (45.2K installs)
   ```bash
   pnpm skills add vercel-labs/agent-skills/nextjs-best-practices --vercel
   ```
   - Next.js App Router patterns
   - Routing and navigation best practices
   - Data fetching strategies

3. **typescript-patterns** (38.9K installs)
   ```bash
   pnpm skills add vercel-labs/agent-skills/typescript-patterns --vercel
   ```
   - TypeScript design patterns
   - Type safety best practices
   - Generic programming techniques

4. **web-design-guidelines** (61.9K installs)
   ```bash
   pnpm skills add vercel-labs/agent-skills/web-design-guidelines --vercel
   ```
   - 100+ accessibility rules
   - Performance optimization guidelines
   - Responsive design patterns

5. **find-skills** (78.8K installs)
   ```bash
   pnpm skills add vercel-labs/agent-skills/find-skills --vercel
   ```
   - Meta-skill for discovering other skills
   - Helps agents find the right skill for the task

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│  RevealUI Skills CLI (pnpm skills)      │
│  - add/list/remove/search/trending      │
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
    └───► SkillRegistry (Unified) │
          - Source tracking: vercel/github/local
          - Semantic search (embeddings)
          - Context-aware activation
```

### Bridge Layer

When you install a Vercel skill, RevealUI:

1. **Installs** via `npx skills` CLI (with git fallback)
2. **Parses** the SKILL.md file
3. **Converts** to RevealUI's Skill type
4. **Enhances** with embeddings for semantic search
5. **Registers** with source tracking (`source: 'vercel'`)

### Enhancements Over Raw Vercel Skills

RevealUI adds these features that Vercel Skills don't have:

- **Semantic Search**: Embeddings-based search across all skills
- **Context-Aware Activation**: Skills activate based on file types and project context
- **Source Tracking**: Know where each skill came from
- **Unified Registry**: All skills work together regardless of source
- **Tool Restriction Enforcement**: Verify skills use only allowed tools

## Compatibility

### Tool Name Mapping

Vercel Skills use lowercase tool names. RevealUI automatically maps them:

| Vercel Format | RevealUI Format |
|---------------|-----------------|
| `bash`        | `Bash`          |
| `read`        | `Read`          |
| `write`       | `Write`         |
| `edit`        | `Edit`          |
| `web-fetch`   | `WebFetch`      |
| `web-search`  | `WebSearch`     |

Tool filters are preserved: `bash(git:*)` → `Bash(git:*)`

### Compatibility Check

Skills with `compatibility: ['universal']` or `compatibility: ['claude-code']` work automatically with RevealUI.

## API Usage

### TypeScript API

```typescript
import {
  loadFromVercelSkills,
  searchVercelCatalog,
  getTrendingSkills,
  checkVercelSkillUpdates,
  updateVercelSkill,
  SkillRegistry,
} from '@revealui/ai/skills'

// Install a Vercel skill
const registry = new SkillRegistry()
const skill = await loadFromVercelSkills(
  'vercel-labs/agent-skills/react-best-practices',
  {
    targetDir: registry.getSkillDirectory('', 'local'),
    scope: 'local',
    registry,
    generateEmbedding: true,
  }
)

// Search Vercel catalog
const results = await searchVercelCatalog('react hooks', {
  threshold: 0.1,
  limit: 10,
})

// Get trending skills
const trending = await getTrendingSkills(10)

// Check for updates
const updateInfo = await checkVercelSkillUpdates('react-best-practices', registry)
if (updateInfo.available) {
  await updateVercelSkill('react-best-practices', registry)
}
```

### Catalog API

```typescript
import {
  fetchVercelCatalog,
  getSkillsByTag,
  getSkillsByCompatibility,
  getSkillById,
} from '@revealui/ai/skills'

// Fetch full catalog (cached for 24 hours)
const catalog = await fetchVercelCatalog()

// Get skills by tag
const reactSkills = await getSkillsByTag('react')

// Get skills compatible with claude-code
const claudeSkills = await getSkillsByCompatibility('claude-code')

// Get specific skill
const skill = await getSkillById('vercel-labs/agent-skills/react-best-practices')
```

## Configuration

### Cache Location

Catalog data is cached at `~/.revealui/cache/vercel-catalog.json`

Clear cache:
```bash
rm ~/.revealui/cache/vercel-catalog.json
```

Or programmatically:
```typescript
import { clearCatalogCache } from '@revealui/ai/skills'
clearCatalogCache()
```

### Cache TTL

Default: 24 hours. Override:
```typescript
import { fetchVercelCatalog } from '@revealui/ai/skills'

const catalog = await fetchVercelCatalog({
  cacheTtl: 60 * 60 * 1000, // 1 hour
  forceRefresh: false,
})
```

## Troubleshooting

### npx skills fails

RevealUI automatically falls back to direct git clone if `npx skills` is unavailable or fails.

### Skill not compatible

If a skill shows incompatibility, it may be designed for a different tool. You can still install it, but it might not work as expected:

```bash
# Install anyway
pnpm skills add some/skill --vercel --force
```

### Update fails

Manually reinstall with force:
```bash
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel --force
```

## Benefits

### Access to Professional Content

- Vercel's 10 years of React/Next.js expertise
- Battle-tested by 36,000+ installations
- Community contributions and improvements

### Reduced Maintenance

- Use community-maintained skills instead of building everything
- Automatic updates available
- Shared knowledge across the ecosystem

### Cross-Platform Learning

- Bring skills from Cursor, Copilot to RevealUI
- Share RevealUI skills with other tools (export coming soon)

### Enhanced Discovery

- Centralized marketplace vs. manual GitHub searching
- Trending/popularity metrics
- Tagged categorization

## Future Enhancements

- [ ] Publish RevealUI skills to Vercel catalog
- [ ] Real-time catalog API (when available)
- [ ] Automatic update checks
- [ ] Skill ratings and reviews
- [ ] Install from npm packages
- [ ] Skill dependencies

## Related Documentation

- [AUTOMATION.md](./AUTOMATION.md) - RevealUI's skills system overview
- [skills.sh](https://skills.sh) - Vercel Skills catalog
- [Agent Skills Standard](https://github.com/vercel-labs/agent-skills) - Specification

## Quick Reference

```bash
# Install
pnpm skills add <source> --vercel

# Search catalog
pnpm skills search <query> --vercel

# Show trending
pnpm skills trending --vercel

# Update
pnpm skills update <name>

# List all
pnpm skills list

# Remove
pnpm skills remove <name>
```
