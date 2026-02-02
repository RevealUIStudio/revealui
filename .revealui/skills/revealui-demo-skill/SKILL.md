---
name: revealui-demo-skill
description: Demo skill showcasing RevealUI's skills system integration
version: "1.0.0"
author: RevealUI Team
tags:
  - demo
  - revealui
  - example
compatibility:
  - claude-code
  - universal
allowedTools:
  - Read
  - Write
  - Bash
---

# RevealUI Demo Skill

This is a demonstration skill that showcases RevealUI's advanced skills system with Vercel Skills integration.

## Overview

This skill demonstrates:
- Skills system architecture
- Source tracking (local/github/vercel)
- Semantic search with embeddings
- Context-aware activation
- CLI integration

## Features

### 1. Multi-Source Support
RevealUI supports skills from multiple sources:
- **Local**: Custom skills in your project
- **GitHub**: Community skills from repositories
- **Vercel**: Professional skills from skills.sh ecosystem

### 2. Semantic Search
All skills are indexed with AI embeddings for semantic search:
```bash
pnpm skills search "optimize performance" --semantic
```

### 3. CLI Commands
Unified CLI for all skill sources:
```bash
# Local skills
pnpm skills create my-skill
pnpm skills add ./path/to/skill --local

# GitHub skills
pnpm skills add owner/repo

# Vercel skills
pnpm skills add vercel-labs/agent-skills/skill-name --vercel
pnpm skills search "query" --vercel
pnpm skills trending --vercel
```

## Usage Instructions

When working on RevealUI projects, remember:

1. **Architecture**: RevealUI uses a bridge pattern for Vercel Skills
2. **Zero Breaking Changes**: All existing features preserved
3. **Type Safety**: Full TypeScript support throughout
4. **Testing**: Comprehensive test coverage

## Example Workflow

```bash
# Discover skills
pnpm skills search "react" --vercel

# Install professional skills
pnpm skills add vercel-labs/agent-skills/react-best-practices --vercel

# List all skills
pnpm skills list

# View details
pnpm skills info react-best-practices

# Update
pnpm skills update react-best-practices
```

## Technical Details

- **Registry**: Unified SkillRegistry manages all sources
- **Embeddings**: Generated for semantic search
- **Caching**: 24hr cache for Vercel catalog
- **Fallback**: Automatic fallback from npx to git

This skill serves as a reference for RevealUI's skills capabilities!
