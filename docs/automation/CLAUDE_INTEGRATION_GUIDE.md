# Claude Code Integration Guide

This guide explains how to connect **Claude Code** (Anthropic's agentic CLI) to your **Antigravity** IDE and leverage the existing project infrastructure.

---

## 🚀 Overview

RevealUI is built with extensive AI-agent infrastructure. You can interact with it through Anthropic's Claude Code CLI while working in the Antigravity IDE.

### Integration Options

1.  **Direct CLI Usage**: Run `claude` directly in Antigravity's integrated terminal.
2.  **IDE Extension**: Use the official Claude Extension inside Antigravity (VS Code based).
3.  **MCP Sharing**: Use RevealUI's pre-configured MCP servers in both environments.
4.  **Agent Skills**: Use the `pnpm skills` CLI to manage agent capabilities.

---

## 🛠️ Option 1: Claude Code CLI (Recommended)

Running Claude Code in Antigravity's terminal gives the agent full access to your environment, build tools, and local servers.

### Setup

1.  **Install Claude Code globally**:
    ```bash
    pnpm add -g @anthropic-ai/claude-code
    ```
2.  **Verify Configuration**:
    The project already contains a `.claude/` directory with `settings.local.json` which defines allowed permissions for the agent (e.g., `pnpm test`, `git`, etc.).
3.  **Launch from Root**:
    Open the terminal in Antigravity and run:
    ```bash
    claude
    ```

---

## 🔌 Option 2: MCP Integration

RevealUI includes several **Model Context Protocol (MCP)** servers that provide agents with "real-world" tools like database access and service management.

### Shared MCP Servers
The project is configured to use:
- **Vercel MCP**: Manage deployments and storage.
- **Stripe MCP**: Manage payments and products.
- **Neon/Supabase MCP**: Query your production/dev databases.
- **Next.js DevTools MCP**: Inspect your application state.

### Using MCP with Claude Code
Claude Code automatically looks for MCP configurations. If you are running the `pnpm dev` command, the local MCP servers are typically started automatically.

See `docs/mcp/MCP_SETUP.md` for detailed server configuration.

---

## 🧠 Option 3: Agent Skills System

The RevealUI Framework includes a custom **Skills System** for agents. This allows you to "teach" Claude new capabilities by installing skills.

### Skills CLI
Use the `pnpm skills` command in the Antigravity terminal:

```bash
pnpm skills list        # List installed skills
pnpm skills add <repo>  # Install a specific skill
pnpm skills info <name> # See what an agent can do with this skill
```

Skills typically include customized instructions (in `SKILL.md`) and specialized scripts that Claude can execute.

---

## 🔗 Option 4: Antigravity-Claude Proxy

If you want to use Antigravity's models (like Gemini 2.0 Pro) *inside* the Claude Code CLI, you can use the community-built proxy.

1.  **Install the proxy**:
    ```bash
    pnpm add -g antigravity-claude-proxy
    ```
2.  **Configure Claude Code** to point to the local proxy endpoint.
3.  This allows you to leverage Antigravity's generous quotas while using Claude's agentic interface.

---

## 📚 Related Documentation

- [Agent Quick Start Guide](./AGENT_QUICK_START.md)
- [MCP Setup Guide](../mcp/MCP_SETUP.md)
- [Project Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md)
