# .cursor/ Directory - Configuration Hub

**Centralized configuration for Cursor IDE and AI development tooling**

This directory contains all Cursor IDE configurations, AI agent setups, MCP server configurations, and development workflows for the RevealUI Framework.

---

## Directory Structure

```
.cursor/
├── agents/              # Specialized AI agent configurations
├── commands/            # Cursor slash commands
│   └── COMMANDS.md      # Complete command reference
├── workflows/           # Development workflows
│   └── WORKFLOWS.md     # Complete workflow reference
├── snippets/            # Code snippets
├── rules/               # Cursor IDE rules
├── backups/             # Configuration backups
├── config.json          # Cursor IDE configuration
├── environment.json     # Development environment setup
├── mcp-config.json      # MCP servers configuration (main 6 servers)
├── mcp.json             # Vite MCP server configuration
├── rules.md             # Project coding rules
├── cohesion-analysis.json  # Code quality analysis results
├── ENVIRONMENT_SETUP.md # Environment setup guide
└── LEGACY-CODE-REMOVAL-POLICY.md  # Code maintenance policy
```

---

## Quick Reference

### Commands
**Location**: `.cursor/commands/COMMANDS.md`

AI-powered development commands:
- `/smart-dev` - Analyze tasks and generate implementation plans
- `/generate-code` - Generate code from analysis
- `/dev`, `/test-implementation`, `/code-review`, `/debug-issue` - Development templates

### Workflows
**Location**: `.cursor/workflows/WORKFLOWS.md`

Step-by-step workflows for:
- Complete AI-powered development
- Console error analysis (MCP-based)
- React component creation
- Iterative development (Ralph-inspired)

### MCP Servers
**Location**: `.cursor/mcp-config.json`, `.cursor/mcp.json`

Configured MCP servers:
- Vercel, Stripe, Neon, Supabase (main MCP config)
- Playwright, Next.js DevTools (main MCP config)
- Vite (separate MCP config)

### AI Agents
**Location**: `.cursor/agents/`

Specialized agents for:
- Next.js development
- CMS operations
- TypeScript fixes
- Testing

---

## Configuration Files

### config.json
Cursor IDE configuration including:
- TypeScript rules
- Code style preferences
- File patterns
- Framework context

### environment.json
Development environment setup:
- Node version (24.12.0)
- Package manager (pnpm)
- Terminal configurations
- Environment variables

### rules.md
Project-wide coding rules:
- TypeScript strict mode
- No GraphQL (REST/RPC only)
- ESM only (no CommonJS)
- Named exports preferred
- Use `pnpm dlx` instead of `npx`

---

## Special Files

### cohesion-analysis.json
Automated code quality analysis results from the Cohesion Engine, tracking:
- Code patterns and duplications
- Type safety violations
- Import inconsistencies

### ENVIRONMENT_SETUP.md
Complete environment setup guide covering:
- Development environment options (Nix, Dev Containers, Manual)
- Environment variable configuration
- Tool installation

### LEGACY-CODE-REMOVAL-POLICY.md
Mandatory policy for removing deprecated code:
- No backward compatibility for legacy code
- Immediate removal when making changes
- Refactor all call sites

---

## Usage

### For Developers

**Quick Start**:
1. Read `.cursor/COMMANDS.md` for available commands
2. Read `.cursor/WORKFLOWS.md` for development workflows
3. Check `rules.md` for coding standards

**Daily Use**:
- Use `/smart-dev` for complex tasks
- Use `/generate-code` to implement approved analyses
- Reference workflows for common tasks

### For AI Agents

**Configuration**:
- Read `config.json` for project rules
- Read `rules.md` for coding standards
- Check `agents/` for specialized behaviors

**MCP Integration**:
- Use MCP servers from `mcp-config.json`
- Leverage Playwright for browser automation
- Use Next.js DevTools for debugging

---

## Maintenance

### Regular Tasks

**Weekly**:
- Review `cohesion-analysis.json` for code quality issues
- Update workflows based on new patterns
- Archive old configurations in `backups/`

**Monthly**:
- Update command documentation
- Review and improve workflows
- Clean up unused configurations

### Backup Strategy

Configuration backups stored in `.cursor/backups/`:
- Dated backups of critical configs
- Recovery point for breaking changes
- Historical reference for evolution

---

## Related Documentation

- **Project Documentation**: `docs/` - Complete project documentation
- **Development Guide**: `docs/development/` - Development processes
- **MCP Guide**: `docs/MCP.md` - MCP server setup and usage
- **Automation Guide**: `docs/AUTOMATION.md` - AI agent integration

---

**Last Updated**: 2026-02-01
**Status**: Consolidated and standardized
